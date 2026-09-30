/**
 * Which tracks are drawn at all.
 *
 * On the Track tab rather than the editing bar. It sat on the bar as half of
 * a control that also chose the active track, and that half went when tapping
 * a staff came to do it; this half had no other home, and nothing else in the
 * app hides a track. A list rather than a switch for the track that is
 * showing, because the tab shows the *active* track and the active track is
 * never hidden — a switch there could hide a track and never bring one back.
 *
 * Hiding a part is a *view* choice, not an edit: the notes stay in the score
 * and a hidden track still sounds. So it stays live while the transport plays.
 *
 * Absent below two tracks, by music_editing's `trackPickerVisible`. The last
 * track showing cannot be switched off, since a score with nothing drawn is a
 * blank page, which reads as the app having lost the music.
 */
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Switch, Text } from '@sudobility/components-rn';
import {
  selectVisibleTrackIds,
  trackPickerVisible,
} from '@sudobility/music_editing';
import type { MusicDocument } from '@/documents/document';

export function VisibleTracksField({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const store = document.store;
  const tracks = useStore(store, s => s.score?.tracks);
  const visibleTrackIds = useStore(store, selectVisibleTrackIds);
  const visible = useStore(store, trackPickerVisible);
  if (!visible || !tracks) return null;

  const shown = new Set(visibleTrackIds);
  const toggle = (trackId: string, checked: boolean) => {
    // In score order whatever order they were switched in, so the stored
    // list reads the way the page does.
    const next = tracks
      .map(track => track.id)
      .filter(id => (id === trackId ? checked : shown.has(id)));
    if (next.length > 0) store.getState().setVisibleTracks(next);
  };

  return (
    <View className="gap-2" accessibilityLabel={t('inspector.visibleTracks')}>
      <Text className="text-muted-foreground text-sm">
        {t('inspector.visibleTracks')}
      </Text>
      {tracks.map(track => (
        <View key={track.id} className="flex-row items-center justify-between">
          <Text className="text-foreground flex-1 text-base" numberOfLines={1}>
            {track.name}
          </Text>
          <Switch
            checked={shown.has(track.id)}
            // The last one showing stays: see the file comment.
            disabled={shown.has(track.id) && shown.size === 1}
            onCheckedChange={(checked: boolean) => toggle(track.id, checked)}
            accessibilityLabel={track.name}
          />
        </View>
      ))}
    </View>
  );
}
