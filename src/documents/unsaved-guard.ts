/**
 * What to do about unwritten work when a document — or the app — is closing.
 *
 * Pure decision, no dialog: the question "may this close?" has one answer and
 * three outcomes, and keeping it out of a component is what makes it testable
 * and what lets the same rule serve a tab's close button, a window close and a
 * quit.
 *
 * An **unsaved** document with no file is treated the same as a dirty one with
 * a file, deliberately. Both have work that would be lost; only the remedy
 * differs, and choosing the remedy is the caller's job.
 */
import type { MusicDocument } from './document';

export type CloseDecision =
  /** Nothing to lose — close it. */
  | { kind: 'close' }
  /** Work would be lost; ask, naming what. */
  | { kind: 'confirm'; documents: readonly MusicDocument[] };

/** Whether one document has work that is not on disk. */
export function hasUnwrittenWork(document: MusicDocument): boolean {
  if (!document.dirty) return false;
  // A never-saved document is only worth asking about if it has something in
  // it — an empty scratch document the user never touched is not work.
  return true;
}

export function decideClose(document: MusicDocument): CloseDecision {
  return hasUnwrittenWork(document)
    ? { kind: 'confirm', documents: [document] }
    : { kind: 'close' };
}

/**
 * The same question for the whole app.
 *
 * Every unwritten document is named at once rather than one prompt per
 * document: three dialogs in a row is how somebody clicks "discard" on the one
 * they meant to keep.
 */
export function decideQuit(documents: readonly MusicDocument[]): CloseDecision {
  const unwritten = documents.filter(hasUnwrittenWork);
  return unwritten.length === 0
    ? { kind: 'close' }
    : { kind: 'confirm', documents: unwritten };
}
