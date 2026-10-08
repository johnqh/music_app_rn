/**
 * Windows score surface.
 *
 * Skia has no Windows target in this app, so the shared renderer records into
 * a windows_canvas_rn picture — the canvas calls as a flat command list — and
 * `ScoreView.windows` replays each layer natively in one Direct2D pass.
 * Geometry, cursor motion, scrolling, and invalidation still use the same
 * CanvasScoreRenderer/ScoreCanvas path as the other platforms.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { CanvasScoreRenderer, ScoreCanvas } from '@sudobility/music_drawing';
import type { CursorMotion, CursorPath } from '@sudobility/music_drawing';
import { createRecorder } from '@sudobility/windows_canvas_rn';
import { createPictureLayeredPaint } from './picture-layered-paint';
import type { ScorePicture } from './picture-layered-paint';

export type CursorState = {
  path: CursorPath | null;
  motion: CursorMotion;
  id: number;
};

export type ScrollOffset = { left: number; top: number };

export type { ScorePicture } from './picture-layered-paint';

/** A picture on its way to the screen. */
export type ScoreFrame = ScorePicture & {
  /** The view calls this once React has committed the frame. */
  committed: () => void;
};

/**
 * Highlight latency the canvas cannot time itself, in ms: React committing the
 * new picture, then the native view replaying it on the UI thread. The canvas
 * times only `paint`, which here is recording commands.
 *
 * Left at the canvas's one-frame default, the player published the lit notes
 * that much too late and they trailed the sound and the caret.
 */
const NATIVE_DRAW_MS = 1000 / 60;
const COMMIT_SAMPLE_WEIGHT = 0.2;
const MAX_COMMIT_MS = 250;

function createCommitClock() {
  let average = 1000 / 60;
  return {
    get ms() {
      return average;
    },
    record(sample: number) {
      const clamped = Math.min(MAX_COMMIT_MS, Math.max(0, sample));
      average += (clamped - average) * COMMIT_SAMPLE_WEIGHT;
    },
  };
}

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
      picture: createSignal<ScoreFrame | null>(null),
      cursor: createSignal<CursorState>(EMPTY_CURSOR),
      scroll: createSignal<ScrollOffset>({ left: 0, top: 0 }),
    }),
    [],
  );

  const canvas = useMemo(() => {
    const renderer = new CanvasScoreRenderer();
    const commits = createCommitClock();
    const paint = createPictureLayeredPaint(
      renderer,
      createRecorder,
      () => size.current,
      picture => {
        const shownAt = performance.now();
        let reported = false;
        signals.picture.set({
          ...picture,
          committed: () => {
            if (reported) return;
            reported = true;
            commits.record(performance.now() - shownAt);
          },
        });
      },
    );
    let canvas: ScoreCanvas;
    canvas = new ScoreCanvas({
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
        paint,
        // Builds the window playback is about to scroll to ahead of time, a
        // column per task, so the page turn only has to paint. It was off
        // while page turns froze the UI thread; that was react-native-svg
        // redrawing per element, which the picture view does not do.
        prepare: (score, options) => renderer.prepare(score, options),
        showCursor: (path, motion) =>
          signals.cursor.set({ path, motion, id: signals.cursor.get().id + 1 }),
        scrollTo: target => {
          vertical.current?.scrollTo({ y: target.top, animated: false });
          horizontal.current?.scrollTo({ x: target.left, animated: false });
          // Told now, not when RNW gets round to reporting onScroll: until
          // then the canvas went on painting the old page, and the cursor —
          // already on the new system's path — was placed against the old
          // offset, off the bottom of the view.
          canvas.setScroll(target.left, target.top);
          signals.scroll.set({ left: target.left, top: target.top });
        },
        get presentLatencyMs() {
          return commits.ms + NATIVE_DRAW_MS;
        },
      },
    });
    return canvas;
  }, [horizontal, vertical, size, signals]);

  useEffect(() => () => canvas.dispose(), [canvas]);
  return { canvas, ...signals };
}
