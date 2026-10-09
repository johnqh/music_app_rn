import { cursorTickAt, cursorXAt } from '@sudobility/music_drawing';
import type { CursorMotion, CursorPath } from '@sudobility/music_drawing';

/** Presentation keyframes; all score-to-position math stays in music_drawing. */
export function cursorKeyframes(
  path: CursorPath,
  motion: CursorMotion,
  now: number,
) {
  const tick = cursorTickAt(motion, now);
  const times = [0];
  const positions = [cursorXAt(path, tick)];
  if (motion.ticksPerSecond > 0) {
    path.ticks.forEach((at, index) => {
      if (at <= tick) return;
      times.push(((at - tick) / motion.ticksPerSecond) * 1000);
      positions.push(path.xs[index]!);
    });
  }
  return { times, positions, sentAt: now };
}
