/**
 * Text derived from the playhead, re-rendering only when the text changes.
 *
 * Reports arrive about thirty times a second and a readout shows far less: a
 * bar and beat changes a few times a second, a timecode ten. Each report is
 * formatted and compared with what is on screen, and only a difference renders
 * — the readouts used to hold the tick in state and re-render on every report,
 * which on a dense score was the transport bar re-rendering at the engine's
 * rate. `format` is read at render, so a new score or tempo map applies at once.
 *
 * It lived in `useTransport.ts` until that binder was replaced by
 * music_editing's `bindPlayer`; the smoothness rule is this app's, so it stayed.
 */
import { useEffect, useReducer, useRef } from 'react';

/** Anything that reports the playhead: the player, or a test's fake. */
export type PositionSource = {
  onPosition: (fn: (scoreTick: number) => void) => () => void;
};

export function usePositionReadout(
  source: PositionSource,
  format: (tick: number) => string,
): string {
  const formatRef = useRef(format);
  formatRef.current = format;
  const tick = useRef(0);
  const shown = useRef<string | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(
    () =>
      source.onPosition(next => {
        tick.current = next;
        if (formatRef.current(next) !== shown.current) rerender();
      }),
    [source],
  );
  const text = format(tick.current);
  shown.current = text;
  return text;
}
