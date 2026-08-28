/**
 * What the engine is doing before it can make a sound.
 *
 * The soundfont engine has tens of megabytes to fetch and several seconds of
 * synth setup on the first press of Play, and `SoundfontPlaybackEngine.play()`
 * deliberately does not report `playing` until the synth is up — reporting it
 * early made the caret lie, because it dead-reckons from elapsed real time
 * between position reports and none arrive during the load. That honesty is
 * only affordable if something on screen says what the wait is for; without
 * it, several seconds of a dead-looking Play button is all the reader gets.
 * The web app has had this indicator since that change. This is its native
 * half.
 *
 * Its own subscriber, like every position readout in this feature, and for the
 * same reason: the load reports per percent, and read at `TransportBar`'s top
 * level each of those would re-render every control in the bar.
 *
 * Renders nothing when there is nothing to say, so a ready engine costs no
 * space.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import type { PlaybackLoadState } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';

/** The engine's load state, subscribed to directly rather than through a store. */
export function useSynthLoad(): PlaybackLoadState {
  const [load, setLoad] = useState<PlaybackLoadState>({ status: 'idle' });
  useEffect(() => getAppServices().player.onLoadState(setLoad), []);
  return load;
}

export function SynthLoadIndicator() {
  const { t } = useTranslation();
  const load = useSynthLoad();

  if (load.status === 'idle' || load.status === 'ready') return null;

  if (load.status === 'failed') {
    return (
      // The role sits on the wrapper: this package's `Text` styles text and
      // takes no accessibility props of its own.
      <View accessibilityRole="alert" className="shrink">
        <Text className="text-destructive text-xs" numberOfLines={1}>
          {t('transport.loadFailed')}
        </Text>
      </View>
    );
  }

  const percent =
    load.fraction === null ? null : Math.round(load.fraction * 100);
  const label =
    percent === null
      ? t('transport.preparingUnknown')
      : t('transport.preparing', { percent });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      className="shrink flex-row items-center gap-2"
    >
      <Text className="text-muted-foreground shrink text-xs" numberOfLines={1}>
        {label}
      </Text>
      {/*
        Determinate only. The download reports a fraction; the synth digesting
        the font reports nothing, and a bar moving on its own through that half
        would claim progress the engine has not made — so that half is the
        words alone.
      */}
      {percent === null ? null : (
        <View className="bg-border h-1 w-12 overflow-hidden rounded-full">
          <View
            className="bg-muted-foreground h-full rounded-full"
            style={{ width: `${percent}%` }}
          />
        </View>
      )}
    </View>
  );
}
