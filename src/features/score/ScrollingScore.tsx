/**
 * The score in a scroll view, drawing only what is on screen.
 *
 * That windowing *is* the virtualization — the renderer draws the visible
 * systems per frame, so a 200-bar score costs what a 64-bar one does. The
 * spacer below the canvas gives the scroll view the full content height so the
 * bar behaves honestly, while the canvas itself stays viewport-sized.
 *
 * Scroll offset is held in state deliberately, unlike playback position: it
 * changes only while a finger is moving, and each change genuinely does need a
 * repaint, because it changes which systems are on screen.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type {
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import {
  DEFAULT_SCREEN_RENDER_THEME,
  computeLayout,
} from '@sudobility/music_drawing';
import type { LayoutMode, RenderTheme } from '@sudobility/music_drawing';
import { displayScore } from '@sudobility/music_types';
import type { PitchDisplay, Score } from '@sudobility/music_types';
import { ScoreView } from './ScoreView';
import { PlaybackCaret } from './PlaybackCaret';
import { useContainerSize } from '@/features/layout/useContainerSize';
import { measureAt } from './hit-test';
import type { MeasureHit } from './hit-test';

export type ScrollingScoreProps = {
  score: Score;
  zoom?: number;
  /** How systems are packed: wrapped to the width, or one long system. */
  layoutMode?: LayoutMode;
  theme?: RenderTheme;
  activeTrackId?: string | null;
  /**
   * Which pitch to draw. Only the editor has this setting; a published score
   * is read in concert pitch, which is the default.
   */
  pitchDisplay?: PitchDisplay;
  /** A tap on the music, already resolved to a bar. */
  onMeasureTap?: (hit: MeasureHit) => void;
  /**
   * A press held in place — where the web reads a right-click.
   *
   * Distinguished from a tap by *time and travel*, not by a gesture library:
   * the touch surface is a plain spacer inside a `ScrollView`, and anything
   * that claims the responder here would take the scroll with it. A press that
   * wandered more than a thumb's width was a scroll that happened to end where
   * it started, and must not open a menu.
   */
  onMeasureLongPress?: (hit: MeasureHit) => void;
};

/** How often a scroll reports back. 16ms is one frame; more is wasted repaint. */
/**
 * How long a press must be held to read as a long press, and how far it may
 * wander while doing so.
 *
 * 500ms is the platform's own long-press threshold on both iOS and Android, so
 * this agrees with every other long press the reader has ever made. The slop is
 * about a thumb's width: a press that travelled further was a scroll that
 * happened to end where it started.
 */
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 12;

const SCROLL_EVENT_THROTTLE = 16;

export function ScrollingScore({
  score,
  zoom = 1,
  layoutMode = 'page',
  theme = DEFAULT_SCREEN_RENDER_THEME,
  activeTrackId = null,
  pitchDisplay = 'concert',
  onMeasureTap,
  onMeasureLongPress,
}: ScrollingScoreProps) {
  const { size, onLayout, measured } = useContainerSize();
  const { width, height } = size;
  const [scrollTop, setScrollTop] = useState(0);
  /*
    Only continuous mode ever has one. Page mode fits every system inside the
    width — both margins come out of the packing budget — so a horizontal scroll
    there could only slide the sheet under nothing.
  */
  const [scrollLeft, setScrollLeft] = useState(0);
  const continuous = layoutMode === 'continuous';

  /*
    The score as drawn, not as stored — octave brackets moved to where they are
    written, and transposing instruments in written pitch if that is the mode.
    Everything below reads this rather than `score`, so the layout, the canvas
    and the caret cannot disagree about where a note is. The lens composition
    itself is music_types'; this is only where the app applies it. It returns
    its input untouched when neither half applies, which is almost every score,
    so the identity cache below is unaffected.
  */
  const drawn = useMemo(
    () => displayScore(score, pitchDisplay),
    [score, pitchDisplay],
  );

  // Content height comes from the layout, which `computeLayout` caches on score
  // identity — so this is not a second pass over the score per frame.
  const plan = useMemo(
    () =>
      computeLayout(drawn, {
        zoom,
        layoutMode,
        width,
        theme,
      }),
    [drawn, zoom, layoutMode, width, theme],
  );
  const contentHeight = plan.totalHeight;

  /**
   * A tap, in content coordinates.
   *
   * The scroll offset is added here because only this component knows it — the
   * canvas is pinned to the viewport and never moves, so the touch's y is a
   * viewport y and the music's is not.
   */
  /**
   * Where and when the current press began.
   *
   * A ref, not state: it changes on every touch and nothing renders from it,
   * so putting it in state would re-render the score on each press.
   */
  const pressStart = useRef<{ x: number; y: number; at: number } | null>(null);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    pressStart.current = { x: locationX, y: locationY, at: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const start = pressStart.current;
      pressStart.current = null;

      const hit = measureAt(plan, {
        x: locationX + scrollLeft,
        y: locationY + scrollTop,
      });
      if (!hit) return;

      const travelled =
        start === null
          ? 0
          : Math.hypot(locationX - start.x, locationY - start.y);
      const held = start === null ? 0 : Date.now() - start.at;
      const isLongPress = held >= LONG_PRESS_MS && travelled <= LONG_PRESS_SLOP;

      if (isLongPress && onMeasureLongPress) onMeasureLongPress(hit);
      else if (!isLongPress) onMeasureTap?.(hit);
    },
    [onMeasureTap, onMeasureLongPress, plan, scrollTop, scrollLeft],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollTop(e.nativeEvent.contentOffset.y);
  }, []);

  const onScrollHorizontal = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollLeft(e.nativeEvent.contentOffset.x);
    },
    [],
  );

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {/* Pinned under the scroll view: the canvas is viewport-sized and never
          moves, because what changes on a scroll is which systems it draws. */}
      {measured ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ScoreView
            score={drawn}
            width={width}
            height={height}
            zoom={zoom}
            layoutMode={layoutMode}
            theme={theme}
            activeTrackId={activeTrackId}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
          />
          {/*
            Over the canvas, under nothing: the caret is absolutely positioned
            in the same content space the renderer draws in, so it needs the
            scroll offset to sit where the music is.
          */}
          <PlaybackCaret
            score={drawn}
            plan={plan}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
          />
        </View>
      ) : null}
      <ScrollView
        style={styles.fill}
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE}
      >
        {/*
          The spacer carries the touch as well as the content height: the canvas
          above is `pointerEvents="none"` so scrolling still works.

          In continuous mode it is nested in a horizontal scroll view, because
          the score is then one system as wide as the whole piece. In page mode
          there is deliberately no horizontal scroller at all — adding one would
          let a reader drag the sheet sideways to nothing.
        */}
        {continuous ? (
          <ScrollView
            horizontal
            onScroll={onScrollHorizontal}
            scrollEventThrottle={SCROLL_EVENT_THROTTLE}
          >
            <View
              style={{ height: contentHeight, width: plan.totalWidth }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            />
          </ScrollView>
        ) : (
          <View
            style={{ height: contentHeight }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
