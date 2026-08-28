/**
 * Drawing the pages.
 *
 * Printing on every platform here works the same way: the OS gives the app a
 * page to draw on and serialises the result itself — `PrintedPdfDocument` on
 * Android, `UIPrintInteractionController` on iOS, `NSPrintOperation` on macOS.
 * None of them wants a PDF *from* the app. What they want is a drawing.
 *
 * So this produces one PNG per page with the renderer the editor already draws
 * with. What goes on which page is `print-plan.ts`'s, and every rule it
 * applies is `music_drawing`'s — shared with the web app.
 *
 * A page is drawn by rendering the score with that page's band at the top.
 * `viewport` keeps it cheap: the renderer draws only the systems intersecting
 * it, which is what the scrolling editor does every frame, so printing needs
 * no new renderer path.
 */
import { Skia } from '@shopify/react-native-skia';
// The whole module, because `createSkiaContext2D` wants the enums beside the
// factory — the same shape `ScoreView` passes it.
import * as skia from '@shopify/react-native-skia';
import {
  CanvasScoreRenderer,
  PRINT_SCALE,
  PRINT_WIDTH,
} from '@sudobility/music_drawing';
import { createSkiaContext2D } from '@sudobility/music_drawing/skia';
import type { Score } from '@sudobility/music_types';
import { printPlan } from './print-plan';
import type { PrintOptions } from './print-plan';

export type { PrintOptions } from './print-plan';
export { printPageCount } from './print-plan';

/** One rendered page, as base64 PNG — which is what the native side wants. */
export type RenderedPage = { base64: string; width: number; height: number };

export function renderPrintPages(
  score: Score,
  options: PrintOptions = {},
): RenderedPage[] {
  const { slices, pages, pageHeight, renderOptions } = printPlan(
    score,
    options,
  );
  const height = Math.round(pageHeight);

  return pages.map(page => {
    const first = slices[page.systemIndices[0]!]!;
    const last = slices[page.systemIndices[page.systemIndices.length - 1]!]!;

    const surface = Skia.Surface.MakeOffscreen(
      PRINT_WIDTH * PRINT_SCALE,
      height * PRINT_SCALE,
    );
    if (!surface) throw new Error('Could not make a surface to print onto.');

    const canvas = surface.getCanvas();
    /*
      White, not transparent. A transparent PNG prints as whatever the print
      service decides it should be, and "whatever it decides" is not something
      to hand somebody's sheet music to.
    */
    canvas.clear(Skia.Color('white'));

    const ctx = createSkiaContext2D({
      skia,
      canvas,
      width: PRINT_WIDTH,
      height,
    });
    ctx.translate(0, -first.top);
    new CanvasScoreRenderer().render(score, ctx, {
      ...renderOptions,
      viewport: { top: first.top, bottom: last.bottom },
    });

    return {
      base64: surface.makeImageSnapshot().encodeToBase64(),
      width: PRINT_WIDTH,
      height,
    };
  });
}
