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
 *
 * **Read from the document store, not from the player.** `bindPlayer` writes
 * the load state into the store it binds (`synthLoad`), exactly as the web
 * adapter writes it into the app store — so this subscribed to the player on
 * its own once, and now reads what the binding already mirrors. The percentage
 * is music_types' `synthLoadPercent`, the web indicator's rule.
 */
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import { synthLoadPercent } from '@sudobility/music_types';
import type { PlaybackLoadState } from '@sudobility/music_types';
import type { TransportStoreApi } from './usePlayerBinding';

/** The engine's load state, as the player binding mirrors it into the store. */
export function useSynthLoad(store: TransportStoreApi): PlaybackLoadState {
  return useStore(store, s => s.synthLoad);
}

export function SynthLoadIndicator({ store }: { store: TransportStoreApi }) {
  const { t } = useTranslation();
  const load = useSynthLoad(store);

  if (load.status === 'idle' || load.status === 'ready') return null;

  if (load.status === 'failed') {
    return (
      // The role sits on the wrapper: this package's `Text` styles text and
      // takes no accessibility props of its own.
      <View accessibilityRole="alert" className="shrink">
        <Text className="text-destructive text-sm" numberOfLines={1}>
          {t('transport.loadFailed')}
        </Text>
      </View>
    );
  }

  const percent = synthLoadPercent(load);
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
      <Text className="text-muted-foreground shrink text-sm" numberOfLines={1}>
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
