/**
 * Windows cannot safely run this cursor through Native Animated's compositor.
 * Read the latest shared path, motion, and scroll in one frame; the score's
 * cached SVG base keeps note highlights from monopolizing this JS thread.
 */
import { useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cursorTickAt,
  cursorVisible,
  cursorXAt,
} from '@sudobility/music_drawing';
import type { PlaybackCursorProps } from './PlaybackCursor';

export type { PlaybackCursorProps } from './PlaybackCursor';
const CURSOR_WIDTH = 2;

export function PlaybackCursor({ cursor, scroll, color }: PlaybackCursorProps) {
  const line = useRef<View>(null);
  useLayoutEffect(() => {
    let frame: number | null = null;
    let disposed = false;
    const draw = () => {
      if (disposed) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      const { path, motion } = cursor.get();
      const { left, top } = scroll.get();
      if (!path) {
        line.current?.setNativeProps({ style: { opacity: 0 } });
        return;
      }
      const x = cursorXAt(path, cursorTickAt(motion, performance.now()));
      line.current?.setNativeProps({
        style: {
          opacity: cursorVisible(path, x, left) ? 1 : 0,
          height: path.height,
          transform: [
            { translateX: x - left - CURSOR_WIDTH / 2 },
            { translateY: path.top - top },
          ],
        },
      });
      if (motion.ticksPerSecond > 0) frame = requestAnimationFrame(draw);
    };
    const offCursor = cursor.subscribe(draw);
    const offScroll = scroll.subscribe(draw);
    draw();
    return () => {
      disposed = true;
      offCursor();
      offScroll();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [cursor, scroll]);
  return (
    <View
      ref={line}
      pointerEvents="none"
      style={[styles.line, { backgroundColor: color }]}
    />
  );
}
const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CURSOR_WIDTH,
    opacity: 0,
  },
});
