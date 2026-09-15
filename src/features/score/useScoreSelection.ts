/**
 * What the editor has selected, in the shape the score canvas takes.
 *
 * The colouring rules themselves — selection, regenerated, sounding over them,
 * only the active track's sounding notes lit — are `ScoreCanvas`'s, shared with
 * the web. The sounding notes do not pass through here at all: the playback
 * binding hands them to the canvas directly, so a note starting re-renders
 * nothing in React.
 */
import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { MusicDocument } from '@/documents/document';

export type ScoreSelection = {
  noteIds: readonly string[];
  measureIds: readonly string[];
  /** Selected notes colour as regenerated rather than selected. */
  regenerated: boolean;
};

export function useScoreSelection(document: MusicDocument): ScoreSelection {
  const store = document.store;
  const noteIds = useStore(store, s => s.selection.eventIds);
  const measureIds = useStore(store, s => s.selection.measureIds);
  const regenerated = useStore(store, s => s.selectionRegenerated);
  return useMemo(
    () => ({ noteIds, measureIds, regenerated }),
    [noteIds, measureIds, regenerated],
  );
}
