import { describe, expect, it } from 'vitest';
import { cursorKeyframes } from './cursor-keyframes';

const path = {
  systemIndex: 0,
  ticks: [0, 50, 100],
  xs: [0, 150, 200],
  top: 0,
  height: 80,
  clipLeft: 0,
};
const motion = { tick: 0, atMs: 0, ticksPerSecond: 10 };

describe('Windows playhead presentation', () => {
  it('passes through the shared note positions at their playback times', () => {
    expect(cursorKeyframes(path, motion, 1000)).toEqual({
      times: [0, 4000, 9000],
      positions: [30, 150, 200],
      sentAt: 1000,
    });
  });
  it('samples delayed updates instead of restarting from the anchor', () => {
    expect(cursorKeyframes(path, motion, 6000)).toEqual({
      times: [0, 4000],
      positions: [160, 200],
      sentAt: 6000,
    });
  });
  it('holds the cursor when paused or past the current system', () => {
    expect(
      cursorKeyframes(path, { ...motion, tick: 50, ticksPerSecond: 0 }, 6000)
        .positions,
    ).toEqual([150]);
    expect(cursorKeyframes(path, motion, 15000).positions).toEqual([200]);
    expect(cursorKeyframes(path, motion, 15000).times).toEqual([0]);
  });
});
