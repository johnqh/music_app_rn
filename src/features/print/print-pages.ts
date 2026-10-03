/**
 * Drawing the pages.
 *
 * Printing on every platform here works the same way: the OS gives the app a
 * page to draw on and serialises the result itself — `PrintedPdfDocument` on
 * Android, `UIPrintInteractionController` on iOS, `NSPrintOperation` on macOS.
 * None of them wants a PDF *from* the app. What they want is a drawing.
 *
 * So this produces one PNG per page with the renderer the editor already draws
 * with. What goes on which page — and which score, a part written for its
 * instrument or the marked full score — is music_drawing's `printPlan`, the
 * one the web print view uses. This app had its own `print-plan.ts`, which
 * printed every track in concert pitch with no rehearsal marks and laid page
 * turns out for the first track even across a whole score.
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
import type { PrintPlan } from '@sudobility/music_drawing';

/** One rendered page, as base64 PNG — which is what the native side wants. */
export type RenderedPage = { base64: string; width: number; height: number };

/** Lets a frame go by, so a spinner keeps turning between pages. */
function nextFrame(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Renders the plan's pages one at a time, yielding between them.
 *
 * **Each page's GPU surface and snapshot are released as soon as its PNG is
 * taken.** A page is ~3000×4000 pixels (`PRINT_WIDTH` × `PRINT_SCALE`), about
 * 48 MB as a surface; left to the garbage collector, a 21-page score held
 * hundreds of megabytes of GPU memory until long after printing. And rendering
 * every page in one synchronous loop froze the JS thread for the whole of it,
 * so nothing the reader pressed — the sheet closing, a spinner — could happen
 * until it finished.
 *
 * `isCancelled` is asked between pages; a cancelled render answers null.
 */
export async function renderPrintPages(
  plan: PrintPlan,
  isCancelled: () => boolean = () => false,
): Promise<RenderedPage[] | null> {
  const { score, slices, pages, pageHeight, renderOptions } = plan;
  const height = Math.round(pageHeight);
  const renderer = new CanvasScoreRenderer();
  const rendered: RenderedPage[] = [];

  for (const page of pages) {
    await nextFrame();
    if (isCancelled()) return null;
    const first = slices[page.systemIndices[0]!]!;
    const last = slices[page.systemIndices[page.systemIndices.length - 1]!]!;

    const surface = Skia.Surface.MakeOffscreen(
      PRINT_WIDTH * PRINT_SCALE,
      height * PRINT_SCALE,
    );
    if (!surface) throw new Error('Could not make a surface to print onto.');
    try {
      const canvas = surface.getCanvas();
      /*
        White, not transparent. A transparent PNG prints as whatever the print
        service decides it should be, and "whatever it decides" is not
        something to hand somebody's sheet music to.
      */
      canvas.clear(Skia.Color('white'));

      const ctx = createSkiaContext2D({
        skia,
        canvas,
        width: PRINT_WIDTH,
        height,
      });
      ctx.translate(0, -first.top);
      // The plan's score — the part or the marked full score, lenses applied —
      // never the stored one: slices were measured from it.
      renderer.render(score, ctx, {
        ...renderOptions,
        viewport: { top: first.top, bottom: last.bottom },
      });

      const image = surface.makeImageSnapshot();
      try {
        rendered.push({
          base64: image.encodeToBase64(),
          width: PRINT_WIDTH,
          height,
        });
      } finally {
        image.dispose();
      }
    } finally {
      surface.dispose();
    }
  }
  return rendered;
}
