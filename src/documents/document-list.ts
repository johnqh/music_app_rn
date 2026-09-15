/**
 * The documents that are open, and which one is in front.
 *
 * A plain observable rather than a zustand store, because it holds documents
 * whose own stores are zustand — nesting one inside another makes every score
 * edit look like a change to the list. The list changes when a document opens,
 * closes or comes to the front, which is rare; the score changes constantly.
 *
 * `activeId` falls back to the first document whenever it names one that is not
 * open, so "one document is active" and "the active document was closed" need
 * no reconciliation step — the same rule music_editing's `selectActiveTrackId`
 * follows, for the same reason.
 *
 * **The list owns a document's lifetime.** What is attached when a document
 * opens — the device prefs mirrored into its store — is detached when it
 * closes, and the store's saver is disposed with it. A document that closed
 * but kept a subscription to the prefs store would be written to forever by a
 * store nobody can see; one that kept its debounce timer would save a tab that
 * no longer exists.
 *
 * **Each document keeps its own caret.** There is one playback position — only
 * one transport plays at a time, so there is only ever one playhead to disagree
 * about — and it belongs to the document in front. music_lib's stores are
 * therefore built *not* to move it when they open (`resetPosition` false):
 * opening a document into a tab used to send the caret of whatever the reader
 * was looking at back to bar 1. The list is what knows which document is in
 * front, so it banks the leaving document's tick and puts the arriving one's
 * back — or bar 1, for a document that has never been in front.
 */
import { getMusicPositionSource } from '@sudobility/music_types';
import type { DocumentOrigin } from '@sudobility/music_lib';
import { sameOrigin } from './document';
import type { MusicDocument } from './document';

export type DocumentListState = {
  documents: readonly MusicDocument[];
  activeId: string | null;
};

export type Unsubscribe = () => void;

/** The shared playhead, as far as swapping tabs needs one. */
export type CaretPosition = {
  readonly tick: number;
  moveTo(tick: number): void;
};

export type DocumentListOptions = {
  /**
   * Called once when a document opens; the returned function runs when it
   * closes. The composition root mirrors device prefs into each store here.
   */
  attach?: (document: MusicDocument) => (() => void) | void;
  /** The playhead. Defaults to music_types' singleton; tests pass their own. */
  position?: () => CaretPosition;
  /**
   * Called when a document stops being the one in front, **before** its caret
   * is banked — `null` when it was the one just closed. The composition root
   * pauses the transport here, if that document is the one playing.
   *
   * A tab put behind another mid-playback would otherwise go on playing under
   * a tab that does not show it — and pausing any later (when its editor
   * unmounts) reports the paused position over the caret just restored for the
   * arriving tab. Pausing first means the banked caret is where the music
   * stopped, and the pause is still mirrored into the leaving store, so it is
   * not left locked as "playing" for when it comes back.
   */
  leaveFront?: (document: MusicDocument | null) => void;
};

export class DocumentList {
  private documents: MusicDocument[] = [];
  private requestedActiveId: string | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly detach = new Map<string, () => void>();
  /** Where each document's caret was when it last left the front. */
  private readonly carets = new Map<string, number>();
  private front: string | null = null;
  private readonly options: DocumentListOptions;

