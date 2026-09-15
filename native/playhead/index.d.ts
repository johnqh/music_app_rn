import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export type PlayheadViewProps = ViewProps & {
  /** Ticks of the knots, ascending. */
  knotTicks: readonly number[];
  /** The x (in this view's coordinates) of each knot: the centre of the line. */
  knotXs: readonly number[];
  /** Top of the line and its height, in this view's coordinates. */
  lineTop: number;
  lineHeight: number;
  lineWidth: number;
  lineColor: string;
  /** The gutter's right edge in view px; the line hides left of it. */
  clipLeft: number;
  /** Content px scrolled horizontally, for the clip. */
  scrollLeft: number;
  /** Where the playhead was at `anchorTime`. */
  anchorTick: number;
  /** `performance.now()` when `anchorTick` was true, in milliseconds. */
  anchorTime: number;
  /** `performance.now()` when these props were rendered, to measure any clock offset. */
  sentAt: number;
  /** Ticks per second the line advances at; 0 holds it still. */
  rate: number;
  /** Bumped by every plan, so the same anchor twice is still a new plan. */
  planId: number;
};

/** Null where there is no native playhead (anywhere but the Mac). */
export const PlayheadView: ComponentType<PlayheadViewProps> | null;
