/**
 * The score in a scroll view, drawing only what is on screen.
 *
 * That windowing *is* the virtualization — the renderer draws the visible
 * systems per frame, so a 200-bar score costs what a 64-bar one does. The
 * spacer below the canvas gives the scroll view the full content size so the
 * bar behaves honestly, while the canvas itself stays viewport-sized.
 *
 * **Every geometric question goes to `ScoreCanvas`** (music_drawing, see its
 * `docs/score-canvas.md`), the same object the web editor asks: the content
 * size, what a touch landed on, the tick under it, the cursor and where
 * following playback scrolls. This component used to answer those itself and
 * disagreed with the web — its viewport and hit tests mixed logical and zoomed
 * units, so they were right only at 100%, and a touch on the spacer (already
 * in content coordinates) had the scroll offset added a second time. What is
 * left here is wiring: touches, scroll views, and which callback a hit means.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '@/config/ThemeContext';
import { ScrollView, StyleSheet, View } from 'react-native';
import type {
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import {
  DARK_RENDER_THEME,
  LIGHT_RENDER_THEME,
  bindPlaybackToCanvas,
} from '@sudobility/music_drawing';
import type {
  LayoutMode,
  MeasureHit,
  RenderTheme,
} from '@sudobility/music_drawing';
import { getMusicPosition } from '@sudobility/music_types';
import type { Pitch, PitchDisplay, Score } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';
import { ScoreView } from './ScoreView';
import { PlaybackCursor } from './PlaybackCursor';
import { useScoreCanvas } from './useScoreCanvas';
import type { ScoreSelection } from './useScoreSelection';
import { useContainerSize } from '@/features/layout/useContainerSize';

export type ScrollingScoreProps = {
  score: Score;
  zoom?: number;
  /** How systems are packed: wrapped to the width, or one long system. */
  layoutMode?: LayoutMode;
  theme?: RenderTheme;
  activeTrackId?: string | null;
  /**
   * Which tracks to draw, top to bottom; absent draws every one. The editor
   * passes `selectVisibleTrackIds`, so hiding a part in the track picker hides
   * its staves — the published view has no picker and draws them all.
   */
  trackIds?: string[];
  /** What is selected; absent on the read-only published view. */
  selection?: ScoreSelection;
  /**
   * Which pitch to draw. Only the editor has this setting; a published score
   * is read in concert pitch, which is the default.
   */
  pitchDisplay?: PitchDisplay;
  /**
   * A tap landed on the sheet. Carries the exact tick, not a box fraction.
   *
   * The tick comes from the canvas, which interpolates between the drawn
   * noteheads and holds flat across the clef and time signature, so tapping
   * them puts the caret at the start of the bar rather than a fifth of the way
   * into it.
   */
  onMeasureTap?: (hit: MeasureHit, tick: number) => void;
  /**
   * A tap landed on a note. Carries the whole chord at that point.
   *
   * Absent on the published-score view, which is read-only: there is no
   * selection to make there, so a tap falls through to the measure as before.
   */
  onNoteTap?: (eventIds: string[]) => void;
  /** A tap on a track's name in the gutter: make it the active track. */
  onTrackTap?: (trackId: string) => void;
  /** A tap on the measure-number band: select that bar. */
  onMeasureSelect?: (measureIndex: number) => void;
  /**
   * A tap on a stave while note input is on.
   *
   * Carries the pitch **as drawn**; inverting the display lenses is the
   * caller's job, because only the store knows the score behind the drawing.
   * Absent when the mode is off, which is how the tap falls through to the
   * caret.
   */
  onWriteNote?: (at: {
    tick: number;
    trackId: string;
    drawnPitch: Pitch;
  }) => void;
  /**
   * A press held in place — where the web reads a right-click.
   *
   * Distinguished from a tap by *time and travel*, not by a gesture library:
   * the touch surface is a plain spacer inside a `ScrollView`, and anything
   * that claims the responder here would take the scroll with it. A press that
   * wandered more than a thumb's width was a scroll that happened to end where
   * it started, and must not open a menu.
   */
  onMeasureLongPress?: (hit: MeasureHit, tick: number) => void;
  /**
   * A hold resolved to what it was over, after that thing has been selected.
   *
   * Separate from `onMeasureLongPress`, which aims the caret at a point on a
   * stave: this says *what kind of object* the menu should be about, which is
   * the one thing the menu cannot work out for itself once it is open.
   */
  onContextGesture?: (
    target:
      | { kind: 'track'; trackId: string }
      | { kind: 'measure'; index: number }
      | { kind: 'notes' },
  ) => void;
};

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

