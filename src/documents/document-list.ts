/**
 * The documents that are open, and which one is in front.
 *
 * A plain observable rather than a zustand store, because it holds documents
 * whose own stores are zustand — nesting one inside another makes every score
 * edit look like a change to the list. The list changes when a document opens,
 * closes or is renamed, which is rare; the score changes constantly.
 *
 * `activeId` falls back to the first document whenever it names one that is not
 * open, so "one document is active" and "the active document was closed" need
 * no reconciliation step — the same rule music_lib's `selectActiveTrackId`
 * follows, for the same reason.
 */
import type { MusicDocument } from './document.js';

export type DocumentListState = {
  documents: readonly MusicDocument[];
  activeId: string | null;
};

export type Unsubscribe = () => void;

export class DocumentList {
  private documents: MusicDocument[] = [];
  private requestedActiveId: string | null = null;
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
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

  /**
   * Opens a document, or brings an already-open one forward.
   *
   * Matching on origin, not on id: opening the same file twice should raise the
   * tab that already holds it rather than making a second, divergent copy that
   * both write to the same path.
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
    const existing = this.findByOrigin(document);
    if (existing) {
      this.requestedActiveId = existing.id;
      this.changed();
      return existing;
    }
    this.documents = [...this.documents, document];
    this.requestedActiveId = document.id;
    this.changed();
    return document;
  }

  private findByOrigin(document: MusicDocument): MusicDocument | undefined {
    const origin = document.origin;
    if (origin.kind === 'unsaved') return undefined;
    return this.documents.find(d => {
      if (d.origin.kind !== origin.kind) return false;
      if (d.origin.kind === 'file' && origin.kind === 'file')
        return d.origin.uri === origin.uri;
      if (d.origin.kind === 'project' && origin.kind === 'project')
        return d.origin.projectId === origin.projectId;
      return false;
    });
  }

  close(id: string): void {
    const before = this.documents.length;
    this.documents = this.documents.filter(d => d.id !== id);
    if (this.documents.length !== before) this.changed();
  }

  activate(id: string): void {
    if (!this.documents.some(d => d.id === id)) return;
    this.requestedActiveId = id;
    this.changed();
  }

  /** Every document with unwritten changes — what a quit prompt has to ask about. */
  get unsaved(): readonly MusicDocument[] {
    return this.documents.filter(d => d.dirty);
  }
}
