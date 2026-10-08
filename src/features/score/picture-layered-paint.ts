/**
 * The Windows score surface's paint: music_drawing's two-layer frame, recorded
 * into windows_canvas_rn pictures.
 *
 * Skia has no Windows target in this app, so where the other platforms record
 * an `SkPicture`, this records a `Picture` — the canvas calls as a flat list of
 * drawing commands — and `ScoreView.windows` replays each layer natively in one
 * Direct2D pass. The base is kept while only the lit notes change, exactly as
 * `createSkiaLayeredPaint` keeps its base picture.
 *
 * The recorder is passed in so this stays free of React Native: the app hands
 * it `createRecorder` (which measures text with DirectWrite), tests the plain
 * `PictureRecorder`.
 */
import { createLayeredPaint } from '@sudobility/music_drawing';
import type { CanvasScoreRenderer } from '@sudobility/music_drawing';
import type {
  Picture,
  PictureRecorder,
} from '@sudobility/windows_canvas_rn/core';

export type ScorePicture = { base: Picture; overlay: Picture };

export function createPictureLayeredPaint(
  renderer: CanvasScoreRenderer,
  recorder: (width: number, height: number) => PictureRecorder,
  size: () => { width: number; height: number },
  show: (picture: ScorePicture) => void,
) {
  const record = (draw: (ctx: PictureRecorder) => void): Picture => {
    const { width, height } = size();
    const ctx = recorder(width, height);
    draw(ctx);
    return ctx.finish();
  };
  return createLayeredPaint<Picture>(renderer, {
    record: draw => record(draw),
    present: (base, drawOverlay) =>
      show({ base, overlay: record(drawOverlay) }),
  });
}
