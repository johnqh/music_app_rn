/**
 * This app's wiring of music_lib's document stores.
 *
 * The saving rules themselves are music_lib's and tested there. What is pinned
 * here is what this app hands them, and the two invariants a reader would lose
 * work over if the wiring were wrong:
 *
 * - **a freshly opened document is clean** — a document born dirty writes a file
 *   (or a project) the instant it opens, for a score nobody has touched;
 * - **a failed save leaves the document dirty** — one that looks clean after its
 *   write failed looks safe to close.
 *
 * And that opening reads the web's project export, which is why the native
 * `document-file.ts` could be deleted rather than taught a second shape.
 */
import { describe, expect, it, vi } from 'vitest';
import { serializeProjectFile } from '@sudobility/music_lib';
import type { DocumentFileStorage } from '@sudobility/music_lib';
import {
  changeMetadataCommand,
  createEmptyScore,
} from '@sudobility/music_types';
import { newDocument, openFile, sameOrigin } from './document.js';
import type { DocumentServices } from './document.js';

function services(files: Record<string, string> = {}) {
  const written: Record<string, string> = { ...files };
  const storage: DocumentFileStorage = {
    readText: async uri => {
      const text = written[uri];
      if (text === undefined) throw new Error(`No such file: ${uri}`);
      return text;
    },
    writeText: async (uri, text) => {
      written[uri] = text;
    },
  };
  const onSaved = vi.fn();
  const value: DocumentServices = { context: {}, files: storage, onSaved };
  return { services: value, written, onSaved, storage };
}

function edit(document: ReturnType<typeof newDocument>) {
  document.store
    .getState()
    .dispatchCommand(changeMetadataCommand({ title: 'Edited' }, 'Set title'));
}

describe('opening', () => {
  it('reads a .moo into a clean document with a file origin', async () => {
    const score = createEmptyScore({ title: 'Song' });
    const { services: s } = services({
      '/docs/Song.moo': serializeProjectFile({ title: 'Song', score }),
    });
    const document = await openFile(s, '/docs/Song.moo');
    const state = document.store.getState();
    expect(state.title).toBe('Song');
    expect(state.origin).toEqual({ kind: 'file', uri: '/docs/Song.moo' });
    expect(state.dirty).toBe(false);
  });

  it("reads the web app's project export too", async () => {
    // `{ name, schemaVersion, score }` — what the browser writes. A score
    // exported there has to open on a phone.
    const score = createEmptyScore({ title: 'From the web' });
    const { services: s } = services({
      '/docs/web.json': JSON.stringify({
        name: 'Web Project',
        schemaVersion: 1,
        score,
      }),
    });
    const document = await openFile(s, '/docs/web.json');
    expect(document.store.getState().title).toBe('Web Project');
  });

  it('refuses a file from a newer format rather than reading it hopefully', async () => {
    const { services: s } = services({
      '/docs/new.moo': JSON.stringify({
        version: 99,
        title: 'Future',
        score: createEmptyScore({ title: 'Future' }),
      }),
    });
    await expect(openFile(s, '/docs/new.moo')).rejects.toThrow();
  });

  it('gives every document its own store and its own tab id', () => {
    const { services: s } = services();
    const score = createEmptyScore({ title: 'X' });
    const a = newDocument(s, { score, title: 'A' });
    const b = newDocument(s, { score, title: 'B' });
    expect(a.id).not.toBe(b.id);
    expect(a.store).not.toBe(b.store);
  });
});

describe('saving', () => {
  it('writes a file document back to its file and says so', async () => {
    const {
      services: s,
      written,
      onSaved,
    } = services({
      '/docs/Song.moo': serializeProjectFile({
        title: 'Song',
        score: createEmptyScore({ title: 'Song' }),
      }),
    });
    const document = await openFile(s, '/docs/Song.moo');
    edit(document);
    expect(document.store.getState().dirty).toBe(true);
    await document.store.getState().saveNow();
    expect(document.store.getState().dirty).toBe(false);
    expect(JSON.parse(written['/docs/Song.moo']!).score.metadata.title).toBe(
      'Edited',
    );
    // The recent list is fed from here, after the write and never before.
    expect(onSaved).toHaveBeenCalledWith({
      origin: { kind: 'file', uri: '/docs/Song.moo' },
      title: 'Song',
    });
    document.store.getState().dispose();
  });

  it('leaves the document dirty when the write fails', async () => {
    const { services: s, storage } = services();
    const document = newDocument(s, {
      score: createEmptyScore({ title: 'X' }),
      title: 'X',
    });
    storage.writeText = async () => {
      throw new Error('disk full');
    };
    await expect(
      document.store.getState().saveAs('/docs/X.moo'),
    ).rejects.toThrow('disk full');
    expect(document.store.getState().dirty).toBe(true);
    document.store.getState().dispose();
  });

  it('never picks a place for a document that has never been saved', async () => {
    // Choosing where a new score lives is the reader's decision.
    const { services: s, written } = services();
    const document = newDocument(s, {
      score: createEmptyScore({ title: 'X' }),
      title: 'X',
    });
    edit(document);
    await document.store.getState().saveNow();
    expect(written).toEqual({});
    expect(document.store.getState().dirty).toBe(true);
    document.store.getState().dispose();
  });
});

describe('sameOrigin', () => {
  it('matches files by uri and projects by id, and never two unsaved documents', () => {
    expect(
      sameOrigin({ kind: 'file', uri: '/a' }, { kind: 'file', uri: '/a' }),
    ).toBe(true);
    expect(
      sameOrigin(
        { kind: 'project', projectId: 'p' },
        { kind: 'file', uri: 'p' },
      ),
    ).toBe(false);
    expect(sameOrigin({ kind: 'unsaved' }, { kind: 'unsaved' })).toBe(false);
  });
});
