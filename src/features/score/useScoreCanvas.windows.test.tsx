/**
 * The Windows surface: what a page turn tells the canvas, and when.
 */
import { jest } from '@jest/globals';
import { createRef } from 'react';
import type { ScrollView } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { LIGHT_RENDER_THEME } from '@sudobility/music_drawing';
import { twinkleScore } from '@sudobility/music_types/test';
import { useScoreCanvas } from './useScoreCanvas.windows';

function setup() {
  const scrollTo = jest.fn();
  const vertical = createRef<ScrollView | null>();
  (vertical as { current: unknown }).current = { scrollTo };
  const horizontal = createRef<ScrollView | null>();
  const size = { current: { width: 600, height: 200 } };
  const { result, unmount } = renderHook(() =>
    useScoreCanvas({ vertical, horizontal, size }),
  );
  const { canvas } = result.current;
  canvas.setStoredScore(twinkleScore());
  canvas.setView({
    width: 600,
    height: 200,
    zoom: 1,
    layoutMode: 'page',
    theme: LIGHT_RENDER_THEME,
  });
  return { ...result.current, scrollTo, unmount };
}

it('moves the canvas and the cursor to the new page when it scrolls, not when RNW reports it', () => {
  const { canvas, scroll, scrollTo, unmount } = setup();
  const score = twinkleScore();
  const measures = score.tracks[0]!.measures;
  const last = measures[measures.length - 1]!;
  canvas.scrollToFollow(last.startTick);
  expect(scrollTo).toHaveBeenCalled();
  const target = scrollTo.mock.calls.at(-1)![0] as { y: number };
  expect(target.y).toBeGreaterThan(0);
  // No onScroll has arrived; the signal the cursor reads already has it.
  expect(scroll.get().top).toBe(target.y);
  unmount();
});

it('reports a committed frame as highlight latency', () => {
  const { picture, canvas, unmount } = setup();
  const surface = (
    canvas as unknown as { surface: { presentLatencyMs: number } }
  ).surface;
  const before = surface.presentLatencyMs;
  let now = 1000;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  canvas.paintNow();
  const frame = picture.get();
  expect(frame).not.toBeNull();
  now += 200;
  frame!.committed();
  expect(surface.presentLatencyMs).toBeGreaterThan(before);
  unmount();
  jest.restoreAllMocks();
});
