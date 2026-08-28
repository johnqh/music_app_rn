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
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, createPicture } from '@shopify/react-native-skia';
import * as skia from '@shopify/react-native-skia';
import {
  CanvasScoreRenderer,
  DEFAULT_SCREEN_RENDER_THEME,
  computeLayout,
} from '@sudobility/music_drawing';
import type {
  CanvasRenderOptions,
  RenderOptions,
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
}: ScoreViewProps) {
  const viewHeight = height;

  const options: CanvasRenderOptions = useMemo(
    () => ({
      zoom,
      layoutMode,
      width,
      theme,
      activeTrackId,
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
        new CanvasScoreRenderer().render(score, ctx, options);
      }),
    [score, options, width, viewHeight],
  );

  return (
    <View style={[styles.fill, { height: viewHeight }]}>
      <Canvas style={styles.fill}>
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
