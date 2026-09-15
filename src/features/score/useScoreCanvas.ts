/**
 * The score canvas on React Native: `ScoreCanvas` with a Skia surface.
 *
 * `ScoreCanvas` (music_drawing, see its `docs/score-canvas.md`) owns every
 * geometric decision — layout, units, the cursor path, hit-testing, where
 * following playback scrolls — and the web app uses the same one. What lives
 * here is only the surface: how this platform puts a frame and a cursor on the
 * screen.
 *
 * - **Paint** records the renderer's output into an `SkPicture` and hands it to
 *   React as state. Recording is synchronous, so the renderer's result — the
 *   bounding boxes and note positions the cursor and hit-testing read — goes
 *   straight back to the canvas.
 * - **The cursor** arrives as a path and a motion, also as state, and the
 *   cursor view moves the line itself (see `PlaybackCursor`).
 * - **Scrolling** to follow playback jumps. The canvas redraws for every scroll
 *   offset it is shown — that is how it windows a long score — so an animated
 *   scroll would be a dozen full redraws at exactly the moment the music wraps.
 */
import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { createPicture } from '@shopify/react-native-skia';
import * as skia from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { CanvasScoreRenderer, ScoreCanvas } from '@sudobility/music_drawing';
import type {
  CanvasRenderResult,
  CanvasScheduler,
  CursorMotion,
  CursorPath,
} from '@sudobility/music_drawing';
import { createSkiaContext2D } from '@sudobility/music_drawing/skia';

const SCHEDULER: CanvasScheduler = {
  frame: callback => {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
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
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [cursor, setCursor] = useState<CursorState>(HELD);

  const canvas = useMemo(() => {
    // One renderer for the canvas's life: its column cache is what makes a
    // repaint cheap.
    const renderer = new CanvasScoreRenderer();
    return new ScoreCanvas({
      scheduler: SCHEDULER,
      surface: {
        paint: (score, options) => {
          let result: CanvasRenderResult | null = null;
          const { width, height } = size.current;
          const recorded = createPicture(skCanvas => {
            const ctx = createSkiaContext2D({
              skia,
              canvas: skCanvas,
              width,
              height,
            });
            result = renderer.render(score, ctx, options);
          });
          setPicture(recorded);
          return result;
        },
        showCursor: (path, motion) =>
          setCursor(previous => ({ path, motion, id: previous.id + 1 })),
        scrollTo: target => {
          vertical.current?.scrollTo({ y: target.top, animated: false });
          horizontal.current?.scrollTo({ x: target.left, animated: false });
        },
      },
    });
    // The refs are stable objects; the canvas is made once.
  }, [vertical, horizontal, size]);

  useEffect(() => () => canvas.dispose(), [canvas]);

  return { canvas, picture, cursor };
}
