import { describe, expect, it, vi } from 'vitest';
import { createDocumentStore } from '@sudobility/music_lib';
import { asDocument } from './document.js';
import { parseProjectFile } from '@sudobility/music_lib';
import { exportDocument } from './export.js';
import type { ScoreExporter } from './export.js';
import {
  changeMetadataCommand,
  createEmptyScore,
} from '@sudobility/music_types';

function doc(title: string) {
  return asDocument(
    createDocumentStore({
      title: 'file name',
      score: createEmptyScore({ title }),
    }),
  );
}

type Recorded = {
  midi: string[];
  xml: string[];
  tracker: string[];
  audio: string[];
  files: { name: string; data: string; mime: string }[];
};

function exporter(): ScoreExporter & Recorded {
  const midi: string[] = [];
  const xml: string[] = [];
  const tracker: string[] = [];
  const audio: string[] = [];
  const files: Recorded['files'] = [];
  return {
    midi,
    xml,
    tracker,
    audio,
    files,
    fileExporter: {
      save: vi.fn(async (name: string, data: Uint8Array | string, mime) => {
        files.push({ name, data: String(data), mime });
      }),
    },
    saveMidi: vi.fn(async (_s, f: string) => void midi.push(f)),
    saveMusicXml: vi.fn(async (_s, f: string) => void xml.push(f)),
    saveTracker: vi.fn(async (_m, f: string) => void tracker.push(f)),
    saveAudio: vi.fn(async (_s, _r, _fmt, f: string) => void audio.push(f)),
  };
}

describe('exporting', () => {
  it('names the file after the score, not the document', async () => {
    const d = doc('String Quartet');
    // The document is called something else entirely; the music wins.
    const e = exporter();
    await exportDocument(d, e, 'midi');
    expect(e.midi).toEqual(['String Quartet.mid']);
  });

  it('follows a retitled score', async () => {
    const d = doc('String Quartet');
    d.store
      .getState()
      .dispatchCommand(
        changeMetadataCommand({ title: 'Wedding March' }, 'Retitle'),
      );
    const e = exporter();
    await exportDocument(d, e, 'musicxml');
    expect(e.xml).toEqual(['Wedding March.musicxml']);
  });

  it('keeps the title, replacing only reserved characters, never empty', async () => {
    // music_codecs' keep-the-title rule, shared with the web: no slugging.
    const e = exporter();
    await exportDocument(doc('Café / Night: Two'), e, 'midi');
    expect(e.midi).toEqual(['Café - Night- Two.mid']);
    const blank = exporter();
    await exportDocument(doc('  '), blank, 'midi');
    expect(blank.midi).toEqual(['Untitled.mid']);
  });
});

describe('the formats beyond notation', () => {
  it('writes a tracker module through music_io, not by hand', async () => {
    const d = doc('Jig');
    const e = exporter();
    await exportDocument(d, e, 'xm');
    expect(e.tracker).toEqual(['Jig.xm']);
  });

  it('refuses audio without a renderer rather than writing silence', async () => {
    /*
      Audio is the one format this app renders itself — a live synth in
      music_player, handed over as PCM — so a caller that forgot to supply one
      must fail loudly. Writing an empty file would look like a working export.
    */
    const d = doc('Jig');
    const e = exporter();
    await expect(exportDocument(d, e, 'wav')).rejects.toThrow(/renderer/i);
    expect(e.audio).toEqual([]);
  });

  it('hands the rendered samples to music_io to encode', async () => {
    const d = doc('Jig');
    const e = exporter();
    const render = vi.fn(async () => ({
      samples: new Float32Array([0, 1]),
      sampleRate: 44100,
    }));
    await exportDocument(d, e, 'wav', render);
    expect(render).toHaveBeenCalled();
    expect(e.audio).toEqual(['Jig.wav']);
  });
});

describe('the project file', () => {
  /*
    The web's export menu offers it and this app's did not: the formats are
    music_editing's list now. It is the `.moo` document this app opens, not the
    `json` the shared list still names, and it carries the document's title.
  */
  it('writes a .moo that opens back as the same document', async () => {
    const d = doc('Jig');
    const e = exporter();
    await exportDocument(d, e, 'project');
    expect(e.files).toHaveLength(1);
    expect(e.files[0]!.name).toBe('Jig.moo');
    const parsed = parseProjectFile(e.files[0]!.data);
    expect(parsed.title).toBe('file name');
    expect(parsed.score.metadata.title).toBe('Jig');
  });

  it('keeps hidden tracks, which only the other formats may leave out', async () => {
    const d = doc('Jig');
    const trackCount = d.store.getState().score!.tracks.length;
    const e = exporter();
    await exportDocument(d, e, 'project', undefined, 'visible');
    expect(parseProjectFile(e.files[0]!.data).score.tracks).toHaveLength(
      trackCount,
    );
  });
});
