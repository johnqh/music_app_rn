import { describe, expect, it, vi } from 'vitest';
import { DocumentList } from './document-list.js';
import {
  newDocument,
  openDocument,
  saveDocument,
  saveDocumentAs,
} from './document-storage.js';
import type { DocumentStorage } from './document-storage.js';
import { serializeDocument } from './document-file.js';
import {
  createEmptyScore,
  changeMetadataCommand,
} from '@sudobility/music_types';

function fakeStorage(files: Record<string, string> = {}) {
  const written: Record<string, string> = { ...files };
  const storage: DocumentStorage = {
    readText: async uri => {
      const text = written[uri];
      if (text === undefined) throw new Error(`No such file: ${uri}`);
      return text;
    },
    writeText: async (uri, text) => {
      written[uri] = text;
    },
    defaultDirectory: () => '/docs',
    join: (dir, name) => `${dir}/${name}`,
  };
  return { storage, written };
}

describe('opening', () => {
  it('reads a file into a document with a file origin', async () => {
    const score = createEmptyScore({ title: 'Song' });
    const { storage } = fakeStorage({
      '/docs/Song.moosiac': serializeDocument({ title: 'Song', score }),
    });
    const list = new DocumentList();
    const doc = await openDocument(list, storage, '/docs/Song.moosiac');
    expect(doc.title).toBe('Song');
    expect(doc.origin).toEqual({ kind: 'file', uri: '/docs/Song.moosiac' });
    expect(doc.dirty).toBe(false);
  });

  it('raises the open tab instead of opening a second copy', async () => {
    const score = createEmptyScore({ title: 'Song' });
    const { storage } = fakeStorage({
      '/docs/Song.moosiac': serializeDocument({ title: 'Song', score }),
    });
    const list = new DocumentList();
    const first = await openDocument(list, storage, '/docs/Song.moosiac');
    const again = await openDocument(list, storage, '/docs/Song.moosiac');
    expect(again.id).toBe(first.id);
    expect(list.state.documents).toHaveLength(1);
  });
});

describe('saving', () => {
  it('names an unsaved document from its title and adopts that file', async () => {
    const { storage, written } = fakeStorage();
    const list = new DocumentList();
    const doc = newDocument(
      list,
      createEmptyScore({ title: 'X' }),
      'Wedding March',
    );
    const uri = await saveDocument(doc, storage);
    expect(uri).toBe('/docs/Wedding March.moo');
    expect(written[uri]).toContain('Wedding March');
    expect(doc.origin).toEqual({ kind: 'file', uri });
    expect(doc.dirty).toBe(false);
  });

  it('writes back to the file it came from', async () => {
    const score = createEmptyScore({ title: 'Song' });
    const { storage, written } = fakeStorage({
      '/docs/Song.moosiac': serializeDocument({ title: 'Song', score }),
    });
    const list = new DocumentList();
    const doc = await openDocument(list, storage, '/docs/Song.moosiac');
    doc.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'Edited' }, 'Set title'));
    expect(doc.dirty).toBe(true);
    const uri = await saveDocument(doc, storage);
    expect(uri).toBe('/docs/Song.moosiac');
    expect(written[uri]).toContain('Edited');
    expect(doc.dirty).toBe(false);
  });

  it('leaves the document dirty when the write fails', async () => {
    const { storage } = fakeStorage();
    storage.writeText = vi.fn(async () => {
      throw new Error('disk full');
    });
    const list = new DocumentList();
    const doc = newDocument(list, createEmptyScore({ title: 'X' }), 'X');
    doc.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'Y' }, 'Set title'));
    await expect(saveDocument(doc, storage)).rejects.toThrow('disk full');
    // A document that looks safe to close after a failed save is how work is lost.
    expect(doc.dirty).toBe(true);
    expect(doc.origin.kind).toBe('unsaved');
  });
});

/*
  Save As is not Save with a path argument.

  `saveDocument` falls back to a default directory for a document that has never
  been written, which is what autosave needs and exactly what Save As must not
  do — the whole point of Save As is that a person is present to be asked.
*/
describe('saving somewhere chosen', () => {
  it('writes to the chosen path and adopts it as the origin', async () => {
    const { storage, written } = fakeStorage();
    const list = new DocumentList();
    const doc = newDocument(
      list,
      createEmptyScore({ title: 'X' }),
      'Wedding March',
    );

    const uri = await saveDocumentAs(doc, storage, '/elsewhere/Chosen.moosiac');

    expect(uri).toBe('/elsewhere/Chosen.moosiac');
    expect(written['/elsewhere/Chosen.moosiac']).toContain('"version":1');
    // Adopting the new path is what makes the *next* Save go there rather than
    // back to wherever the document came from.
    expect(doc.origin).toEqual({
      kind: 'file',
      uri: '/elsewhere/Chosen.moosiac',
    });
    expect(doc.dirty).toBe(false);
  });

  it('ignores the default directory entirely', async () => {
    const { storage, written } = fakeStorage();
    const list = new DocumentList();
    const doc = newDocument(
      list,
      createEmptyScore({ title: 'X' }),
      'Wedding March',
    );

    await saveDocumentAs(doc, storage, '/elsewhere/Chosen.moosiac');

    expect(written['/docs/Wedding March.moosiac']).toBeUndefined();
  });

  it('leaves the document dirty when the write fails', async () => {
    // Marking it clean before the write is how a failed save leaves a document
    // that looks safe to close.
    const { storage } = fakeStorage();
    storage.writeText = () => Promise.reject(new Error('disk full'));
    const list = new DocumentList();
    const doc = newDocument(
      list,
      createEmptyScore({ title: 'X' }),
      'Wedding March',
    );
    doc.dirty = true;

    await expect(
      saveDocumentAs(doc, storage, '/elsewhere/Chosen.moosiac'),
    ).rejects.toThrow('disk full');
    expect(doc.dirty).toBe(true);
    expect(doc.origin.kind).not.toBe('file');
  });

  it('tells the recent list only after the write landed', async () => {
    const { storage } = fakeStorage();
    const list = new DocumentList();
    const doc = newDocument(
      list,
      createEmptyScore({ title: 'X' }),
      'Wedding March',
    );
    const onSaved = vi.fn();

    await saveDocumentAs(doc, storage, '/elsewhere/Chosen.moosiac', onSaved);

    expect(onSaved).toHaveBeenCalledWith(doc);
  });
});
