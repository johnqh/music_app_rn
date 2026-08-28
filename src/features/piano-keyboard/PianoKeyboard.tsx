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
import { memo, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BLACK_KEY_HEIGHT_RATIO,
  FULL_RANGE,
  computeKeys,
  keyboardWidth,
  whiteKeyCount,
} from '@sudobility/music_drawing';
import type {
  KeyNaming,
  KeyboardRange,
  PianoKey,
} from '@sudobility/music_drawing';

export type PianoKeyboardProps = {
  /** Available width; the white-key width follows from it and the range. */
  width: number;
  height?: number;
  range?: KeyboardRange;
  naming?: KeyNaming;
  /** Pitches currently sounding, lit while they play. */
  sounding?: ReadonlySet<number>;
  onKeyDown?: (midi: number) => void;
  /** Held milliseconds, so the caller can turn a tap into a note value. */
  onKeyUp?: (midi: number, heldMs: number) => void;
};

const DEFAULT_HEIGHT = 120;

export function PianoKeyboard({
  width,
  height = DEFAULT_HEIGHT,
  range = FULL_RANGE,
  naming = 'pitch',
  sounding,
  onKeyDown,
  onKeyUp,
}: PianoKeyboardProps) {
  // The range is fitted to the width rather than scrolled: a keyboard you have
  // to scroll is one you cannot play a two-handed chord on.
  const whiteWidth = width / Math.max(1, whiteKeyCount(range));
  const keys = computeKeys(whiteWidth, height, range, naming);
  const total = keyboardWidth(whiteWidth, range);
  const pressedAt = useRef<Map<number, number>>(new Map());

  const down = useCallback(
    (midi: number) => {
      // Wall-clock, because what is being measured is how long a finger was
      // down — not how many frames elapsed.
      pressedAt.current.set(midi, Date.now());
      onKeyDown?.(midi);
    },
    [onKeyDown],
  );

  const up = useCallback(
    (midi: number) => {
      const started = pressedAt.current.get(midi);
      pressedAt.current.delete(midi);
      onKeyUp?.(midi, started === undefined ? 0 : Date.now() - started);
    },
    [onKeyUp],
  );

  return (
    <View style={[styles.board, { width: total, height }]}>
      {keys.map(key => (
        <Key
          key={key.midi}
          pianoKey={key}
          height={height}
          lit={sounding?.has(key.midi) ?? false}
          onDown={down}
          onUp={up}
        />
      ))}
    </View>
  );
}

const Key = memo(function Key({
  pianoKey,
  height,
  lit,
  onDown,
  onUp,
}: {
  pianoKey: PianoKey;
  height: number;
  lit: boolean;
  onDown: (midi: number) => void;
  onUp: (midi: number) => void;
}) {
  const black = pianoKey.isBlack;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pianoKey.label ?? String(pianoKey.midi)}
      onPressIn={() => onDown(pianoKey.midi)}
      onPressOut={() => onUp(pianoKey.midi)}
      style={[
        styles.key,
        black ? styles.black : styles.white,
        {
          left: pianoKey.x,
          width: pianoKey.width,
          height: black ? height * BLACK_KEY_HEIGHT_RATIO : height,
        },
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
  whiteLit: { backgroundColor: '#93c5fd' },
  blackLit: { backgroundColor: '#2563eb' },
  label: { fontSize: 9, color: '#52525b', paddingBottom: 3 },
  labelOnBlack: { color: '#e4e4e7' },
});
