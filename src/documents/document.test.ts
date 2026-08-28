/**
 * An open document: one score, one editing store, one file it came from.
 *
 * The invariant worth guarding is that **a freshly opened document is clean**:
 * a document born dirty makes its owner write a file (or POST a project) the
 * instant it is opened, for a score nobody has touched. Nothing throws when
 * that regresses; it just saves constantly.
 *
 * Three things turn out to be distinct, and the tests pin all three, because
 * only the middle one should schedule a save:
 *
 *   - *adopting* a score (`setScore`) reports nothing — it is how a document is
 *     opened, not an edit of it;
 *   - a content edit reports, since that is how the owner learns to save;
 *   - a *view* preference like zoom reports nothing, because where the reader
 *     has scrolled to is not a change to the music.
 *
 * One note for whoever edits `createDocument`: the explicit
 * `document.dirty = false` after the adopting `setScore` is currently
 * belt-and-braces, not load-bearing. Measured by deleting it — every test here
 * still passes, because `setScore` does not invoke `onChanged` at all, so the
 * flag was never set in the first place. It is worth keeping as insurance
 * should adoption ever start reporting, but do not read its presence as proof
 * that it is tested: what these tests actually pin is the *observable*
 * invariant (a new document is clean), which fails loudly if the flag is ever
 * left true.
 */
import { describe, expect, it, vi } from 'vitest';
import { createEmptyScore } from '@sudobility/music_types';
import { createDocument, markSaved, setDocumentOrigin } from './document.js';

function open(overrides: Partial<Parameters<typeof createDocument>[0]> = {}) {
  return createDocument({
    id: 'doc-1',
    title: 'Test',
    score: createEmptyScore({ title: 'Test', measures: 4 }),
    ...overrides,
  });
}

describe('createDocument', () => {
  it('is clean on open, despite adopting a score through setScore', () => {
    expect(open().dirty).toBe(false);
  });

  it('holds the score it was opened with', () => {
    const document = open();
    expect(document.store.getState().score).toBeDefined();
    expect(document.id).toBe('doc-1');
    expect(document.title).toBe('Test');
  });

  it('defaults to an unsaved origin', () => {
    // A document with nowhere to write to must say so, or "save" silently
    // becomes "save somewhere arbitrary".
    expect(open().origin).toEqual({ kind: 'unsaved' });
  });

  it('gives each document its own store', () => {
    // Per-document rather than app-wide is what lets the native app edit
    // several at once; a shared store would make two tabs one score.
    const a = open({ id: 'a' });
    const b = open({ id: 'b' });
    expect(a.store).not.toBe(b.store);
  });
});

describe('change reporting', () => {
  it('marks the document dirty once the score is edited', () => {
    const document = open();
    expect(document.dirty).toBe(false);
    document.store
      .getState()
      .setScoreMetadata({ title: 'Edited' }, 'Rename score');
    expect(document.dirty).toBe(true);
  });

  it('tells the owner, so a save can be scheduled', () => {
    const onChanged = vi.fn();
    const document = open({ onChanged });
    // Opening reports nothing at all: adoption is not an edit.
    expect(onChanged).not.toHaveBeenCalled();
    document.store
      .getState()
      .setScoreMetadata({ title: 'Edited' }, 'Rename score');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenLastCalledWith(document);
  });

  it('does not report adopting a score', () => {
    // Replacing the score outright — opening a snapshot, taking a generation
    // result — is an adoption. Reporting it would mark a document dirty for
    // music it had just been handed.
    const onChanged = vi.fn();
    const document = open({ onChanged });
    document.store
      .getState()
      .setScore(createEmptyScore({ title: 'Other', measures: 8 }));
    expect(onChanged).not.toHaveBeenCalled();
    expect(document.dirty).toBe(false);
  });

  it('does not report a view preference such as zoom', () => {
    // Zoom is where the reader is looking, not what the music says; dirtying on
    // it would have every scroll and pinch queue a save.
    const onChanged = vi.fn();
    const document = open({ onChanged });
    document.store.getState().setZoom(2);
    expect(onChanged).not.toHaveBeenCalled();
    expect(document.dirty).toBe(false);
  });
});

describe('markSaved', () => {
  it('clears dirty', () => {
    const document = open();
    document.store
      .getState()
      .setScoreMetadata({ title: 'Edited' }, 'Rename score');
    expect(document.dirty).toBe(true);
    markSaved(document);
    expect(document.dirty).toBe(false);
  });

  it('records where the bytes went, when given somewhere', () => {
    const document = open();
    markSaved(document, { kind: 'file', uri: 'file:///tmp/a.mid' });
    expect(document.origin).toEqual({ kind: 'file', uri: 'file:///tmp/a.mid' });
  });

  it('leaves the origin alone when not given one', () => {
    const document = open({ origin: { kind: 'file', uri: 'file:///a' } });
    markSaved(document);
    expect(document.origin).toEqual({ kind: 'file', uri: 'file:///a' });
  });
});

describe('setDocumentOrigin', () => {
  it('changes the destination without disturbing the document', () => {
    // "Sync to server" turns a local document into a project in place: the
    // identity, the store and therefore the undo history all survive, because
    // only where it writes to changed.
    const document = open({ origin: { kind: 'file', uri: 'file:///a' } });
    const store = document.store;
    setDocumentOrigin(document, { kind: 'project', projectId: 'p1' });
    expect(document.origin).toEqual({ kind: 'project', projectId: 'p1' });
    expect(document.store).toBe(store);
    expect(document.id).toBe('doc-1');
  });
});
