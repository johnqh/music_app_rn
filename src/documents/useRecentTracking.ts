/**
 * Records a document as recent whenever it is opened or saved.
 *
 * Separate from `recent-documents.ts`, which owns the list's rules — ordering,
 * the cap, tolerance of state an older build wrote. This is the wiring that
 * makes those rules reachable: without it the list is written by nobody and is
 * always empty, which is how it sat until a parity review noticed.
 *
 * The `handle` is the uri on every platform this ships to today. On a sandboxed
 * macOS build it becomes a security-scoped bookmark, which is why the two are
 * separate fields rather than one.
 */
import { useCallback } from 'react';
import { noteOpened } from './recent-documents';
import type { KeyValueStore } from './recent-documents';
import type { MusicDocument } from './document';

export function useRecentTracking(store: KeyValueStore) {
  return useCallback(
    (document: MusicDocument) => {
      if (document.origin.kind !== 'file') return;
      void noteOpened(store, {
        uri: document.origin.uri,
        handle: document.origin.uri,
        title: document.title,
        // Supplied by the caller rather than read inside the list, so the
        // ordering rules stay testable without a clock.
        openedAt: Date.now(),
      });
    },
    [store],
  );
}
