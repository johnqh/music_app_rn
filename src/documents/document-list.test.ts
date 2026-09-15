import { describe, expect, it, vi } from 'vitest';
import { createDocumentStore } from '@sudobility/music_lib';
import type { DocumentOrigin } from '@sudobility/music_lib';
import {
  changeMetadataCommand,
  createEmptyScore,
  MusicPosition,
} from '@sudobility/music_types';
import { asDocument } from './document.js';
import { DocumentList } from './document-list.js';

let n = 0;
function doc(title: string, origin?: DocumentOrigin) {
  n += 1;
  return asDocument(
    createDocumentStore({
      title,
      score: createEmptyScore({ title }),
      ...(origin ? { origin } : {}),
      files: {
        readText: async () => '',
        writeText: async () => undefined,
      },
    }),
    `doc-${n}`,
  );
}

/** A list over a playhead of its own, so no test inherits another's caret. */
function listWithCaret() {
  const position = new MusicPosition();
  const list = new DocumentList({ position: () => position });
  return { list, position };
}

describe('DocumentList', () => {
  it('keeps one document active without storing which', () => {
    const { list } = listWithCaret();
    const a = list.open(doc('A'));
    expect(list.activeId).toBe(a.id);
    const b = list.open(doc('B'));
    expect(list.activeId).toBe(b.id);
    // Closing the active one must not need a reconciliation step.
    list.close(b.id);
    expect(list.activeId).toBe(a.id);
    expect(list.active?.store.getState().title).toBe('A');
  });

  it('is empty-safe', () => {
    const { list } = listWithCaret();
    expect(list.activeId).toBeNull();
    expect(list.active).toBeNull();
  });

  it('raises the tab already holding a file rather than opening it twice', () => {
    const { list } = listWithCaret();
    const first = list.open(
      doc('Song', { kind: 'file', uri: 'file:///song.moo' }),
    );
    list.open(doc('Other'));
    const again = list.open(
      doc('Song', { kind: 'file', uri: 'file:///song.moo' }),
    );
    expect(again.id).toBe(first.id);
    expect(list.state.documents).toHaveLength(2);
    expect(list.activeId).toBe(first.id);
  });

  it('disposes the duplicate it turned away, so it cannot save over the one kept', () => {
    const { list } = listWithCaret();
    list.open(doc('Song', { kind: 'project', projectId: 'p1' }));
    const duplicate = doc('Song', { kind: 'project', projectId: 'p1' });
    const dispose = vi.spyOn(duplicate.store.getState(), 'dispose');
    list.open(duplicate);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('opens two unsaved documents as two documents', () => {
    const { list } = listWithCaret();
    list.open(doc('Untitled'));
    list.open(doc('Untitled'));
    expect(list.state.documents).toHaveLength(2);
  });

  it('notifies on open, close and activate', () => {
    const { list } = listWithCaret();
    const listener = vi.fn();
    list.subscribe(listener);
    const a = list.open(doc('A'));
    const b = list.open(doc('B'));
    list.activate(a.id);
    list.close(b.id);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('lists what is dirty from the stores themselves', () => {
    const { list } = listWithCaret();
    const a = list.open(doc('A'));
    list.open(doc('B'));
    expect(list.unsaved).toEqual([]);
    a.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'New' }, 'Set title'));
    expect(list.unsaved.map(d => d.id)).toEqual([a.id]);
  });
});

describe("a document's lifetime", () => {
  it('attaches on open and detaches and disposes on close', () => {
    const detach = vi.fn();
    const attach = vi.fn(() => detach);
    const position = new MusicPosition();
    const list = new DocumentList({ attach, position: () => position });
    const a = list.open(doc('A'));
    expect(attach).toHaveBeenCalledWith(a);
    const dispose = vi.spyOn(a.store.getState(), 'dispose');
    list.close(a.id);
    expect(detach).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('does not attach twice when the same document is opened again', () => {
    const attach = vi.fn();
    const position = new MusicPosition();
    const list = new DocumentList({ attach, position: () => position });
    const a = doc('A');
    list.open(a);
    list.open(a);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('flushes every open document', async () => {
    const { list } = listWithCaret();
    const a = list.open(doc('A'));
    const b = list.open(doc('B'));
    const saveA = vi.spyOn(a.store.getState(), 'saveNow');
    const saveB = vi
      .spyOn(b.store.getState(), 'saveNow')
      .mockRejectedValue(new Error('disk full'));
    await expect(list.flushAll()).resolves.toBeUndefined();
    // One failure does not stop the other document being written.
    expect(saveA).toHaveBeenCalledTimes(1);
    expect(saveB).toHaveBeenCalledTimes(1);
  });
});

describe('the caret, per tab', () => {
  it('puts a freshly opened document at the start', () => {
    const { list, position } = listWithCaret();
    list.open(doc('A'));
    position.moveTo(960);
    list.open(doc('B'));
    expect(position.tick).toBe(0);
  });

  it("restores each tab's caret when it comes back to the front", () => {
    const { list, position } = listWithCaret();
    const a = list.open(doc('A'));
    position.moveTo(960);
    const b = list.open(doc('B'));
    position.moveTo(480);
    list.activate(a.id);
    expect(position.tick).toBe(960);
    list.activate(b.id);
    expect(position.tick).toBe(480);
  });

  it('leaves the caret alone when the front does not change', () => {
    const { list, position } = listWithCaret();
    const a = list.open(doc('A'));
    position.moveTo(720);
    list.activate(a.id);
    list.open(a);
    expect(position.tick).toBe(720);
  });

  it('restores the fallback document when the one in front closes', () => {
    const { list, position } = listWithCaret();
    const a = list.open(doc('A'));
    position.moveTo(240);
    const b = list.open(doc('B'));
    position.moveTo(1920);
    list.close(b.id);
    expect(list.activeId).toBe(a.id);
    expect(position.tick).toBe(240);
  });

  it('pauses the transport before banking the leaving tab, so its caret is where the music was', () => {
    /*
      A tab can go behind another mid-playback. Pausing after the swap would
      report the paused position over the caret just restored for the arriving
      tab; pausing first banks exactly where the music stopped.
    */
    const position = new MusicPosition();
    const events: string[] = [];
    const list = new DocumentList({
      position: () => position,
      leaveFront: () => {
        events.push(`pause@${position.tick}`);
        position.moveTo(1000); // the transport reports where it paused
      },
    });
    const a = list.open(doc('A'));
    position.moveTo(900);
    list.open(doc('B'));
    expect(events).toEqual(['pause@900']);
    expect(position.tick).toBe(0);
    list.activate(a.id);
    expect(position.tick).toBe(1000);
  });

  it('names the tab leaving the front, or null for one that closed', () => {
    const position = new MusicPosition();
    const leaveFront = vi.fn();
    const list = new DocumentList({ position: () => position, leaveFront });
    const a = list.open(doc('A'));
    expect(leaveFront).not.toHaveBeenCalled();
    list.open(doc('B'));
    list.close(list.activeId!);
    expect(leaveFront).toHaveBeenCalledTimes(2);
    expect(leaveFront.mock.calls[0]![0]).toBe(a);
    expect(leaveFront.mock.calls[1]![0]).toBeNull();
    expect(list.activeId).toBe(a.id);
  });

  it('does not move the caret for a document opened behind the front', () => {
    // Raising the tab that already holds a file is a front change like any
    // other; opening it counts only when it actually comes forward.
    const { list, position } = listWithCaret();
    const song = list.open(doc('Song', { kind: 'file', uri: 'file:///s' }));
    position.moveTo(600);
    list.open(doc('Other'));
    list.open(doc('Song', { kind: 'file', uri: 'file:///s' }));
    expect(list.activeId).toBe(song.id);
    expect(position.tick).toBe(600);
  });
});

describe('a document', () => {
  it('starts clean and goes dirty on the first edit', () => {
    const d = doc('Piece');
    expect(d.store.getState().dirty).toBe(false);
    d.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'New' }, 'Set title'));
    expect(d.store.getState().dirty).toBe(true);
  });

  it('gives each document an independent store', () => {
    const a = doc('A');
    const b = doc('B');
    a.store
      .getState()
      .dispatchCommand(changeMetadataCommand({ title: 'Only A' }, 'Set title'));
    expect(a.store.getState().score?.metadata.title).toBe('Only A');
    expect(b.store.getState().score?.metadata.title).not.toBe('Only A');
    expect(b.store.getState().dirty).toBe(false);
  });
});

describe('snapshot stability', () => {
  it('returns the same array until something actually changes', () => {
    const { list } = listWithCaret();
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
