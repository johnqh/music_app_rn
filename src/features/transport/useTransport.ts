/**
 * The transport, bound to one document.
 *
 * Deliberately not music_lib's `playbackController`: that one binds the
 * *application* store to the player, and this app has a store per document.
 * Binding the player to whichever document is in front is the same job with a
 * different subject, and it is small — the player already owns the plan, the
 * repeats, the performance↔score tick translation and the caret's clock.
 *
 * Position is **not** kept in React state. It arrives about thirty times a
 * second, and a component that re-rendered on each would re-render the notation
 * with it; readouts subscribe individually instead, exactly as the web app's
 * `PlaybackCaret` and `StatusPosition` do.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Score, TransportPlaybackState } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';

export type TransportApi = {
  state: TransportPlaybackState;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (scoreTick: number) => void;
  /** Subscribe to position ticks without re-rendering the caller. */
  onPosition: (fn: (scoreTick: number) => void) => () => void;
};

export function useTransport(score: Score | null): TransportApi {
  const [state, setState] = useState<TransportPlaybackState>('stopped');
  const loadedScore = useRef<Score | null>(null);

  useEffect(() => {
    const player = getAppServices().player;
    return player.onTransport(setState);
  }, []);

  /**
   * The score is handed over on identity change only.
   *
   * Every edit produces a new score object, so identity is the honest test —
   * and reloading the player mid-playback is exactly what must not happen for
   * a mix change, which is why the caller stops the transport before adopting
   * a score from outside.
   */
  useEffect(() => {
    if (!score || score === loadedScore.current) return;
    loadedScore.current = score;
    void getAppServices().player.load(score);
  }, [score]);

  const play = useCallback(async () => {
    await getAppServices().player.play();
  }, []);
  const pause = useCallback(() => getAppServices().player.pause(), []);
  const stop = useCallback(() => getAppServices().player.stop(), []);
  const seek = useCallback(
    (tick: number) => getAppServices().player.seek(tick),
    [],
  );
  const onPosition = useCallback(
    (fn: (tick: number) => void) => getAppServices().player.onPosition(fn),
    [],
  );

  return { state, play, pause, stop, seek, onPosition };
}
