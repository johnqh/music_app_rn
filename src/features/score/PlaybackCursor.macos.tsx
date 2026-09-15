/**
 * The red playhead line on the Mac — drawn by a native view, frame by frame.
 *
 * It draws what `ScoreCanvas` describes, exactly as the shared variant does,
 * but hands the description to `@moosiac/playhead`: an `NSView` that replays
 * `cursorTickAt` / `cursorXAt` / `cursorVisible` with the display link. The
 * shared variant's `useNativeDriver` animation cannot be used here — on this
 * react-native-macos build native-driven animations never reach a view
 * (measured: a native-driven opacity loop left its view untouched).
 */
import { StyleSheet, View } from 'react-native';
import { PlayheadView } from '@moosiac/playhead';
import { CURSOR_WIDTH } from './PlaybackCursor';
import type { PlaybackCursorProps } from './PlaybackCursor';

export type { PlaybackCursorProps } from './PlaybackCursor';

export function PlaybackCursor({
  cursor,
  scrollLeft,
  scrollTop,
  color,
}: PlaybackCursorProps) {
  const { path, motion } = cursor;
  if (!path || !PlayheadView) return null;

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
      <PlayheadView
        style={StyleSheet.absoluteFill}
        knotTicks={path.ticks}
        knotXs={path.xs}
        lineTop={path.top}
        lineHeight={path.height}
        lineWidth={CURSOR_WIDTH}
        lineColor={color}
        clipLeft={path.clipLeft}
        scrollLeft={scrollLeft}
        anchorTick={motion.tick}
        anchorTime={motion.atMs}
        rate={motion.ticksPerSecond}
        planId={cursor.id}
        sentAt={performance.now()}
      />
    </View>
  );
}
