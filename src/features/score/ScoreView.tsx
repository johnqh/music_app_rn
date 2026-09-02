/**
 * The score, drawn with Skia.
 *
 * The renderer is `music_drawing`'s — the same one the web app paints into a
 * `<canvas>`. Nothing about notation is reimplemented here: `createSkiaContext2D`
 * turns an `SkCanvas` into the `DrawingContext2D` the renderer wants, and that
 * one adapter is the whole of React Native support.
 *
 * Drawing happens inside `createPicture`, which records into an `SkPicture`
 * rather than painting immediately. That is what keeps a scroll cheap: the
 * picture is rebuilt only when something it depends on changes, and React
 * Native replays it without re-running VexFlow.
 *
 * Only the visible systems are drawn, per frame, exactly as on the web — that
 * windowing *is* the virtualization, and it is why a 200-bar score costs the
 * same as a 64-bar one.
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Picture,
  createPicture,
  useCanvasSize,
} from '@shopify/react-native-skia';
import * as skia from '@shopify/react-native-skia';
import {
  CanvasScoreRenderer,
  DEFAULT_SCREEN_RENDER_THEME,
  computeLayout,
} from '@sudobility/music_drawing';
import type {
  CanvasRenderOptions,
  CanvasRenderResult,
  RenderOptions,
  NoteColorRole,
  RenderTheme,
} from '@sudobility/music_drawing';
import { createSkiaContext2D } from '@sudobility/music_drawing/skia';
import type { LayoutMode } from '@sudobility/music_drawing';
import type { Score } from '@sudobility/music_types';

export type ScoreViewProps = {
  score: Score;
  zoom?: number;
  /** How systems are packed: wrapped to the width, or one long system. */
  layoutMode?: LayoutMode;
  theme?: RenderTheme;
  activeTrackId?: string | null;
  /** Vertical scroll offset in content pixels, for the drawn window. */
  scrollTop?: number;
  /**
   * Horizontal scroll offset, which only continuous mode ever has.
   *
   * Page mode fits every system inside the width, so there is nothing to
   * scroll to and this stays 0 — see the scroll box, which does not offer a
   * horizontal scroll there at all.
   */
  scrollLeft?: number;
  /** The view's real size, measured — never the display's. */
  width: number;
  height: number;
  /**
   * Which notes are lit, and why.
   *
   * Optional because the published-score view has no selection and no
   * transport — a read-only page draws every note `normal`, which is what an
   * absent map already means to the renderer.
   */
  noteColors?: ReadonlyMap<string, NoteColorRole>;
  selectedMeasureIds?: ReadonlySet<string>;
  /**
   * What the frame just drawn knows about where things are.
   *
   * Reported out rather than returned, because the things that need it are
   * siblings: the caret interpolates between the noteheads themselves (so it
   * draws exactly on the note it points at, not somewhere across the stave
   * box), and a tap has to ask which note is under it. Nothing else can know
   * either — VexFlow decides them while formatting.
   */
  onRender?: (result: CanvasRenderResult) => void;
};

export function ScoreView({
  score,
  zoom = 1,
  layoutMode = 'page',
  theme = DEFAULT_SCREEN_RENDER_THEME,
  activeTrackId = null,
  scrollTop = 0,
  scrollLeft = 0,
  width,
  height,
  noteColors,
  selectedMeasureIds,
  onRender,
}: ScoreViewProps) {
  const viewHeight = height;

  /*
    One renderer for the life of the view, not one per frame.

    It caches the built measure columns — the VexFlow objects for a measure,
    which are what cost the time — and drops them when the layout that
    positioned them changes. Constructing a new one per picture threw that
    cache away on every scroll and every colour change, and threw away the
    bbox maps with it, which is why nothing here could answer which note was
    under a tap.
  */
  const renderer = useMemo(() => new CanvasScoreRenderer(), []);

  /*
    The canvas's own measured size — the one signal that says it exists.

    A `Picture` is recorded during render and handed to a surface that may not
    have been created yet. When it has not, the picture is never painted, and
    because nothing re-renders on its own the score stayed blank until
    something else changed the picture's identity — which is why tapping it
    worked, and why a deferred `redraw()` fixed it only when the app happened
    to start fast enough.

    `useCanvasSize` calls the native view's `measure()` in a layout effect and
    puts the result in state, so it can only report a real size once that view
    is there. Keying the picture off it re-records at exactly that moment
    rather than at a guessed one. The extra `redraw()` costs nothing and covers
    the case where the picture was fine and simply never painted.
  */
  const { ref: canvasRef, size: canvasSize } = useCanvasSize();
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      canvasRef.current?.redraw();
    }
  }, [canvasRef, canvasSize.width, canvasSize.height]);

  const options: CanvasRenderOptions = useMemo(
    () => ({
      zoom,
      layoutMode,
      width,
      theme,
      activeTrackId,
      ...(noteColors ? { noteColors } : {}),
      ...(selectedMeasureIds ? { selectedMeasureIds } : {}),
      viewport: {
        top: scrollTop,
        bottom: scrollTop + viewHeight,
        left: scrollLeft,
        right: scrollLeft + width,
      },
    }),
    [
      zoom,
      layoutMode,
      width,
      theme,
      activeTrackId,
      noteColors,
      selectedMeasureIds,
      scrollTop,
      scrollLeft,
      viewHeight,
    ],
  );

  const picture = useMemo(
    () =>
      createPicture(canvas => {
        const ctx = createSkiaContext2D({
          skia,
          canvas,
          width,
          height: viewHeight,
        });
        const result = renderer.render(score, ctx, options);
        onRender?.(result);
      }),
    [
      score,
      options,
      width,
      viewHeight,
      onRender,
      renderer,
      // Re-record once the canvas reports a real size: see `useCanvasSize`.
      canvasSize.width,
      canvasSize.height,
    ],
  );

  return (
    <View style={[styles.fill, { height: viewHeight }]}>
      <Canvas ref={canvasRef} style={styles.fill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

/** Content height, so a scroll view knows how far the score actually goes. */
export function scoreContentHeight(
  score: Score,
  options: RenderOptions,
): number {
  return computeLayout(score, options).totalHeight;
}

const styles = StyleSheet.create({ fill: { flex: 1, width: '100%' } });
