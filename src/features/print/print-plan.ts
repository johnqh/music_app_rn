/**
 * How a score divides onto pages — with no renderer involved.
 *
 * Split from `print-pages.ts` because it needs nothing to draw with: which
 * systems land on which page, and how tall a page is, are decisions over a
 * `LayoutPlan`. Keeping them here means they can be tested under `node` with
 * no Skia and no React Native, which is the same reason `hit-test.ts` and
 * `snapshot-tree.ts` are shaped the way they are.
 *
 * Every rule it applies is `music_drawing`'s, shared with the web app.
 */
import {
  PRINT_WIDTH,
  computeLayout,
  paginate,
  printRenderOptions,
  printSystems,
  usablePageHeight,
} from '@sudobility/music_drawing';
import type {
  LayoutPlan,
  PaperOrientation,
  PaperSize,
  PrintPage,
  PrintSystemSlice,
} from '@sudobility/music_drawing';
import { displayScore } from '@sudobility/music_types';
import type { Score } from '@sudobility/music_types';

export type PrintOptions = {
  paper?: PaperSize;
  orientation?: PaperOrientation;
  /** Which tracks to print. Empty means every one. */
  trackIds?: readonly string[];
};

export type PrintPlan = {
  plan: LayoutPlan;
  slices: PrintSystemSlice[];
  pages: PrintPage[];
  /** In the same logical units the layout uses, not millimetres. */
  pageHeight: number;
  renderOptions: ReturnType<typeof printRenderOptions>;
};

export function printPlan(score: Score, options: PrintOptions = {}): PrintPlan {
  const paper = options.paper ?? 'a4';
  const orientation = options.orientation ?? 'portrait';
  const renderOptions = printRenderOptions(options.trackIds ?? []);
  /*
    Printed from the drawn score, not the stored one, for the same reason the
    screen is: an octave bracket moves its noteheads to where they are written.
    Concert pitch on paper — a printed part carries no pitch-display setting,
    and `printRenderOptions` already strips the other editing state.
  */
  const plan = computeLayout(displayScore(score), renderOptions);
  const pageHeight = usablePageHeight(paper, orientation, PRINT_WIDTH);

  /*
    Page turns are laid out for the *first printed track*. A turn should land
    where that player has bars free to reach for the page, which is what
    `paginate`'s turn-track argument is for; with no track it fills each page
    greedily instead.
  */
  const printed = options.trackIds ?? [];
  const turnTrack =
    printed.length === 0
      ? score.tracks[0]
      : score.tracks.find(track => printed.includes(track.id));

  const pages = paginate(plan, pageHeight, turnTrack).filter(
    // A page holding no systems is a page turn onto silence.
    page => page.systemIndices.length > 0,
  );

  return { plan, slices: printSystems(plan), pages, pageHeight, renderOptions };
}

/** How many pages a score prints to, without rendering any of them. */
export function printPageCount(
  score: Score,
  options: PrintOptions = {},
): number {
  return printPlan(score, options).pages.length;
}
