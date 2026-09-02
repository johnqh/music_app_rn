/**
 * Which notes are lit, and why — the editor's colouring of the notation.
 *
 * Note state is the notehead's own colour; there is no highlight overlay. The
 * rule itself (selection first, sounding over it, and **only the active
 * track's** sounding notes) lives in `noteColorsFor` in music_drawing, because
 * two apps draw this score and a second copy would be a second set of answers
 * to a question the reader expects one answer to. This hook is only the
 * wiring: where the selection and the sounding set come from on this platform.
 *
 * The sounding set is held in state rather than a ref, unlike the piano
 * keyboard's, because the notation genuinely has to redraw when it changes —
 * that redraw *is* the highlight. It is cheap: `computeLayout` is cached on
 * score identity, so a colour change re-runs the draw and not the layout.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { noteColorsFor } from '@sudobility/music_drawing';
import type { NoteColorRole } from '@sudobility/music_drawing';
import type { SoundingNote } from '@sudobility/music_types';
import { selectActiveTrackId } from '@sudobility/music_editing';
import { getAppServices } from '@/config/initialize';
import type { MusicDocument } from '@/documents/document';

const NOTHING_SOUNDING: readonly SoundingNote[] = [];

export type NoteColors = {
  noteColors: ReadonlyMap<string, NoteColorRole>;
  selectedMeasureIds: ReadonlySet<string>;
};

export function useNoteColors(document: MusicDocument): NoteColors {
  const store = document.store;
  const eventIds = useStore(store, s => s.selection.eventIds);
  const measureIds = useStore(store, s => s.selection.measureIds);
  const regenerated = useStore(store, s => s.selectionRegenerated);
  const activeTrackId = useStore(store, selectActiveTrackId);
  const [sounding, setSounding] =
    useState<readonly SoundingNote[]>(NOTHING_SOUNDING);

  useEffect(() => {
    const player = getAppServices().player;
    return player.onSounding(notes => setSounding(notes));
  }, []);

  const noteColors = useMemo(
    () =>
      noteColorsFor({
        selectedIds: eventIds,
        sounding,
        activeTrackId: activeTrackId ?? null,
        regenerated,
      }),
    [eventIds, sounding, activeTrackId, regenerated],
  );

  const selectedMeasureIds = useMemo(() => new Set(measureIds), [measureIds]);

  return { noteColors, selectedMeasureIds };
}
