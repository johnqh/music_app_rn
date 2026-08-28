import { describe, expect, it, vi } from 'vitest';
import { createDocument } from './document.js';
import { DocumentList } from './document-list.js';
import {
  createEmptyScore,
  changeMetadataCommand,
} from '@sudobility/music_types';

let n = 0;
function doc(
  title: string,
  origin?: Parameters<typeof createDocument>[0]['origin'],
) {
  n += 1;
  return createDocument({
    id: `doc-${n}`,
    title,
    score: createEmptyScore({ title }),
    ...(origin ? { origin } : {}),
  });
}

describe('DocumentList', () => {
  it('keeps one document active without storing which', () => {
    const list = new DocumentList();
    const a = list.open(doc('A'));
    expect(list.activeId).toBe(a.id);
    const b = list.open(doc('B'));
    expect(list.activeId).toBe(b.id);
    // Closing the active one must not need a reconciliation step.
    list.close(b.id);
    expect(list.activeId).toBe(a.id);
    expect(list.active?.title).toBe('A');
  });

  it('is empty-safe', () => {
    const list = new DocumentList();
    expect(list.activeId).toBeNull();
    expect(list.active).toBeNull();
  });

  it('raises the tab already holding a file rather than opening it twice', () => {
    const list = new DocumentList();
    const first = list.open(
      doc('Song', { kind: 'file', uri: 'file:///song.moosiac' }),
    );
    list.open(doc('Other'));
    const again = list.open(
      doc('Song', { kind: 'file', uri: 'file:///song.moosiac' }),
    );
    expect(again.id).toBe(first.id);
    expect(list.state.documents).toHaveLength(2);
    expect(list.activeId).toBe(first.id);
  });

  it('opens two unsaved documents as two documents', () => {
    const list = new DocumentList();
    list.open(doc('Untitled'));
    list.open(doc('Untitled'));
    expect(list.state.documents).toHaveLength(2);
  });

  it('notifies on open, close and activate', () => {
    const list = new DocumentList();
    const listener = vi.fn();
    list.subscribe(listener);
    const a = list.open(doc('A'));
    const b = list.open(doc('B'));
    list.activate(a.id);
    list.close(b.id);
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe('a document', () => {
  it('starts clean and goes dirty on the first edit', () => {
    const changed = vi.fn();
    const d = createDocument({
      id: 'd1',
      title: 'Piece',
      score: createEmptyScore({ title: 'Piece' }),
      onChanged: changed,
    });
    expect(d.dirty).toBe(false);
    d.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'New' }, 'Set title'));
    expect(d.dirty).toBe(true);
    expect(changed).toHaveBeenCalledWith(d);
  });

  it('gives each document an independent store', () => {
    const a = doc('A');
    const b = doc('B');
    a.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'Only A' }, 'Set title'));
    expect(a.store.getState().score?.metadata.title).toBe('Only A');
    expect(b.store.getState().score?.metadata.title).not.toBe('Only A');
    expect(b.dirty).toBe(false);
  });
});

describe('opening the same document twice', () => {
  it('brings it forward rather than stacking a duplicate', () => {
    const list = new DocumentList();
    const a = doc('A');
    list.open(a);
    list.open(doc('B'));
    const again = list.open(a);
    expect(again.id).toBe(a.id);
    expect(list.state.documents).toHaveLength(2);
    expect(list.activeId).toBe(a.id);
  });
});

describe('snapshot stability', () => {
  it('returns the same array until something actually changes', () => {
    const list = new DocumentList();
    const a = list.open(doc('A'));
    const first = list.openDocuments;
    // Reading twice must give the same reference: `useSyncExternalStore`
    // compares snapshots by identity, and a fresh array per read loops forever.
    expect(list.openDocuments).toBe(first);
    list.activate(a.id);
    expect(list.openDocuments).toBe(first);
    list.open(doc('B'));
    expect(list.openDocuments).not.toBe(first);
  });
});
