/**
 * Turning a touch into a place in the score.
 *
 * Geometry stays in the app — the same split music_app makes. A `LayoutPlan`
 * comes from music_drawing; what a finger at (x, y) *means* is a question about
 * a pointer, and answering it is UI work.
 *
 * Coordinates arriving here are **content** coordinates: the caller adds the
 * scroll offset, because only it knows how far the view has been scrolled.
 *
 * Measure-level, deliberately. Note boxes live in the renderer's result rather
 * than the layout plan, so hitting a notehead means threading that result out
 * of the draw; a measure is enough to move the caret and pick a bar, which is
 * what a touch is usually for. Notes are the next step, not a missing half.
 */
import type { LayoutPlan } from '@sudobility/music_drawing';

export type ScorePoint = { x: number; y: number };

export type MeasureHit = {
  trackId: string;
  measureIndex: number;
  /** 0 at the left barline, 1 at the right — where along the bar the touch was. */
  fraction: number;
};

/**
 * The measure under the point, or null.
 *
 * Nearest by centre rather than first match: staves for different tracks are
 * stacked and their boxes can abut, so iteration order would otherwise decide
 * which track a touch on the boundary belonged to.
 */
export function measureAt(
  plan: LayoutPlan,
  point: ScorePoint,
): MeasureHit | null {
  let best: { hit: MeasureHit; distance: number } | null = null;

  for (const trackLayout of plan.trackLayouts) {
    for (const measure of trackLayout.measures) {
      const { x, y, width, height } = measure.box;
      if (point.x < x || point.x > x + width) continue;
      if (point.y < y || point.y > y + height) continue;
      const dx = x + width / 2 - point.x;
      const dy = y + height / 2 - point.y;
      const distance = dx * dx + dy * dy;
      if (best && distance >= best.distance) continue;
      best = {
        distance,
        hit: {
          trackId: trackLayout.track.id,
          measureIndex: measure.measureIndex,
          // Guarded: a zero-width bar would otherwise divide by zero and give
          // a caret position of NaN, which reads as "the caret vanished".
          fraction: width > 0 ? (point.x - x) / width : 0,
        },
      };
    }
  }
  return best?.hit ?? null;
}

/**
 * The score tick a touch lands on, snapped to nothing.
 *
 * Interpolated across the bar rather than snapped to a beat: the caller decides
 * whether to snap, because inserting a note wants the toolbar's grid while
 * "play from here" wants exactly where the finger went.
 */
export function tickAt(
  hit: MeasureHit,
  measureStartTick: number,
  measureDurationTicks: number,
): number {
  return Math.round(measureStartTick + hit.fraction * measureDurationTicks);
}
