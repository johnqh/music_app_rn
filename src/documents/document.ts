/**
 * An open document: one score, one editing store, one file it came from.
 *
 * The native app edits several at once — tabs on a desktop — so the store is
 * **per document** rather than app-wide. That is what the music_editing split
 * bought: `createEditingStore()` makes an independent store with no server, no
 * project row and no autosaver behind it, and nothing in the editing slices
 * knows the difference.
 *
 * Saving is not in here. The store reports that it changed and this records the
 * fact; who writes the bytes, and when, is the document *list*'s business —
 * which is what keeps a local file and a server project the same object with
 * two different backings.
 */
import { createEditingStore } from '@sudobility/music_editing';
import type { EditingStore } from '@sudobility/music_editing';
import type { Score } from '@sudobility/music_types';

/** Where a document's bytes live, and therefore what saving it means. */
export type DocumentOrigin =
  | { kind: 'unsaved' }
  | { kind: 'file'; uri: string }
  | { kind: 'project'; projectId: string };

export type MusicDocument = {
  readonly id: string;
  readonly store: EditingStore;
  title: string;
  origin: DocumentOrigin;
  /** True once the score has changed since it was last written. */
  dirty: boolean;
  /**
   * Where this client last saw the server's copy, for a project document.
   *
   * On the document rather than in the store, because the store is the
   * *editing* engine and knows nothing about a server. It is how a client tells
   * its own writes from somebody else's: a poll reloads only when the reported
   * stamp is strictly newer than this one, so an autosave does not read as a
   * foreign change and send the editor to re-download what it just uploaded.
   */
  serverUpdatedAt?: string | null;
};

export type CreateDocumentOptions = {
  id: string;
  score: Score;
  title: string;
  origin?: DocumentOrigin;
  /** Called whenever the score changes, so the owner can schedule a save. */
  onChanged?: (document: MusicDocument) => void;
};

export function createDocument(options: CreateDocumentOptions): MusicDocument {
  const document: MusicDocument = {
    id: options.id,
    title: options.title,
    origin: options.origin ?? { kind: 'unsaved' },
    dirty: false,
    // Assigned below: the store's change callback needs the document, and the
    // document needs the store. One of the two has to be filled in after.
    store: undefined as unknown as EditingStore,
  };

  const store = createEditingStore({
    onChanged: () => {
      document.dirty = true;
      options.onChanged?.(document);
    },
  });
  (document as { store: EditingStore }).store = store;
  store.getState().setScore(options.score, { resetHistory: true });
  // `setScore` is an adoption, not an edit: a freshly opened document is clean.
  document.dirty = false;
  return document;
}

/**
 * Changes where a document's bytes live.
 *
 * Used by "Sync to server", which turns a local document into a project without
 * closing and reopening it — the identity, the undo history and the tab all
 * survive, because only the destination changed.
 */
export function setDocumentOrigin(
  document: MusicDocument,
  origin: DocumentOrigin,
): void {
  document.origin = origin;
}

/** Records that the document's bytes now match what is on screen. */
export function markSaved(
  document: MusicDocument,
  origin?: DocumentOrigin,
): void {
  document.dirty = false;
  if (origin) document.origin = origin;
}
