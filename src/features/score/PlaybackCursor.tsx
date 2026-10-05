/**
 * The red playhead line — iOS and Android.
 *
 * It draws what `ScoreCanvas` describes and decides nothing: a `CursorPath`
 * (the system's tick → x knots, in content px) and a `CursorMotion` (a tick,
 * when it was true, and a rate). Where the line is, when it moves to the next
 * system and when it is re-anchored are all the canvas's and the playback
 * binding's, shared with the web.
 *
 * The motion runs on the native animation driver: `clock` is the playhead in
 * ticks, animated linearly on the UI thread, and the line's x is its
 * interpolation over the knots — the same piecewise-linear function
 * `cursorXAt` computes. A JS-driven write per frame is what this replaced: each
 * one is a Fabric commit on the JavaScript thread, and anything else that
 * thread did made the caret stop and jump.
 *
 * Known gap against the spec: the gutter clip (expectation 4) is not applied
 * here — an interpolated value cannot be compared with the scroll offset on the
 * UI thread without Reanimated. It only matters in continuous mode, scrolled.
 * The Mac variant applies it.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { cursorTickAt } from '@sudobility/music_drawing';
import { useSignal } from './useScoreCanvas';
import type { CursorState, ScrollOffset, Signal } from './useScoreCanvas';

export type PlaybackCursorProps = {
  /**
   * What the canvas last described. A signal rather than a value, so a new
   * description re-renders this line and not the score view that owns it.
   */
  cursor: Signal<CursorState>;
  /** Content px scrolled: the line is placed in content coordinates. */
  scroll: Signal<ScrollOffset>;
  /**
   * The line's colour: the render theme's `caret`, so it follows light and
   * dark with the notation it is drawn over. The theme is the one place every
   * render colour lives, the web's caret reads the same token.
   */
  color: string;
};

/** Matches the web app's caret. */
export const CURSOR_WIDTH = 2;

/**
 * How far ahead one native animation runs. The binding re-describes the motion
 * whenever the reports disagree with it, so this only runs out on a score with
 * nothing to correct.
 */
const HORIZON_SECONDS = 30;

/**
 * Not on Windows. React Native Windows hands an interpolation to the
 * compositor as an expression animation, and the compositor refuses this one
 * (`StartAnimation`, E_INVALIDARG) — an error nothing catches, so pressing
 * Play aborted the app. Driven from JavaScript there, a frame per write.
 */
const NATIVE_DRIVER = Platform.OS !== 'windows';

export function PlaybackCursor({
  cursor: cursorSignal,
  scroll,
  color,
}: PlaybackCursorProps) {
  const cursor = useSignal(cursorSignal);
  const { left: scrollLeft, top: scrollTop } = useSignal(scroll);
  const clock = useRef(new Animated.Value(0)).current;
  const { path, motion } = cursor;

  useEffect(() => {
    // Where the motion says the line is by now, not where it was described.
    const from = cursorTickAt(motion, performance.now());
    clock.stopAnimation();
    clock.setValue(from);
    if (motion.ticksPerSecond <= 0) return undefined;
    Animated.timing(clock, {
      toValue: from + motion.ticksPerSecond * HORIZON_SECONDS,
      duration: HORIZON_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    }).start();
    return () => clock.stopAnimation();
  }, [clock, motion, cursor.id]);

  const translateX = useMemo(() => {
    if (!path || path.ticks.length < 2)
      return (path?.xs[0] ?? 0) - CURSOR_WIDTH / 2;
    return clock.interpolate({
      inputRange: path.ticks,
      outputRange: path.xs.map(x => x - CURSOR_WIDTH / 2),
      extrapolate: 'clamp',
    });
  }, [clock, path]);

  if (!path) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [{ translateX: -scrollLeft }, { translateY: -scrollTop }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.line,
          {
            top: path.top,
            height: path.height,
            backgroundColor: color,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    left: 0,
    width: CURSOR_WIDTH,
  },
});
