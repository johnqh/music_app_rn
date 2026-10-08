import { jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { PlaybackCursor } from './PlaybackCursor.windows';
import type { CursorState, Signal } from './useScoreCanvas';

const mockNativeProps =
  jest.fn<
    (props: {
      style: { opacity: number; height?: number; transform?: unknown[] };
    }) => void
  >();
jest.mock('react-native', () => {
  const React = require('react');
  const native = Object.create(jest.requireActual('react-native'));
  Object.defineProperty(native, 'View', {
    value: React.forwardRef((_props: unknown, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        setNativeProps: mockNativeProps,
      }));
      return null;
    }),
  });
  return native;
});
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
it('samples the current shared motion and atomically applies a new row and scroll offset', () => {
  let now = 1000;
  let nextFrame: ((time: number) => void) | undefined;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    nextFrame = callback;
    return 1;
  });
  const cancel = jest.spyOn(global, 'cancelAnimationFrame');
  const cursor = signal<CursorState>({
    path: {
      systemIndex: 0,
      ticks: [0, 50, 100],
      xs: [0, 150, 200],
      top: 20,
      height: 80,
      clipLeft: 0,
    },
    motion: { tick: 0, atMs: 0, ticksPerSecond: 10 },
    id: 1,
  });
  const scroll = signal({ left: 0, top: 0 });
  const view = render(
    <PlaybackCursor cursor={cursor} scroll={scroll} color="red" />,
  );
  expect(mockNativeProps.mock.calls.at(-1)?.[0].style.transform).toEqual([
    { translateX: 29 },
    { translateY: 20 },
  ]);
  now = 5000;
  act(() => nextFrame?.(now));
  expect(mockNativeProps.mock.calls.at(-1)?.[0].style.transform).toEqual([
    { translateX: 149 },
    { translateY: 20 },
  ]);
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
      motion: { tick: 50, atMs: now, ticksPerSecond: 10 },
      id: 2,
    }),
  );
  expect(mockNativeProps.mock.calls.at(-1)?.[0].style.transform).toEqual([
    { translateX: 299 },
    { translateY: 120 },
  ]);
  act(() => scroll.set({ left: 310, top: 100 }));
  expect(mockNativeProps.mock.calls.at(-1)?.[0].style).toEqual({
    opacity: 0,
    height: 80,
    transform: [{ translateX: -11 }, { translateY: 20 }],
  });
  view.unmount();
  expect(cancel).toHaveBeenCalled();
  jest.restoreAllMocks();
});
