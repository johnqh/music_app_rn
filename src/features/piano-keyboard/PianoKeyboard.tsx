/**
 * A piano keyboard, in true physical layout — drawn from keys it is handed.
 *
 * Which keys, how wide, how tall, what each is called and where its label
 * sits are all music_drawing's `keyboardKeys`, the one call the web keyboard
 * makes too. This component used to compose those itself from `computeKeys`,
 * and the composition had drifted from the web's in ways a reader could see: a
 * transposing part read in written pitch kept its concert lettering, labels
 * were printed inside the keys rather than in a gutter under them, the black
 * keys' height was recomputed from the ratio, and a drum kit's black keys
 * carried no names. The keys arrive decided now; this draws them.
 *
 * The colour of a key is `keyboardKeyFill` over the render theme — sounding
 * over selected over the out-of-range dimming — so a black key outside the
 * instrument dims as a white one does, which it did not here, and a lit key is
 * the same colour as a playing note on both apps.
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
  LABEL_ROW_HEIGHT,
  LIGHT_RENDER_THEME,
  keyboardKeyFill,
} from '@sudobility/music_drawing';
import type { PianoKey, RenderTheme } from '@sudobility/music_drawing';

export type PianoKeyboardProps = {
  /** The keys, from `keyboardKeys`: whites first, blacks after. */
  keys: readonly PianoKey[];
  /** The keyboard's total width, from `keyboardKeys`. */
  width: number;
  /** The whole panel's height, label gutter included. */
  height: number;
  /** The fills come from here; defaults to the light theme. */
  theme?: RenderTheme;
  /** Pitches drawn pressed — `litKeys`: sounding while playing, or held. */
  lit?: ReadonlySet<number>;
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

export function PianoKeyboard({
  keys,
  width,
  height,
  theme = LIGHT_RENDER_THEME,
  lit,
  selected,
  onKeyDown,
  onKeyUp,
}: PianoKeyboardProps) {
  return (
    <View style={[styles.board, { width, height }]}>
      {keys.map(key => (
        <Key
          key={key.midi}
          pianoKey={key}
          lit={lit?.has(key.midi) ?? false}
          selected={selected?.has(key.midi) ?? false}
          theme={theme}
          onDown={onKeyDown}
          onUp={onKeyUp}
        />
      ))}
    </View>
  );
}

const Key = memo(function Key({
  pianoKey,
  lit,
  selected,
  theme,
  onDown,
  onUp,
}: {
  pianoKey: PianoKey;
  lit: boolean;
  selected: boolean;
  theme: RenderTheme;
  onDown?: ((midi: number) => void) | undefined;
  onUp?: ((midi: number) => void) | undefined;
}) {
  const black = pianoKey.isBlack;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        // The spelled-out name, not the printed label: a black key prints
        // nothing and a drum key prints an abbreviation, and both still have to
        // announce what they are.
        accessibilityLabel={pianoKey.name}
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
            height: pianoKey.height,
            backgroundColor: keyboardKeyFill(
              pianoKey,
              { lit, selected },
              theme,
            ),
          },
        ]}
      />
      {/*
        A sibling in the gutter rather than a child of the key: `labelTop` is
        measured from the key's top and lands below it, which a child would need
        overflow to reach — and Android clips a child's overflow. A labelled
        black key's `labelTop` is already on the second row, where its name
        cannot land on both neighbours'.
      */}
      {pianoKey.label ? (
        <Text
          style={[
            styles.label,
            {
              left: pianoKey.x,
              width: pianoKey.width,
              top: pianoKey.labelTop,
              height: LABEL_ROW_HEIGHT,
              color: theme.foreground,
            },
          ]}
          numberOfLines={1}
        >
          {pianoKey.label}
        </Text>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  board: { position: 'relative' },
  key: { position: 'absolute', top: 0 },
  white: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#a1a1aa',
  },
  black: { zIndex: 1 },
  label: {
    position: 'absolute',
    fontSize: 9,
    textAlign: 'center',
  },
});