/** How often a scroll reports back. 16ms is one frame; more is wasted repaint. */
const SCROLL_EVENT_THROTTLE = 16;

const NO_IDS: readonly string[] = [];

export function ScrollingScore({
  score,
  zoom = 1,
  layoutMode = 'page',
  theme,
  activeTrackId = null,
  trackIds,
  selection,
  pitchDisplay = 'concert',
  onMeasureTap,
  onNoteTap,
  onTrackTap,
  onMeasureSelect,
  onWriteNote,
  onMeasureLongPress,
  onContextGesture,
}: ScrollingScoreProps) {
  /*
    The canvas draws in literal colours, so it has to be told the scheme.

    VexFlow paints straight to the context and never resolves a CSS variable or
    a NativeWind class, which is why these are two hand-written palettes rather
    than tokens — the same reason the notation glyphs take a literal ink.
  */
  const { resolved } = useTheme();
  const resolvedTheme =
    theme ?? (resolved === 'dark' ? DARK_RENDER_THEME : LIGHT_RENDER_THEME);

  const { size, onLayout, measured } = useContainerSize();
  const { width, height } = size;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const verticalRef = useRef<ScrollView | null>(null);
  const horizontalRef = useRef<ScrollView | null>(null);
  const { canvas, picture, cursor, scroll } = useScoreCanvas({
    vertical: verticalRef,
    horizontal: horizontalRef,
    size: sizeRef,
  });

  /*
    Scroll offsets, in content px. A ref for the touch handler, and a signal for
    the cursor overlay, which is placed in content coordinates and has to move
    with the sheet — neither re-renders this component.
  */
  const scrollRef = useRef({ left: 0, top: 0 });
  const continuous = layoutMode === 'continuous';

  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    /*
      The score as stored, and the reading mode. The canvas applies the display
      lenses and scans the stored pitches for notes the instrument cannot play
      — once per score, where computing the drawn score here did it on every
      render of this component.
    */
    canvas.setStoredScore(score, pitchDisplay);
    if (measured && width > 0 && height > 0) {
      canvas.setView({
        width,
        height,
        zoom,
        layoutMode,
        theme: resolvedTheme,
        ...(trackIds ? { trackIds } : {}),
      });
    }
    const next = canvas.contentSize();
    setContentSize(previous =>
      previous.width === next.width && previous.height === next.height
        ? previous
        : next,
    );
  }, [
    canvas,
    score,
    pitchDisplay,
    measured,
    width,
    height,
    zoom,
    layoutMode,
    resolvedTheme,
    trackIds,
  ]);

  useLayoutEffect(() => {
    canvas.setActiveTrack(activeTrackId);
  }, [canvas, activeTrackId]);

  useLayoutEffect(() => {
    canvas.setSelectedNotes(selection?.noteIds ?? NO_IDS, {
      regenerated: selection?.regenerated ?? false,
    });
    canvas.setSelectedMeasures(selection?.measureIds ?? NO_IDS);
  }, [canvas, selection]);

  /*
    Playback — the cursor, the lit notes and following the music — is the
    shared binding's, the same rules the web runs. Bound after the effects
    above so the canvas already holds the score it will place the cursor in.
  */
  useLayoutEffect(
    () =>
      bindPlaybackToCanvas(canvas, {
        position: getMusicPosition(),
        // One decision per burst: a stop homes to 0 and then reports stopped
        // in the same call, and that is not a jump to bar 1.
        defer: work => queueMicrotask(work),
        onSounding: listener => getAppServices().player.onSounding(listener),
        // The lit notes are published as far ahead as this canvas measures
        // drawing them takes — a Skia recording and a React commit here, much
        // longer than a web repaint — so they land with the sound.
        setSoundingRenderDelay: seconds =>
          getAppServices().player.setSoundingRenderDelay(seconds),
        now: () => performance.now(),
      }),
    [canvas],
  );

  const updateScroll = useCallback(
    (left: number, top: number) => {
      scrollRef.current = { left, top };
      canvas.setScroll(left, top);
      const previous = scroll.get();
      if (previous.left !== left || previous.top !== top) {
        scroll.set({ left, top });
      }
    },
    [canvas, scroll],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateScroll(scrollRef.current.left, e.nativeEvent.contentOffset.y);
    },
    [updateScroll],
  );

  const onScrollHorizontal = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateScroll(e.nativeEvent.contentOffset.x, scrollRef.current.top);
    },
    [updateScroll],
  );

  /**
   * Where and when the current press began.
   *
   * A ref, not state: it changes on every touch and nothing renders from it.
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

      /*
        Decided before any branch returns, so holding a track's name or a bar
        number opens the menu on it just as holding a note does.
      */
      const travelled =
        start === null
          ? 0
          : Math.hypot(locationX - start.x, locationY - start.y);
      const held = start === null ? 0 : Date.now() - start.at;
      const isLongPress = held >= LONG_PRESS_MS && travelled <= LONG_PRESS_SLOP;

      /*
        The spacer scrolls with the sheet, so its touch is in content px; the
        canvas takes view px. Its own hit order is the spec's: the gutter, the
        bar-number band, a note, a stave.
      */
      const hit = canvas.hitTest({
        x: locationX - scrollRef.current.left,
        y: locationY - scrollRef.current.top,
      });
      if (!hit) return;

      switch (hit.kind) {
        case 'trackGutter':
          // Not a position in time, so the caret stays put.
          if (!onTrackTap) return;
          onTrackTap(hit.trackId);
          if (isLongPress) {
            onContextGesture?.({ kind: 'track', trackId: hit.trackId });
          }
          return;

        case 'measureNumber':
          // Selects a bar rather than moving the caret — the gesture Replace
          // Measures and regeneration are aimed with.
          if (!onMeasureSelect) return;
          onMeasureSelect(hit.measureIndex);
          if (isLongPress) {
            onContextGesture?.({ kind: 'measure', index: hit.measureIndex });
          }
          return;

        case 'note':
          /*
            A note under the press wins over the bar under it, and the whole
            chord is the target: every note of a chord shares one bounding box.
            A hold selects it first, so the menu is about what was pressed.
          */
          if (onNoteTap) {
            onNoteTap(hit.eventIds);
            if (isLongPress) onContextGesture?.({ kind: 'notes' });
            return;
          }
          break;

        case 'stave':
          /*
            Note input: a tap on a stave writes a note there instead of moving
            the caret. The pitch is what is drawn; inverting the display lenses
            is the caller's job.
          */
          if (!isLongPress && onWriteNote && hit.pitch) {
            onWriteNote({
              tick: hit.tick,
              trackId: hit.trackId,
              drawnPitch: hit.pitch,
            });
            return;
          }
          break;
      }

      const measure = { trackId: hit.trackId, measureIndex: hit.measureIndex };
      if (isLongPress) onMeasureLongPress?.(measure, hit.tick);
      else onMeasureTap?.(measure, hit.tick);
    },
    [
      canvas,
      onMeasureTap,
      onMeasureLongPress,
      onNoteTap,
      onTrackTap,
      onMeasureSelect,
      onWriteNote,
      onContextGesture,
    ],
  );

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {/* Pinned under the scroll view: the canvas is viewport-sized and never
          moves, because what changes on a scroll is which systems it draws. */}
      {measured ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ScoreView picture={picture} height={height} />
          <PlaybackCursor
            cursor={cursor}
            scroll={scroll}
            color={resolvedTheme.caret}
          />
        </View>
      ) : null}
      <ScrollView
        ref={verticalRef}
        style={styles.fill}
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE}
      >
        {/*
          The spacer carries the touch as well as the content size: the canvas
          above is `pointerEvents="none"` so scrolling still works.

          In continuous mode it is nested in a horizontal scroll view, because
          the score is then one system as wide as the whole piece. In page mode
          there is deliberately no horizontal scroller at all — adding one would
          let a reader drag the sheet sideways to nothing.
        */}
        {continuous ? (
          <ScrollView
            ref={horizontalRef}
            horizontal
            onScroll={onScrollHorizontal}
            scrollEventThrottle={SCROLL_EVENT_THROTTLE}
          >
            <View
              style={{ height: contentSize.height, width: contentSize.width }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            />
          </ScrollView>
        ) : (
          <View
            style={{ height: contentSize.height }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