  constructor(options: DocumentListOptions = {}) {
    this.options = options;
  }

  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.swapCaret();
    for (const listener of this.listeners) listener();
  }

  private position(): CaretPosition {
    return this.options.position?.() ?? getMusicPositionSource();
  }

  /**
   * Banks the leaving document's caret and restores the arriving one's.
   *
   * Run on every change rather than in `activate` alone, because the front
   * also changes when the document in front closes and the fallback takes its
   * place — that document's caret has to come back too.
   */
  private swapCaret(): void {
    const next = this.activeId;
    if (next === this.front) return;
    if (this.front !== null) {
      const leaving = this.documents.find(d => d.id === this.front) ?? null;
      this.options.leaveFront?.(leaving);
    }
    const position = this.position();
    if (this.front !== null && this.documents.some(d => d.id === this.front)) {
      this.carets.set(this.front, position.tick);
    }
    this.front = next;
    if (next !== null) position.moveTo(this.carets.get(next) ?? 0);
  }

  /**
   * The open documents, as a **stable** reference.
   *
   * Not a copy. `useSyncExternalStore` compares snapshots by identity and
   * re-renders whenever they differ — so a getter that copied the array would
   * hand back a new one every render and loop forever. That is not theoretical:
   * it took the app down with "Maximum update depth exceeded" the first time it
   * ran. The array is replaced (never mutated) on every change, so its identity
   * is already the honest signal.
   */
  get openDocuments(): readonly MusicDocument[] {
    return this.documents;
  }

  /** A snapshot for callers that want both halves at once. Copies; do not use as a hook snapshot. */
  get state(): DocumentListState {
    return { documents: this.openDocuments, activeId: this.activeId };
  }

  /** The document in front, resolved rather than stored. */
  get activeId(): string | null {
    const requested = this.requestedActiveId;
    if (requested && this.documents.some(d => d.id === requested))
      return requested;
    return this.documents[0]?.id ?? null;
  }

  get active(): MusicDocument | null {
    const id = this.activeId;
    return this.documents.find(d => d.id === id) ?? null;
  }

  /** The open document living at `origin`, if any. Never an unsaved one. */
  findOpen(origin: DocumentOrigin): MusicDocument | null {
    return (
      this.documents.find(d => sameOrigin(d.store.getState().origin, origin)) ??
      null
    );
  }

  /**
   * Opens a document, or brings an already-open one forward.
   *
   * Matching on origin, not on id: opening the same file twice should raise the
   * tab that already holds it rather than making a second, divergent copy that
   * both write to the same path. The turned-away store is disposed, so the copy
   * that lost cannot save over the one that won.
   */
  open(document: MusicDocument): MusicDocument {
    // The same document object twice is a no-op that brings it forward. An
    // unsaved document has no origin to match on, so without this an idempotent
    // "open this" would quietly stack duplicates of one score.
    if (this.documents.some(d => d.id === document.id)) {
      this.requestedActiveId = document.id;
      this.changed();
      return document;
    }
    const existing = this.findOpen(document.store.getState().origin);
    if (existing) {
      if (existing.store !== document.store)
        document.store.getState().dispose();
      this.requestedActiveId = existing.id;
      this.changed();
      return existing;
    }
    this.documents = [...this.documents, document];
    const detach = this.options.attach?.(document);
    if (detach) this.detach.set(document.id, detach);
    this.requestedActiveId = document.id;
    this.changed();
    return document;
  }

  /**
   * Closes a document without asking. Callers ask first — `decideClose` from
   * music_editing — because only they have a person to ask.
   */
  close(id: string): void {
    const closing = this.documents.find(d => d.id === id);
    if (!closing) return;
    this.documents = this.documents.filter(d => d.id !== id);
    this.detach.get(id)?.();
    this.detach.delete(id);
    this.carets.delete(id);
    closing.store.getState().dispose();
    this.changed();
  }

  activate(id: string): void {
    if (!this.documents.some(d => d.id === id)) return;
    this.requestedActiveId = id;
    this.changed();
  }

  /** Every document with unwritten changes — what a quit prompt has to ask about. */
  get unsaved(): readonly MusicDocument[] {
    return this.documents.filter(d => d.store.getState().dirty);
  }

  /**
   * Writes every open document's pending work now.
   *
   * For the app leaving the foreground: a phone may kill a backgrounded app
   * without another word, and the debounce would otherwise be the window in
   * which the last edit exists only in memory. A failure in one document does
   * not stop the others; each store reports its own through its toast sink.
   */
  async flushAll(): Promise<void> {
    await Promise.allSettled(
      this.documents.map(d => d.store.getState().saveNow()),
    );
  }
}
