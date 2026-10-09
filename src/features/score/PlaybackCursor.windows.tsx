/** The compositor replays the shared cursor path without a JS update per frame. */
import { useMemo } from 'react';
import { processColor, StyleSheet } from 'react-native';
import { cursorKeyframes } from './cursor-keyframes';
import WindowsPlayhead from './WindowsPlayheadNativeComponent';
import { useSignal } from './useScoreCanvas';
import type { PlaybackCursorProps } from './PlaybackCursor';

export type { PlaybackCursorProps } from './PlaybackCursor';

export function PlaybackCursor({ cursor, scroll, color }: PlaybackCursorProps) {
  const { path, motion, id } = useSignal(cursor);
  const { left, top } = useSignal(scroll);
  const plan = useMemo(
    () => (path ? cursorKeyframes(path, motion, performance.now()) : null),
    [path, motion, id],
  );
  if (!path || !plan) return null;
  const parsed = processColor(color);
  return (
    <WindowsPlayhead
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      {...plan}
      lineTop={path.top}
      lineHeight={path.height}
      lineColor={typeof parsed === 'number' ? parsed >>> 0 : 0xffd32f2f}
      scrollLeft={left}
      scrollTop={top}
      clipLeft={path.clipLeft}
    />
  );
}
