/**
 * Scrolling the sheet so the playing measure stays in view.
 *
 * The decision is `playbackScrollTarget`'s, in music_drawing — the same
 * function the web app follows playback with, so the two cannot disagree about
 * where a wrap should leave the page. What lives here is the wiring: React
 * Native's scroll views are imperative handles rather than DOM elements, and
 * the position arrives from the shared playhead rather than a store field.
 *
 * The rules that matter are all in the shared function and worth restating
 * only as a pointer: page mode carries the reader's offset into the system
 * across to the next one (so track 3 at the top stays track 3 at the top),
 * continuous mode follows horizontally and never touches `scrollTop`, and the
 * horizontal clearance includes the track-info gutter, which is painted over
 * the sheet at the viewport's left edge.
 *
 * Once per measure, not per report. The playhead reports about thirty times a
 * second; re-deciding on each one would put work on the thread the audio
 * scheduler runs on for an answer that only changes when the bar does.
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import {
  boxForMeasureIndex,
  playbackScrollTarget,
} from '@sudobility/music_drawing';
import type { LayoutMode, LayoutPlan } from '@sudobility/music_drawing';
import {
  getMusicPosition,
  measureAtTick,
  measureIndexOf,
} from '@sudobility/music_types';
import type { Score } from '@sudobility/music_types';

/** How much clear space to keep between the caret and the edge it nears. */
const SCROLL_MARGIN = 40;

export type FollowPlaybackOptions = {
  score: Score | null;
  plan: LayoutPlan | null;
  layoutMode: LayoutMode;
  zoom: number;
  vertical: RefObject<ScrollView | null>;
  horizontal: RefObject<ScrollView | null>;
  scrollTop: number;
  scrollLeft: number;
  viewportWidth: number;
  viewportHeight: number;
};

export function useFollowPlayback({
  score,
  plan,
  layoutMode,
  zoom,
  vertical,
  horizontal,
  scrollTop,
  scrollLeft,
  viewportWidth,
  viewportHeight,
}: FollowPlaybackOptions): void {
  /*
    Everything the frame loop reads goes through a ref.

    The loop is created once and would otherwise capture the first render's
    scroll offsets and plan forever — the same rule the caret follows, and the
    same bug if it is broken: the sheet would chase a position measured against
    a viewport that had since moved.
  */
  const latest = useRef({
    score,
    plan,
    layoutMode,
    zoom,
    scrollTop,
    scrollLeft,
    viewportWidth,
    viewportHeight,
  });
  latest.current = {
    score,
    plan,
    layoutMode,
    zoom,
    scrollTop,
    scrollLeft,
    viewportWidth,
    viewportHeight,
  };

  const lastMeasureId = useRef<string | null>(null);

  useEffect(() => {
    const position = getMusicPosition();
    let frame = 0;
    const step = () => {
      frame = requestAnimationFrame(step);
      const now = latest.current;
      if (!now.score || !now.plan) return;

      // Track 0 by convention: every track shares the measure grid.
      const track = now.score.tracks[0];
      if (!track) return;
      const measure = measureAtTick(now.score, track.id, position.tick);
      if (!measure) return;
      if (measure.id === lastMeasureId.current) return;

      const measureIndex = measureIndexOf(now.score, measure.id);
      if (measureIndex === null) return;
      const box = boxForMeasureIndex(now.plan, 0, measureIndex);
      if (!box) return;

      // Marked handled whether or not it moves: the decision is per measure.
      lastMeasureId.current = measure.id;

      const target = playbackScrollTarget({
        plan: now.plan,
        layoutMode: now.layoutMode,
        zoom: now.zoom,
        measureIndex,
        measureX: box.x,
        measureWidth: box.width,
        scrollLeft: now.scrollLeft,
        viewportWidth: now.viewportWidth,
        scrollTop: now.scrollTop,
        viewportHeight: now.viewportHeight,
        margin: SCROLL_MARGIN,
      });
      if (!target) return;

      if (target.top !== now.scrollTop) {
        vertical.current?.scrollTo({ y: target.top, animated: true });
      }
      // Page mode never scrolls horizontally — `playbackScrollTarget` returns
      // `left: 0` there, and the box is not scrollable anyway.
      if (target.left !== now.scrollLeft) {
        horizontal.current?.scrollTo({ x: target.left, animated: true });
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [vertical, horizontal]);
}
