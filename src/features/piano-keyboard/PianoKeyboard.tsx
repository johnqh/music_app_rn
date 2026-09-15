/**
 * A piano keyboard, in true physical layout.
 *
 * The geometry is `music_drawing`'s `computeKeys` — the same arithmetic the web
 * app lays its keyboard out with. It moved into the library the moment a second
 * app needed it: white keys tile, black keys straddle the boundary between two
 * whites, and a second copy of that would drift from the first the moment
 * either was tuned.
 *
 * Absolutely positioned rather than flexed, because a flex row cannot express a
 * child that overlaps two of its siblings. Whites come first in the array so
 * the blacks paint over them.
 *
 * Pressing a key auditions it and nothing else — no caret move, no transport
 * change. Writing the note happens on release, from the held time, which is
 * what lets a run of taps lay out a melody instead of overwriting one position.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BLACK_KEY_HEIGHT_RATIO,
  FULL_RANGE,
  KEYBOARD_OUT_OF_RANGE_WHITE,
  computeKeys,
  keyboardWidth,
  whiteKeyCount,
} from '@sudobility/music_drawing';
import type {
  KeyNaming,
  KeyboardRange,
  PianoKey,
} from '@sudobility/music_drawing';
import type { MidiRange } from '@sudobility/music_types';

export type PianoKeyboardProps = {
  /** Available width; the white-key width follows from it and the range. */
  width: number;
  height?: number;
  range?: KeyboardRange;
  /**
   * What the instrument can play. Keys outside it are drawn pale and do not
   * respond: they are there because the track holds notes there, not so more
   * can be written. Null marks none.
   */
  playable?: MidiRange | null;
  naming?: KeyNaming;
  /** Pitches currently sounding, lit while they play. */
  sounding?: ReadonlySet<number>;
  /**
   * Pitches of the one selected chord, marked so they can be toggled.
   *
   * The keyboard's second job: with exactly one chord selected, pressing a key
   * adds or removes that pitch from it instead of writing a new note —
   * `playKeyGroup` decides which of the two a press means. Showing which
   * pitches are already in the chord is what makes that legible, and the web
   * keyboard has always marked them.
   */
  selected?: ReadonlySet<number>;
  onKeyDown?: (midi: number) => void;
  /**
   * The key was released. No held time: the caller times the gesture itself
   * (`pressKey`/`releaseKey` in music_editing), because a chord is timed from
   * its first key down to its last key up, which no single key can know.
   */
  onKeyUp?: (midi: number) => void;
};

const DEFAULT_HEIGHT = 120;

export function PianoKeyboard({
  width,
  height = DEFAULT_HEIGHT,
  range = FULL_RANGE,
  playable = null,
  naming = 'pitch',
  sounding,
  selected,
  onKeyDown,
  onKeyUp,
}: PianoKeyboardProps) {
  // The range is fitted to the width rather than scrolled: a keyboard you have
  // to scroll is one you cannot play a two-handed chord on.
  const whiteWidth = width / Math.max(1, whiteKeyCount(range));
  const keys = computeKeys(whiteWidth, height, range, naming, playable);
  const total = keyboardWidth(whiteWidth, range);

  return (
    <View style={[styles.board, { width: total, height }]}>
      {keys.map(key => (
        <Key
          key={key.midi}
          pianoKey={key}
          height={height}
          lit={sounding?.has(key.midi) ?? false}
          selected={selected?.has(key.midi) ?? false}
          onDown={onKeyDown}
          onUp={onKeyUp}
        />
      ))}
    </View>
  );
}

const Key = memo(function Key({
  pianoKey,
  height,
  lit,
  selected,
  onDown,
  onUp,
}: {
  pianoKey: PianoKey;
  height: number;
  lit: boolean;
  selected: boolean;
  onDown?: ((midi: number) => void) | undefined;
  onUp?: ((midi: number) => void) | undefined;
}) {
  const black = pianoKey.isBlack;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pianoKey.label ?? String(pianoKey.midi)}
      accessibilityState={{ disabled: pianoKey.outOfRange }}
      disabled={pianoKey.outOfRange}
      onPressIn={() => onDown?.(pianoKey.midi)}
      onPressOut={() => onUp?.(pianoKey.midi)}
      style={[
        styles.key,
        black ? styles.black : styles.white,
        {
          left: pianoKey.x,
          width: pianoKey.width,
          height: black ? height * BLACK_KEY_HEIGHT_RATIO : height,
        },
        /*
          Sounding wins over selected: a note you are hearing right now is the
          more urgent fact, and the two rarely coincide.
        */
        !black && pianoKey.outOfRange && styles.whiteOutOfRange,
        selected && (black ? styles.blackSelected : styles.whiteSelected),
        lit && (black ? styles.blackLit : styles.whiteLit),
      ]}
    >
      {pianoKey.label ? (
        <Text
          style={[styles.label, black && styles.labelOnBlack]}
          numberOfLines={1}
        >
          {pianoKey.label}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  board: { position: 'relative', backgroundColor: '#18181b' },
  key: {
    position: 'absolute',
    top: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  white: {
    backgroundColor: '#fafafa',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#a1a1aa',
  },
  black: { backgroundColor: '#27272a' },
  whiteOutOfRange: { backgroundColor: KEYBOARD_OUT_OF_RANGE_WHITE },
  whiteLit: { backgroundColor: '#93c5fd' },
  blackLit: { backgroundColor: '#2563eb' },
  // Amber, as the web marks a selected key — distinct from the blue of
  // sounding, because they mean different things and can overlap.
  whiteSelected: { backgroundColor: '#fcd34d' },
  blackSelected: { backgroundColor: '#b45309' },
  label: { fontSize: 9, color: '#52525b', paddingBottom: 3 },
  labelOnBlack: { color: '#e4e4e7' },
});
