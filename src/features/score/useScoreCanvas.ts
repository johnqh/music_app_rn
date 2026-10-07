/**
 * The score canvas on React Native: `ScoreCanvas` with a Skia surface.
 *
 * `ScoreCanvas` (music_drawing, see its `docs/score-canvas.md`) owns every
 * geometric decision — layout, units, the cursor path, hit-testing, where
 * following playback scrolls — and the web app uses the same one. What lives
 * here is only the surface: how this platform puts a frame and a cursor on the
 * screen.
 *
 * - **Paint** records the renderer's output into an `SkPicture`, in two layers
 *   (`createSkiaLayeredPaint`): a base picture kept until something other than
 *   the lit notes changes, and a frame that replays it under the active track's
 *   notes. A change of lit notes during playback therefore records one track
 *   rather than the whole window. Recording is synchronous, so the renderer's
 *   result — the bounding boxes and note positions the cursor and hit-testing
 *   read — goes straight back to the canvas.
 * - **The cursor** arrives as a path and a motion, and the cursor view moves
 *   the line itself (see `PlaybackCursor`).
 * - **Scrolling** to follow playback jumps. The canvas redraws for every scroll
 *   offset it is shown — that is how it windows a long score — so an animated
 *   scroll would be a dozen full redraws at exactly the moment the music wraps.
 *
 * **The picture, the cursor and the scroll offset are signals, not state.**
 * Each is read by one small component (`ScoreView`, `PlaybackCursor`), so a new
 * frame re-renders that component and nothing else. They used to be state in
 * `ScrollingScore`, which re-rendered the whole score view — its hooks, its
 * scroll views and a display-lens scan of every note — for every change of lit
 * notes during playback: measured at 7% of the JavaScript thread on a dense
 * score, as much again as half the painting it existed to show.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import type { ScrollView } from 'react-native';
import * as skia from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { CanvasScoreRenderer, ScoreCanvas } from '@sudobility/music_drawing';
import type {
  CanvasScheduler,
  CursorMotion,
  CursorPath,
} from '@sudobility/music_drawing';
import { createSkiaLayeredPaint } from '@sudobility/music_drawing/skia';

const SCHEDULER: CanvasScheduler = {
  frame: callback => {
    // macOS can stop delivering animation frames to an occluded window while
    // audio and the cursor's native clock continue. Keep its score painting on
    // a timer too, so a page turn is ready when the window comes forward.
    let pending = true;
    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (!pending) return;
      pending = false;
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
      callback();
    };
    frame = requestAnimationFrame(run);
    if (Platform.OS === 'macos' && pending) timer = setTimeout(run, 32);
    return () => {
      pending = false;
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
    };
  },
  timeout: (callback, ms) => {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  },
  now: () => performance.now(),
};

export type CursorState = {
  path: CursorPath | null;
  motion: CursorMotion;
  /** Bumped by every description, so the same motion twice is still news. */
  id: number;
};

const HELD: CursorState = {
  path: null,
  motion: { tick: 0, atMs: 0, ticksPerSecond: 0 },
  id: 0,
};

/** A value one component reads, without re-rendering the one that owns it. */
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
      for (const listener of listeners) listener();
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useSignal<T>(signal: Signal<T>): T {
  return useSyncExternalStore(signal.subscribe, signal.get, signal.get);
}

/** Content px scrolled. */
export type ScrollOffset = { left: number; top: number };

export type ScoreCanvasHandles = {
  vertical: RefObject<ScrollView | null>;
  horizontal: RefObject<ScrollView | null>;
  /** The view's measured size, read when a frame is recorded. */
  size: RefObject<{ width: number; height: number }>;
};

export function useScoreCanvas({
  vertical,
  horizontal,
  size,
}: ScoreCanvasHandles) {
  const signals = useMemo(
    () => ({
      picture: createSignal<SkPicture | null>(null),
      cursor: createSignal<CursorState>(HELD),
      scroll: createSignal<ScrollOffset>({ left: 0, top: 0 }),
    }),
    [],
  );

  const canvas = useMemo(() => {
    // One renderer for the canvas's life: its column cache is what makes a
    // repaint cheap.
    const renderer = new CanvasScoreRenderer();
    const paint = createSkiaLayeredPaint(renderer, {
      skia,
      size: () => size.current,
      show: picture => signals.picture.set(picture as SkPicture),
    });
    let canvas: ScoreCanvas;
    canvas = new ScoreCanvas({
      scheduler: SCHEDULER,
      surface: {
        paint,
        // Builds the window playback is about to scroll to ahead of time, so
        // the frame that shows it does not also have to format it.
        prepare: (score, options) => renderer.prepare(score, options),
        showCursor: (path, motion) => {
          const id = signals.cursor.get().id + 1;
          signals.cursor.set({ path, motion, id });
        },
        scrollTo: target => {
          vertical.current?.scrollTo({ y: target.top, animated: false });
          horizontal.current?.scrollTo({ x: target.left, animated: false });
          // A programmatic ScrollView move may not report onScroll while the
          // window is behind another app. Update the viewport and cursor now.
          canvas.setScroll(target.left, target.top);
          signals.scroll.set({ left: target.left, top: target.top });
        },
      },
    });
    return canvas;
    // The refs and signals are stable objects; the canvas is made once.
  }, [vertical, horizontal, size, signals]);

  useEffect(() => () => canvas.dispose(), [canvas]);

  return { canvas, ...signals };
}
