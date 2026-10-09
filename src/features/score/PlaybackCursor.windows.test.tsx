import { jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { PlaybackCursor } from './PlaybackCursor.windows';
import type { CursorState, Signal } from './useScoreCanvas';

const mockPlans: Array<Record<string, unknown>> = [];
jest.mock('./WindowsPlayheadNativeComponent', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPlans.push(props);
    return null;
  },
}));
function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      value = next;
      listeners.forEach(f => f());
    },
    subscribe: f => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}
it('hands timing and scroll to a native view without a JavaScript frame loop', () => {
  let now = 1000;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  const raf = jest.spyOn(global, 'requestAnimationFrame');
  const cursor = signal<CursorState>({
    path: {
      systemIndex: 0,
      ticks: [0, 50, 100],
      xs: [0, 150, 200],
      top: 20,
      height: 80,
      clipLeft: 40,
    },
    motion: { tick: 0, atMs: 0, ticksPerSecond: 10 },
    id: 1,
  });
  const scroll = signal({ left: 0, top: 0 });
  const view = render(
    <PlaybackCursor cursor={cursor} scroll={scroll} color="#ff0000" />,
  );
  expect(mockPlans.at(-1)).toMatchObject({
    times: [0, 4000, 9000],
    positions: [30, 150, 200],
    sentAt: 1000,
    lineTop: 20,
    lineHeight: 80,
    clipLeft: 40,
    lineColor: 0xffff0000,
  });
  now = 5000;
  act(() => scroll.set({ left: 310, top: 100 }));
  // Scrolling preserves the animation's timestamp; native time advances it.
  expect(mockPlans.at(-1)).toMatchObject({
    sentAt: 1000,
    scrollLeft: 310,
    scrollTop: 100,
  });
  act(() =>
    cursor.set({
      path: {
        systemIndex: 1,
        ticks: [50, 100],
        xs: [300, 400],
        top: 120,
        height: 80,
        clipLeft: 0,
      },
      motion: { tick: 50, atMs: now, ticksPerSecond: 0 },
      id: 2,
    }),
  );
  expect(mockPlans.at(-1)).toMatchObject({
    positions: [300],
    times: [0],
    sentAt: 5000,
    lineTop: 120,
  });
  expect(raf).not.toHaveBeenCalled();
  view.unmount();
  jest.restoreAllMocks();
});
