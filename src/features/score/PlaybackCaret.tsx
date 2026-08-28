/**
 * The red playhead line, over the score.
 *
 * **It interpolates; it is not driven straight off the position reports.** The
 * engine samples position through a scheduling loop, so its ~30Hz reports
 * arrive in clumps — driving a caret off them leaves it stalled on most frames
 * and jumping when it does move. This dead-reckons forward from the last report
 * using elapsed real time and the score's `TempoMap`, repainting every frame.
 * That is the same reasoning, and the same fix, as the web app's `PlaybackCaret`.
 *
 * The position is written to `Animated.Value`s rather than React state, so a
 * frame costs a transform and not a render of the notation underneath it.
 *
 * React Native's own `Animated`, not Reanimated: this needs no worklet and no
 * native module, and the values it drives — `translateX`, `translateY`,
 * `height` — are layout properties the native driver could not take anyway.
 * Adding Reanimated here would buy nothing and cost a native dependency.
 *
 * The tempo map is the score's own, so a fermata slows the caret with the
 * music: reading a flat BPM would send it gliding past the hold and snapping
 * back, which is the exact stall-and-jump the interpolation exists to prevent.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { caretPositionForTick } from '@sudobility/music_drawing';
import type { LayoutPlan } from '@sudobility/music_drawing';
import { TempoMap } from '@sudobility/music_types';
import type { Score } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';

export type PlaybackCaretProps = {
  score: Score;
  plan: LayoutPlan;
  /** Content pixels scrolled, so the caret sits where the music is drawn. */
  scrollTop: number;
  /**
   * Horizontal scroll offset, which only continuous mode ever has.
   *
   * The caret is positioned in *content* coordinates and drawn in the
   * viewport's, so both offsets have to come off — leaving this one out drew
   * the caret at its absolute x, which in continuous mode is anywhere from
   * right to far off the screen.
   */
  scrollLeft?: number;
};

/** Matches the web app's caret. */
const CARET_WIDTH = 2;
const CARET_COLOR = '#dc2626';

export function PlaybackCaret({
  score,
  plan,
  scrollTop,
  scrollLeft = 0,
}: PlaybackCaretProps) {
  // Refs, so the values survive renders and the frame loop writes to the same
  // ones the style reads.
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(0)).current;

  /** Rebuilt only when the score's own tempo events change. */
  const tempo = useMemo(
    () => new TempoMap([...score.tempoMap], score.ppq),
    [score],
  );

  /*
    The last report, and when it arrived. A ref because the frame loop reads it
    and nothing renders from it.

    Seeded at tick 0 rather than left null, because the engine only reports a
    position while playing or after a seek — so on a freshly opened score
    nothing had ever reported, and the caret stayed *invisible* until the first
    tap on a stave happened to seek. The caret is the score position, and a
    score that has not been played is at the beginning, not nowhere.
  */
  const report = useRef<{ tick: number; atMs: number }>({
    tick: 0,
    atMs: Date.now(),
  });
  const playing = useRef(false);

  useEffect(() => {
    const player = getAppServices().player;
    const offPosition = player.onPosition(tick => {
      report.current = { tick, atMs: Date.now() };
    });
    const offTransport = player.onTransport(state => {
      playing.current = state === 'playing';
      // Stop returns to the beginning; it does not remove the caret, for the
      // same reason opening a score does not.
      if (state === 'stopped') report.current = { tick: 0, atMs: Date.now() };
    });
    return () => {
      offPosition();
      offTransport();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const last = report.current;
      // Dead reckoning: where the music has got to since the last report.
      const elapsed = playing.current ? (Date.now() - last.atMs) / 1000 : 0;
      const seconds = tempo.ticksToSeconds(last.tick) + elapsed;
      const at = caretPositionForTick(
        plan,
        score,
        tempo.secondsToTicks(seconds),
      );
      if (!at) {
        shown.setValue(0);
        return;
      }
      x.setValue(at.x - scrollLeft);
      y.setValue(at.yTop - scrollTop);
      height.setValue(at.yBottom - at.yTop);
      shown.setValue(1);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [plan, score, scrollTop, scrollLeft, tempo, x, y, height, shown]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.caret,
        {
          opacity: shown,
          height,
          transform: [{ translateX: x }, { translateY: y }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  caret: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CARET_WIDTH,
    backgroundColor: CARET_COLOR,
  },
});
