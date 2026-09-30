import { describe, expect, it, vi } from 'vitest';
import { createDocumentStore } from '@sudobility/music_lib';
import type { DocumentOrigin } from '@sudobility/music_lib';
import {
  changeMetadataCommand,
  createEmptyScore,
  MusicPosition,
} from '@sudobility/music_types';
import { asDocument } from './document.js';
import { DocumentList, pauseLeavingDocument } from './document-list.js';

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

  it('names the tab leaving the front, including one that closed', () => {
    const position = new MusicPosition();
    const leaveFront = vi.fn();
    const list = new DocumentList({ position: () => position, leaveFront });
    const a = list.open(doc('A'));
    expect(leaveFront).not.toHaveBeenCalled();
    const b = list.open(doc('B'));
    list.close(b.id);
    expect(leaveFront).toHaveBeenCalledTimes(2);
    expect(leaveFront.mock.calls[0]![0]).toBe(a);
    expect(leaveFront.mock.calls[1]![0]).toBe(b);
    expect(list.activeId).toBe(a.id);
  });

  it('pauses a playing tab that is closed before restoring the next one', () => {
    /*
      Closing the tab in front mid-playback is a front change too. Named as
      null, the composition root had nothing to pause, so the music went on
      under the fallback tab and the pause its editor's unmount made later
      reported the closed tab's position over the caret just restored.
    */
    const position = new MusicPosition();
    const paused: string[] = [];
    const list = new DocumentList({
      position: () => position,
      leaveFront: leaving => {
        if (leaving?.store.getState().title !== 'B') return;
        paused.push('B');
        position.moveTo(5000); // the transport reports where it paused
      },
    });
    const a = list.open(doc('A'));
    position.moveTo(240);
    const b = list.open(doc('B'));
    position.moveTo(4800);
    list.close(b.id);
    expect(paused).toEqual(['B']);
    expect(list.activeId).toBe(a.id);
    // The pause landed before A's caret came back, not over it.
    expect(position.tick).toBe(240);
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

/*
  A tab brought back to the front opened scrolled to the top, even when its
  restored caret was pages further down. The list keeps each document's scroll
  offset beside its caret — view state, banked when the score view goes away.
*/
describe('scroll offsets', () => {
  it('has none for a document never scrolled', () => {
    const { list } = listWithCaret();
    const a = list.open(doc('A'));
    expect(list.scrollOffset(a.id)).toBeNull();
  });

  it('keeps the offset a document left at', () => {
    const { list } = listWithCaret();
    const a = list.open(doc('A'));
    const b = list.open(doc('B'));
    list.bankScroll(a.id, { left: 0, top: 840 });
    list.bankScroll(b.id, { left: 120, top: 0 });
    expect(list.scrollOffset(a.id)).toEqual({ left: 0, top: 840 });
    expect(list.scrollOffset(b.id)).toEqual({ left: 120, top: 0 });
  });

  it('forgets a closed document, and ignores a view banking one', () => {
    /*
      A tab's view unmounts *after* the list has closed it, so its last bank
      arrives for a document that is gone; keeping it would hold an entry
      nothing can ever read.
    */
    const { list } = listWithCaret();
    const a = list.open(doc('A'));
    list.open(doc('B'));
    list.bankScroll(a.id, { left: 0, top: 840 });
    list.close(a.id);
    expect(list.scrollOffset(a.id)).toBeNull();
    list.bankScroll(a.id, { left: 0, top: 900 });
    expect(list.scrollOffset(a.id)).toBeNull();
  });
});

describe('leaving a playing tab', () => {
  /** The transport, as much of it as leaving the front touches. */
  function player() {
    return { pause: vi.fn(), stop: vi.fn() };
  }

  it('pauses the music — it never stops it, which would home the caret', () => {
    /*
      `stop()` sends the playhead to bar 1 and reports it, so the tab left
      behind came back at 1.1 / 0:00.0 with the music it was playing thrown
      away. Pausing leaves the position alone for the list to bank.
    */
    const transport = player();
    const position = new MusicPosition();
    const list = new DocumentList({
      position: () => position,
      leaveFront: leaving => pauseLeavingDocument(transport, leaving),
    });
    const playing = list.open(doc('Playing'));
    playing.store.setState(state => {
      state.state = 'playing';
    });
    position.moveTo(12703);

    list.open(doc('Other'));
    expect(transport.pause).toHaveBeenCalledTimes(1);
    expect(transport.stop).not.toHaveBeenCalled();
    // The arriving tab has its own caret, and the leaving one's is banked.
    expect(position.tick).toBe(0);
    list.activate(playing.id);
    expect(position.tick).toBe(12703);
  });

  it('leaves a tab that is not the one sounding alone', () => {
    /*
      The player is app-wide and the engine's pause reports "paused" from a
      stopped transport too, so pausing unconditionally would mark a tab that
      was only ever sitting there as paused.
    */
    const transport = player();
    const position = new MusicPosition();
    const list = new DocumentList({
      position: () => position,
      leaveFront: leaving => pauseLeavingDocument(transport, leaving),
    });
    list.open(doc('Idle'));
    list.open(doc('Other'));
    expect(transport.pause).not.toHaveBeenCalled();
  });

  it('pauses a playing tab that is closed, not only one put behind', () => {
    const transport = player();
    const position = new MusicPosition();
    const list = new DocumentList({
      position: () => position,
      leaveFront: leaving => pauseLeavingDocument(transport, leaving),
    });
    list.open(doc('Kept'));
    const closing = list.open(doc('Closing'));
    closing.store.setState(state => {
      state.state = 'playing';
    });
    list.close(closing.id);
    expect(transport.pause).toHaveBeenCalledTimes(1);
    expect(transport.stop).not.toHaveBeenCalled();
  });
});

describe('DocumentList, one document at a time', () => {
  function single() {
    const position = new MusicPosition();
    const detached: string[] = [];
    const list = new DocumentList({
      single: true,
      position: () => position,
      attach: document => () => detached.push(document.id),
    });
    return { list, position, detached };
  }

  it('closes the document that was open when another opens', () => {
    const { list, detached } = single();
    const a = list.open(doc('A'));
    const b = list.open(doc('B'));
    expect(list.openDocuments.map(d => d.id)).toEqual([b.id]);
    expect(list.activeId).toBe(b.id);
    // Closed as `close` closes: detached, so nothing goes on writing to it.
    expect(detached).toEqual([a.id]);
  });

  it('keeps the one already open when it is opened again', () => {
    // Raising what is open is not opening something else, by either route:
    // the same document handed back, or another copy of the same file.
    const { list, detached } = single();
    const song = list.open(
      doc('Song', { kind: 'file', uri: 'file:///song.moo' }),
    );
    list.open(song);
    list.open(doc('Song', { kind: 'file', uri: 'file:///song.moo' }));
    expect(list.openDocuments.map(d => d.id)).toEqual([song.id]);
    expect(detached).toEqual([]);
  });

  it("opens the new document at its own caret, not the closed one's", () => {
    const { list, position } = single();
    list.open(doc('A'));
    position.moveTo(960);
    list.open(doc('B'));
    expect(position.tick).toBe(0);
  });

  it('still holds several where it was not asked to hold one', () => {
    const { list } = listWithCaret();
    list.open(doc('A'));
    list.open(doc('B'));
    expect(list.openDocuments).toHaveLength(2);
  });
});
