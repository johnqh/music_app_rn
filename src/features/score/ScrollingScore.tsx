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
  computeLayout,
  eventIdAtPoint,
  eventIdsAtPoint,
  measureAtPoint,
  measureIndexAtGutterPoint,
  pitchAtStavePoint,
  trackIdAtGutterPoint,
  tickForPoint,
} from '@sudobility/music_drawing';
import type {
  CanvasRenderResult,
  LayoutMode,
  MeasureHit,
  NoteColorRole,
  RenderTheme,
} from '@sudobility/music_drawing';
import { displayScore } from '@sudobility/music_types';
import type { Pitch, PitchDisplay, Score } from '@sudobility/music_types';
import { ScoreView } from './ScoreView';
import { PlaybackCaret } from './PlaybackCaret';
import { useFollowPlayback } from './useFollowPlayback';
import { useContainerSize } from '@/features/layout/useContainerSize';

export type ScrollingScoreProps = {
  score: Score;
  zoom?: number;
  /** How systems are packed: wrapped to the width, or one long system. */
  layoutMode?: LayoutMode;
  theme?: RenderTheme;
  activeTrackId?: string | null;
  /** Which notes are lit; absent on the read-only published view. */
  noteColors?: ReadonlyMap<string, NoteColorRole>;
  selectedMeasureIds?: ReadonlySet<string>;
  /**
   * Which pitch to draw. Only the editor has this setting; a published score
   * is read in concert pitch, which is the default.
   */
  pitchDisplay?: PitchDisplay;
  /** A tap on the music, already resolved to a bar. */
  /**
   * A tap landed on the sheet. Carries the exact tick, not a box fraction.
   *
   * Resolved here because this is where the drawn note positions are: the tick
   * comes from `tickForPoint`, which interpolates between the noteheads and
   * holds flat across the clef and time signature, so tapping them puts the
   * caret at the start of the bar rather than a fifth of the way into it.
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
  theme,
  activeTrackId = null,
  noteColors,
  selectedMeasureIds,
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
    than tokens — the same reason the notation glyphs take a literal ink. This
    app had only the light one until `render-theme` moved into music_drawing
    with the rest of the canvas geometry: in dark mode it drew near-black
    noteheads on a dark page.
  */
  const { resolved } = useTheme();
  const resolvedTheme =
    theme ?? (resolved === 'dark' ? DARK_RENDER_THEME : LIGHT_RENDER_THEME);

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
        theme: resolvedTheme,
      }),
    [drawn, zoom, layoutMode, width, resolvedTheme],
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

      const point = { x: locationX + scrollLeft, y: locationY + scrollTop };

      /*
        Decided here, before any branch returns.

        It used to be worked out further down, after the track gutter and the
        measure gutter had each already returned — so holding a track's name or
        a bar number was indistinguishable from tapping it, and the context menu
        could only ever be opened over a note or a stave. Those are two of the
        three things the menu is *about*.
      */
      const travelled =
        start === null
          ? 0
          : Math.hypot(locationX - start.x, locationY - start.y);
      const held = start === null ? 0 : Date.now() - start.at;
      const isLongPress = held >= LONG_PRESS_MS && travelled <= LONG_PRESS_SLOP;

      /*
        The track-info gutter first, in **viewport** coordinates.

        The gutter is painted over the sheet at the viewport's left edge rather
        than at content x=0, so in continuous mode it does not scroll with the
        music — which is the one place this app's hit tests differ. Tapping a
        track's name makes it active; it is not a position in time, so the
        caret stays put.
      */
      const gutterTrackId = onTrackTap
        ? trackIdAtGutterPoint(plan, zoom, scrollTop, {
            x: locationX,
            y: locationY,
          })
        : null;
      if (gutterTrackId) {
        onTrackTap?.(gutterTrackId);
        if (isLongPress)
          onContextGesture?.({ kind: 'track', trackId: gutterTrackId });
        return;
      }

      /*
        Then the measure-number band above each system, which selects a bar
        rather than moving the caret — the gesture Replace Measures and
        regeneration are aimed with.
      */
      const gutterMeasure = onMeasureSelect
        ? measureIndexAtGutterPoint(plan, point)
        : null;
      if (gutterMeasure !== null) {
        onMeasureSelect?.(gutterMeasure);
        if (isLongPress)
          onContextGesture?.({ kind: 'measure', index: gutterMeasure });
        return;
      }

      const hit = measureAtPoint(plan, point);
      if (!hit) return;

      const tick =
        tickForPoint(
          plan,
          drawn,
          point.x,
          point.y,
          frameRef.current?.measureNotePositions,
        ) ?? 0;

      if (isLongPress) {
        /*
          A note under the hold still selects that note first, so the menu is
          about what was pressed rather than about the bar around it — the same
          select-then-open the web's right-click does.
        */
        const heldBox = frameRef.current?.idToBBox;
        const heldNote = heldBox ? eventIdAtPoint(heldBox, point) : null;
        if (heldNote && onNoteTap) {
          const chordIds = eventIdsAtPoint(heldBox!, point);
          onNoteTap(chordIds.length > 0 ? chordIds : [heldNote]);
          onContextGesture?.({ kind: 'notes' });
          return;
        }
        onMeasureLongPress?.(hit, tick);
        return;
      }

      /*
        A note under the tap wins over the measure under it.

        The whole chord, not one arbitrary member: every note of a chord shares
        one bounding box, so "which one did you tap" is not a question the
        geometry can answer — the same rule the web app follows. Nothing here
        could ask this at all until the renderer was kept across frames, so
        tapping a note simply moved the caret and left it unselected.
      */
      const idToBBox = frameRef.current?.idToBBox;
      if (idToBBox && onNoteTap) {
        const noteId = eventIdAtPoint(idToBBox, point);
        if (noteId) {
          const chordIds = eventIdsAtPoint(idToBBox, point);
          onNoteTap(chordIds.length > 0 ? chordIds : [noteId]);
          return;
        }
      }
      /*
        Note input: a tap on a stave writes a note there instead of moving the
        caret. Only in the mode, because aiming the caret and placing a note
        are both needed and a tap cannot mean two things.

        `hit.pitch` is what is **drawn** at that point, and the drawing has been
        through the display lenses — an octave bracket and a transposing
        instrument both move noteheads away from the sounding pitch. Storing it
        raw writes a note an octave or a tone out, silently, because it then
        draws exactly where it was tapped and only sounds wrong. Inverting them
        is this view's job, since only it knows what was drawn.
      */
      if (onWriteNote) {
        const stave = pitchAtStavePoint(plan, drawn, point);
        if (stave) {
          onWriteNote({
            tick,
            trackId: stave.trackId,
            drawnPitch: stave.pitch,
          });
          return;
        }
      }

      onMeasureTap?.(hit, tick);
    },
    [
      onMeasureTap,
      onMeasureLongPress,
      onNoteTap,
      onTrackTap,
      onMeasureSelect,
      onWriteNote,
      zoom,
      plan,
      drawn,
      scrollTop,
      scrollLeft,
    ],
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

  /*
    What the last frame drew, held in a ref rather than state.

    Two things read it. The caret interpolates between the noteheads VexFlow
    actually drew, not across the stave box — which begins at the barline and
    spends its left edge on clef, key and time signature. And a tap asks which
    note is under it, which is a question only the drawn bounding boxes can
    answer.

    A ref because the renderer reports this on every draw and the caret reads
    it inside its frame loop: putting it in state would re-render the whole
    score on each frame.
  */
  /*
    The scroll views, so playback can follow. Refs rather than state: nothing
    renders from them, and `useFollowPlayback` reads them inside a frame loop.
  */
  const verticalRef = useRef<ScrollView | null>(null);
  const horizontalRef = useRef<ScrollView | null>(null);

  const frameRef = useRef<CanvasRenderResult | null>(null);
  const handleRender = useCallback((result: CanvasRenderResult) => {
    frameRef.current = result;
  }, []);
  const readNotePositions = useCallback(
    () => frameRef.current?.measureNotePositions,
    [],
  );

  /*
    Following playback. The decision is `playbackScrollTarget`'s, shared with
    the web, so a wrap leaves the page in the same place on both.
  */
  useFollowPlayback({
    score: drawn,
    plan,
    layoutMode,
    zoom,
    vertical: verticalRef,
    horizontal: horizontalRef,
    scrollTop,
    scrollLeft,
    viewportWidth: width,
    viewportHeight: height,
  });

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
            theme={resolvedTheme}
            activeTrackId={activeTrackId}
            {...(noteColors ? { noteColors } : {})}
            {...(selectedMeasureIds ? { selectedMeasureIds } : {})}
            onRender={handleRender}
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
            notePositions={readNotePositions}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
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
          The spacer carries the touch as well as the content height: the canvas
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
