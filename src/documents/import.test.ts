import { describe, expect, it, vi } from 'vitest';
import { DocumentList } from './document-list.js';
import { importDocument } from './import.js';
import type { DocumentServices } from './document.js';
import { ApiError } from '@sudobility/music_client';
import type { MusicClient } from '@sudobility/music_client';
import type { ImportSource, ScoreImporter } from './import.js';
import { createEmptyScore, MusicPosition } from '@sudobility/music_types';
import { OFFLINE_DOCUMENT_SERVICES } from './document.js';

function harness(scoreTitle = 'From File') {
  const score = createEmptyScore({ title: scoreTitle });
  const source: ImportSource = {
    readText: vi.fn(async () => '<score-partwise/>'),
    readBytes: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  };
  const importer: ScoreImporter = {
    // One empty track: enough for `defaultMidiImportOptions` to derive from.
    analyzeMidi: vi.fn(() => ({
      trackCount: 1,
      ppq: 480,
      durationTicks: 0,
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      detectedGrid: { grid: null, triplet: false },
      tracks: [],
    })) as unknown as ScoreImporter['analyzeMidi'],
    openMidi: vi.fn(() => ({ score, warnings: ['a track was empty'] })),
    openMusicXml: vi.fn(async () => ({ score, warnings: [] })),
    openTracker: vi.fn(() => ({ score })),
  };
  return {
    source,
    importer,
    list: new DocumentList({ position: () => new MusicPosition() }),
    services: OFFLINE_DOCUMENT_SERVICES,
  };
}

describe('importing', () => {
  it('makes a new document rather than editing the open one', async () => {
    const { list, services, source, importer } = harness();
    const first = await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/a.mid',
    );
    const second = await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/b.mid',
    );
    expect(list.state.documents).toHaveLength(2);
    expect(second.document.id).not.toBe(first.document.id);
    // The first document is untouched by the second import.
    expect(first.document.store.getState().dirty).toBe(false);
  });

  it('leaves the document unsaved, so a save cannot overwrite the source file', async () => {
    const { list, services, source, importer } = harness();
    const { document } = await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/song.mid',
    );
    // Writing a Moosiac document back over a .mid would lose everything MIDI
    // cannot hold.
    expect(document.store.getState().origin).toEqual({ kind: 'unsaved' });
  });

  it('passes the warnings back rather than swallowing them', async () => {
    const { list, services, source, importer } = harness();
    const { warnings } = await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/song.mid',
    );
    expect(warnings).toEqual(['a track was empty']);
  });

  it('names the document from the score when it has a title', async () => {
    const { list, services, source, importer } = harness('Sonata in C');
    const { document } = await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/whatever.mid',
    );
    expect(document.store.getState().title).toBe('Sonata in C');
  });

  it('falls back to the filename, which says more than "Untitled"', async () => {
    const { list, services, source, importer } = harness('');
    const { document } = await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/tunes/Reel.mid',
    );
    expect(document.store.getState().title).toBe('Reel');
  });

  it('reads bytes for MIDI and text for MusicXML', async () => {
    const { list, services, source, importer } = harness();
    await importDocument(list, services, source, importer, 'midi', '/a.mid');
    expect(source.readBytes).toHaveBeenCalled();
    expect(source.readText).not.toHaveBeenCalled();

    await importDocument(
      list,
      services,
      source,
      importer,
      'musicxml',
      '/a.musicxml',
    );
    expect(source.readText).toHaveBeenCalled();
  });
});

describe('a tracker module', () => {
  it('imports with no warnings, because it states everything outright', async () => {
    // Unlike MIDI or audio there is nothing to estimate: a module names every
    // note and instrument, so there is nothing to report having guessed.
    const { list, services, source, importer } = harness('Jig');
    const result = await importDocument(
      list,
      services,
      source,
      importer,
      'tracker',
      '/a.xm',
    );
    expect(result.warnings).toEqual([]);
    expect(importer.openTracker).toHaveBeenCalled();
    expect(result.document.store.getState().title).toBe('Jig');
  });
});

describe('MIDI options', () => {
  it('derives them from the file when the reader was not asked', async () => {
    /*
      A MIDI file has no bar lines, clefs or key, so importing one is a series
      of guesses. Deriving them from the file's own analysis is what makes
      "just import it" a single tap; the wizard opens pre-filled with the same
      answers rather than with blanks.
    */
    const { list, services, source, importer } = harness();
    await importDocument(list, services, source, importer, 'midi', '/a.mid');
    expect(importer.analyzeMidi).toHaveBeenCalled();
    const options = vi.mocked(importer.openMidi).mock.calls[0]?.[1];
    expect(options).toMatchObject({ trackSelections: expect.any(Array) });
  });

  it("uses the reader's answers when they were asked", async () => {
    const { list, services, source, importer } = harness();
    const chosen = {
      ...(await import('@sudobility/music_lib')).defaultMidiImportOptions({
        trackCount: 1,
        ppq: 480,
        durationTicks: 0,
        tempoBpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        detectedGrid: { grid: null, triplet: false },
        tracks: [],
      } as never),
      quantizeGrid: 'eighth' as const,
    };
    await importDocument(
      list,
      services,
      source,
      importer,
      'midi',
      '/a.mid',
      {},
      chosen,
    );
    expect(vi.mocked(importer.openMidi).mock.calls[0]?.[1].quantizeGrid).toBe(
      'eighth',
    );
  });
});

describe('where an import lands', () => {
  function serverServices(
    createProject: (...args: unknown[]) => Promise<unknown>,
    token: string | null = 'tok',
  ): DocumentServices {
    return {
      ...OFFLINE_DOCUMENT_SERVICES,
      context: {
        client: { createProject } as unknown as MusicClient,
        getToken: async () => token,
      },
    };
  }

  it('becomes a server project when somebody is signed in', async () => {
    const { list, source, importer } = harness('Sonata');
    const createProject = vi.fn(async () => ({
      id: 'p9',
      updatedAt: '2026-09-15T00:00:00.000Z',
    }));
    const { document } = await importDocument(
      list,
      serverServices(createProject),
      source,
      importer,
      'midi',
      '/a.mid',
    );
    const state = document.store.getState();
    expect(state.origin).toEqual({ kind: 'project', projectId: 'p9' });
    expect(state.serverUpdatedAt).toBe('2026-09-15T00:00:00.000Z');
    expect(state.dirty).toBe(false);
    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sonata' }),
      'tok',
    );
    state.dispose();
  });

  it('stays a local document when signed out', async () => {
    const { list, source, importer } = harness();
    const createProject = vi.fn();
    const { document } = await importDocument(
      list,
      serverServices(createProject as never, null),
      source,
      importer,
      'midi',
      '/a.mid',
    );
    expect(createProject).not.toHaveBeenCalled();
    expect(document.store.getState().origin).toEqual({ kind: 'unsaved' });
  });

  it('keeps the work locally when the server cannot be reached', async () => {
    const { list, source, importer } = harness();
    const { document } = await importDocument(
      list,
      serverServices(async () => {
        throw new TypeError('Network request failed');
      }),
      source,
      importer,
      'midi',
      '/a.mid',
    );
    expect(document.store.getState().origin).toEqual({ kind: 'unsaved' });
  });

  it('reports a server that answered and refused', async () => {
    const { list, source, importer } = harness();
    await expect(
      importDocument(
        list,
        serverServices(async () => {
          throw new ApiError('nope', 500);
        }),
        source,
        importer,
        'midi',
        '/a.mid',
      ),
    ).rejects.toThrow('nope');
    expect(list.state.documents).toHaveLength(0);
  });
});
