/**
 * The red playhead line, over the score.
 *
 * **It reads the shared playhead, and does no smoothing of its own.** The
 * engine samples position through a scheduling loop, so its ~30Hz reports
 * arrive in clumps and something has to project between them — but that
 * projection lives in `MusicPosition` in music_types, which every reader of
 * the playhead shares, and this repaints from it every frame.
 *
 * It used to dead-reckon here instead, off `player.onPosition` and
 * `Date.now()`, which is the design music_types replaced and which was wrong
 * in two visible ways. Anchoring on **receipt** folds in however long the
 * event loop took to deliver the report, so under load the caret ran behind
 * the notes it was pointing at. And `moveTo` — what note entry calls to step
 * the caret past what was just written — reaches the position source's
 * subscribers, not the engine's report stream, so a note written by the
 * keyboard left the caret sitting at the beginning of the score even though
 * the note itself landed in the right bar.
 *
 * The position is written to `Animated.Value`s rather than React state, so a
 * frame costs a transform and not a render of the notation underneath it.
 *
 * React Native's own `Animated`, not Reanimated: this needs no worklet and no
 * native module, and the values it drives — `translateX`, `translateY`,
 * `height` — are layout properties the native driver could not take anyway.
 * Adding Reanimated here would buy nothing and cost a native dependency.
 *
 * A fermata still slows the caret with the music, because the shared playhead
 * is projected against the score's own tempo map by the one place that owns
 * it — rather than by each reader keeping a `TempoMap` of its own.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { caretPositionForTick } from '@sudobility/music_drawing';
import type { LayoutPlan, NotePositions } from '@sudobility/music_drawing';
import { getMusicPosition } from '@sudobility/music_types';
import type { Score } from '@sudobility/music_types';

export type PlaybackCaretProps = {
  score: Score;
  plan: LayoutPlan;
  /** Content pixels scrolled, so the caret sits where the music is drawn. */
  scrollTop: number;
  /**
   * Horizontal scroll offset, which only continuous mode ever has.
   *
   * The caret is positioned in *content* coordinates and drawn in the
   * viewport's, so both offsets have to come off — leaving this one out drew
   * the caret at its absolute x, which in continuous mode is anywhere from
   * right to far off the screen.
   */
  scrollLeft?: number;
  /**
   * Where each note of the drawn measures was placed, read fresh each frame.
   *
   * The caret interpolates between the noteheads themselves, so it draws
   * exactly on the note it points at — see music_drawing's `playhead.ts`. A
   * getter rather than a value, because the renderer reports this on every draw
   * and this reads it inside a frame loop: taking it as a value would restart
   * the loop at that rate. Absent until something has been drawn, which the
   * playhead handles by falling back to the stave box.
   */
  notePositions?: () => NotePositions | undefined;
};

/** Matches the web app's caret. */
const CARET_WIDTH = 2;
const CARET_COLOR = '#dc2626';

export function PlaybackCaret({
  score,
  plan,
  scrollTop,
  scrollLeft = 0,
  notePositions,
}: PlaybackCaretProps) {
  // Refs, so the values survive renders and the frame loop writes to the same
  // ones the style reads.
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const height = useRef(new Animated.Value(0)).current;
  const shown = useRef(new Animated.Value(0)).current;

  /*
    The one playhead. `getMusicPosition` is the read side of the singleton the
    player writes to, so the caret, the note colouring and the piano keyboard
    are all reading the same number at the same instant.
  */
  const position = useMemo(() => getMusicPosition(), []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const at = caretPositionForTick(
        plan,
        score,
        position.tick,
        notePositions?.(),
      );
      if (!at) {
        shown.setValue(0);
        return;
      }
      x.setValue(at.x - scrollLeft);
      y.setValue(at.yTop - scrollTop);
      height.setValue(at.yBottom - at.yTop);
      shown.setValue(1);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    plan,
    score,
    scrollTop,
    scrollLeft,
    position,
    notePositions,
    x,
    y,
    height,
    shown,
  ]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.caret,
        {
          opacity: shown,
          height,
          transform: [{ translateX: x }, { translateY: y }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  caret: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CARET_WIDTH,
    backgroundColor: CARET_COLOR,
  },
});
