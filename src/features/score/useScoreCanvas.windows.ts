/**
 * Windows score surface.
 *
 * Skia has no Windows target in this app, so the shared renderer records into
 * a small SVG drawing context and the native SVG view displays that result.
 * Geometry, cursor motion, scrolling, and invalidation still use the same
 * CanvasScoreRenderer/ScoreCanvas path as the other platforms.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { CanvasScoreRenderer, ScoreCanvas } from '@sudobility/music_drawing';
import type { CursorMotion, CursorPath } from '@sudobility/music_drawing';
import { SvgDrawingContext } from './svg-context';

export type CursorState = {
  path: CursorPath | null;
  motion: CursorMotion;
  id: number;
};

export type ScrollOffset = { left: number; top: number };

export type Signal<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useSignal<T>(signal: Signal<T>): T {
  return useSyncExternalStore(signal.subscribe, signal.get, signal.get);
}

export type ScoreCanvasHandles = {
  vertical: RefObject<ScrollView | null>;
  horizontal: RefObject<ScrollView | null>;
  size: RefObject<{ width: number; height: number }>;
};

const EMPTY_CURSOR: CursorState = {
  path: null,
  motion: { tick: 0, atMs: 0, ticksPerSecond: 0 },
  id: 0,
};

export function useScoreCanvas({
  vertical,
  horizontal,
  size,
}: ScoreCanvasHandles) {
  const signals = useMemo(
    () => ({
      picture: createSignal<string | null>(null),
      cursor: createSignal<CursorState>(EMPTY_CURSOR),
      scroll: createSignal<ScrollOffset>({ left: 0, top: 0 }),
    }),
    [],
  );

  const canvas = useMemo(() => {
    const renderer = new CanvasScoreRenderer();
    return new ScoreCanvas({
      scheduler: {
        frame: callback => {
          const id = requestAnimationFrame(callback);
          return () => cancelAnimationFrame(id);
        },
        timeout: (callback, ms) => {
          const id = setTimeout(callback, ms);
          return () => clearTimeout(id);
        },
        now: () => performance.now(),
      },
      surface: {
        paint: (score, options) => {
          const context = new SvgDrawingContext(
            size.current.width,
            size.current.height,
          );
          const result = renderer.render(score, context, options);
          signals.picture.set(context.toSvg());
          return result;
        },
        prepare: (score, options) => renderer.prepare(score, options),
        showCursor: (path, motion) =>
          signals.cursor.set({ path, motion, id: signals.cursor.get().id + 1 }),
        scrollTo: target => {
          vertical.current?.scrollTo({ y: target.top, animated: false });
          horizontal.current?.scrollTo({ x: target.left, animated: false });
        },
      },
    });
  }, [horizontal, vertical, size, signals]);

  useEffect(() => () => canvas.dispose(), [canvas]);
  return { canvas, ...signals };
}
