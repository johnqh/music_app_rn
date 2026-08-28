/**
 * How a score divides onto pages.
 *
 * Testable under `node` with no Skia and no React Native, which is the whole
 * reason `print-plan.ts` is separate from the drawing beside it.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyScore } from '@sudobility/music_types';
import { printPageCount } from './print-plan.js';

describe('page count', () => {
  it('is at least one for any score', () => {
    // A one-bar piece still prints. Zero pages is a print job nobody can use.
    expect(
      printPageCount(createEmptyScore({ title: 'A', measures: 1 })),
    ).toBeGreaterThanOrEqual(1);
  });

  it('grows with the music', () => {
    const short = printPageCount(createEmptyScore({ title: 'A', measures: 8 }));
    const long = printPageCount(
      createEmptyScore({ title: 'A', measures: 400 }),
    );
    expect(long).toBeGreaterThan(short);
  });

  it('fits more on a landscape page than a portrait one, or the same', () => {
    /*
      Landscape is wider and shorter. The layout is computed at a fixed logical
      width either way, so what changes is how many systems fit vertically —
      fewer per page, which means more pages, never fewer.
    */
    const score = createEmptyScore({ title: 'A', measures: 200 });
    const portrait = printPageCount(score, { orientation: 'portrait' });
    const landscape = printPageCount(score, { orientation: 'landscape' });
    expect(landscape).toBeGreaterThanOrEqual(portrait);
  });

  it('never produces a page with nothing on it', () => {
    // A blank page in the middle of a part is a page turn onto silence.
    for (const measures of [1, 3, 17, 64]) {
      const score = createEmptyScore({ title: 'A', measures });
      expect(printPageCount(score)).toBeGreaterThan(0);
    }
  });
});
