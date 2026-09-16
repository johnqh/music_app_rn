/**
 * The transport, bound to one document — through music_lib's `bindPlayer`.
 *
 * This file used to be `useTransport`, a binder of this app's own: it mirrored
 * the transport state and loaded each new score, and did nothing else. No
 * loop over the selection, no bar stepping from the one caret, no clearing the
 * selection on the way into playing, no hidden tracks pushed to the player and
 * no report when a load or a play failed — every one of which the web's
 * `PlaybackAdapter` did. Those are rules about how editing and playback meet,
 * not about either app, so music_lib states them once in `bindPlayer` and
 * both apps bind to it: the web through music_lib's adapter over its single
 * store, this app per document, since a document store carries the same
 * transport settings (`loopRange`, `metronome`, `tempoMultiplier`,
 * `masterVolume`, `synthLoad`) the binder writes.
 *
 * **What went wrong reaches the toast queue.** The binder reports a *kind* of
 * failure and holds no words; the words are music_lib's `libraryMessage`, the
 * same the web adapter uses, and the toast goes through the document store's
 * `pushToast` — which a document store built by this app sends to the one app
 * queue. The detail is appended exactly as the web adapter appends it, so the
 * two apps say the same sentence about the same failure.
 *
 * Position is **not** kept in React state. It arrives about thirty times a
 * second, and a component that re-rendered on each would re-render the notation
 * with it; readouts subscribe individually through `usePositionReadout`.
 */
import { useEffect, useMemo, useRef } from 'react';
import { libraryMessage } from '@sudobility/music_lib';
import type { DocumentStore } from '@sudobility/music_lib';
import { getAppServices } from '@/config/initialize';
import type { PositionSource } from './usePositionReadout';
import { bindPlayer } from '@sudobility/music_lib';
import type { PlayerBinding } from '@sudobility/music_lib';
import type { PlayerFailure } from '@sudobility/music_types';

/**
 * A store the player can be bound to: a document store, which carries the
 * editing state and the transport settings `bindPlayer` writes. The published
 * page makes one too, rather than this taking a bare editing store that has
 * nowhere to show a failure.
 */
export type TransportStoreApi = DocumentStore;

/**
 * The binding's operations, plus a position subscription for the readouts.
 *
 * Everything but `onPosition` is `bindPlayer`'s, forwarded — the host adds only
 * what a readout needs and a binding deliberately does not offer.
 */
export type TransportBinding = Omit<PlayerBinding, 'unbind'> & PositionSource;

/** The toast a player failure becomes: the library's words, then the detail. */
export function reportPlayerFailure(
  store: TransportStoreApi,
  failure: PlayerFailure,
  error: unknown,
): void {
  const detail = error instanceof Error ? error.message : String(error);
  store.getState().pushToast({
    message: `${libraryMessage(failure)}: ${detail}`,
    severity: 'error',
  });
}

/**
 * Binds the app's player to `store` for as long as the caller is mounted.
 *
 * The returned object is **stable for the store's lifetime** and forwards to
 * whichever binding is live. The binding itself is made in an effect — it
 * subscribes to the player and the store, which is not something a render may
 * do — so a facade is what lets the first render hand controls to the bar
 * without a null to check. A press before the effect has run does nothing,
 * which is the same as a press before the player existed.
 */
export function usePlayerBinding(store: TransportStoreApi): TransportBinding {
  const live = useRef<PlayerBinding | null>(null);

  useEffect(() => {
    const binding = bindPlayer(getAppServices().player, store, {
      onError: (failure, error) => reportPlayerFailure(store, failure, error),
    });
    live.current = binding;
    return () => {
      binding.unbind();
      if (live.current === binding) live.current = null;
    };
  }, [store]);

  return useMemo<TransportBinding>(
    () => ({
      togglePlay: async () => live.current?.togglePlay(),
      pause: () => live.current?.pause(),
      stop: () => live.current?.stop(),
      seek: tick => live.current?.seek(tick),
      seekToMeasure: index => live.current?.seekToMeasure(index),
      goToStart: () => live.current?.goToStart(),
      previousMeasure: () => live.current?.previousMeasure(),
      nextMeasure: () => live.current?.nextMeasure(),
      toggleLoop: () => live.current?.toggleLoop(),
      setLoopFromSelection: () => live.current?.setLoopFromSelection(),
      clearLoop: () => live.current?.clearLoop(),
      setTempoMultiplier: m => live.current?.setTempoMultiplier(m),
      setMetronome: enabled => live.current?.setMetronome(enabled),
      setMasterVolume: volume => live.current?.setMasterVolume(volume),
      onPosition: fn => getAppServices().player.onPosition(fn),
    }),
    // A new store is a new binding; the facade follows it so a memoised child
    // holding the old one cannot drive a document that is no longer in front.
    [store],
  );
}
