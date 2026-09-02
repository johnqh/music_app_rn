/**
 * Which track is active, and which tracks are shown.
 *
 * Two independent pieces of state on one control, which is exactly what
 * `CheckableSelect` is for: choosing a row makes that track **active** (what
 * the caret aims at, what the keyboard plays), while ticking rows decides what
 * is **drawn**. Collapsing them into one would make "show this too" and "edit
 * this now" the same gesture, and they are not.
 *
 * `minChecked={1}` because a score with every track hidden is a blank page with
 * no way back — at the floor the ticked boxes disable and the unticked ones
 * stay live, so the set can always grow.
 */
import { useCallback } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { CheckableSelect } from '@sudobility/components-rn';
import { selectActiveTrackId } from '@sudobility/music_editing';
import type { MusicDocument } from '@/documents/document';

export function TrackVisibilitySelect({
  document,
}: {
  document: MusicDocument;
}) {
  const { t } = useTranslation();
  const store = document.store;
  const tracks = useStore(store, s => s.score?.tracks ?? []);
  const activeTrackId = useStore(store, selectActiveTrackId);
  const visibleTrackIds = useStore(store, s => s.visibleTrackIds);

  // `null` means "all of them" — the state a score starts in, which a list of
  // ids cannot express without repeating every one.
  const checked = visibleTrackIds ?? tracks.map(track => track.id);

  // The slice takes a list, not `null` — it normalises "all of them" itself.
  const setVisible = useCallback(
    (next: string[]) => store.getState().setVisibleTracks(next),
    [store],
  );

  return (
    <CheckableSelect
      /*
        A floor *and* a ceiling. The trigger sizes to its label, and the label
        is a track name — so adding a track called "New track" (or picking one
        called "Acoustic Grand Piano") grew this control until it filled the
        bar and pushed every other tool off the right edge. The trigger's own
        text already carries `numberOfLines={1}` and `flex: 1`, so bounding it
        is all that was needed: the name ellipsizes instead.
      */
      className="min-w-32 max-w-44"
      title={t('editor.tracks')}
      options={tracks.map(track => ({ value: track.id, label: track.name }))}
      value={activeTrackId ?? ''}
      onChange={id => store.getState().setActiveTrack(id)}
      checked={checked}
      onCheckedChange={setVisible}
      minChecked={1}
      /*
        The sheet's only other dismissal is a tap on the scrim, which nothing
        on screen advertises — it read as a full-width picker with no way out.
        Ticking deliberately keeps the sheet open, so this is what ends it.
      */
      doneLabel={t('common.done')}
      accessibilityLabel={t('editor.tracks')}
    />
  );
}
