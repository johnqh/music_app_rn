/**
 * Records a document as recent whenever it is opened or saved.
 *
 * Separate from `recent-documents.ts`, which owns the list's rules — ordering,
 * the cap, tolerance of state an older build wrote. This is the wiring that
 * makes those rules reachable: without it the list is written by nobody and is
 * always empty, which is how it sat until a parity review noticed.
 *
 * Saves reach it through the document store's `onSaved`, which music_lib calls
 * after a write succeeds and never before — a file that failed to save is not
 * one worth offering to reopen. Opens reach it from whoever opened the file.
 *
 * The `handle` is the uri on every platform this ships to today. On a sandboxed
 * macOS build it becomes a security-scoped bookmark, which is why the two are
 * separate fields rather than one.
 */
import { useCallback } from 'react';
import type { DocumentOrigin } from '@sudobility/music_lib';
import { noteRecentDocument } from '@/app/menu-commands';
import { noteOpened } from './recent-documents';
import type { KeyValueStore } from './recent-documents';

export type RecentCandidate = { origin: DocumentOrigin; title: string };

/** Records a file document; a project or an unsaved score is not a file. */
export function recordRecent(
  store: KeyValueStore,
  { origin, title }: RecentCandidate,
): void {
  if (origin.kind !== 'file') return;
  // The system's Open Recent menu too (macOS), which survives a relaunch with
  // its sandbox access intact; the app's own list below is the cross-platform
  // one.
  noteRecentDocument(origin.uri);
  void noteOpened(store, {
    uri: origin.uri,
    handle: origin.uri,
    title,
    // Supplied by the caller rather than read inside the list, so the ordering
    // rules stay testable without a clock.
    openedAt: Date.now(),
  });
}

export function useRecentTracking(store: KeyValueStore) {
  return useCallback(
    (candidate: RecentCandidate) => recordRecent(store, candidate),
    [store],
  );
}
