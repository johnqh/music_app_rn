/**
 * The keyboard, bound to a document.
 *
 * Pressing a key auditions it through the player and nothing else — no caret
 * move, no transport change. On release the whole group goes to `playKeyGroup`,
 * which is music_editing's: it decides whether the keys join a chord, replace a
 * selected note, or enter at the caret, and turns the held time into a note
 * value. That rule used to live inside the web app's keyboard component, which
 * is precisely why a second keyboard would have had to copy it.
 *
 * Keys pressed together are one group: a chord is keys that overlap in time, so
 * the group closes when the last finger lifts rather than the first.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chordSelection, pitchToMidi } from '@sudobility/music_types';
import type { SoundingNote, UUID } from '@sudobility/music_types';
import { View } from 'react-native';
import { useStore } from 'zustand';
import {
  EMPTY_GROUP,
  litKeys,
  playKeyGroup,
  playingPitchesForTrack,
  samePitchSet,
  pressKey,
  releaseKey,
  selectActiveTrackId,
  selectSelectedNotes,
} from '@sudobility/music_editing';
import { midiIsInRange } from '@sudobility/music_types';
import {
  DARK_RENDER_THEME,
  LIGHT_RENDER_THEME,
  keyboardKeys,
} from '@sudobility/music_drawing';
import { getAppServices } from '@/config/initialize';
import { useTheme } from '@/config/ThemeContext';
import type { MusicDocument } from '@/documents/document';
import { PianoKeyboard } from './PianoKeyboard';
import { useContainerSize } from '@/features/layout/useContainerSize';

import type { KeyGroup } from '@sudobility/music_editing';

/**
 * The keyboard's whole height, label gutter included — `keyboardKeys` takes the
 * gutter out of it, as the web's does. The container states it so it can be
 * measured.
 */
const KEYBOARD_HEIGHT = 120;

export type KeyboardPanelProps = {
  document: MusicDocument;
  /** Collapsed hides the keys and leaves the header, as the web panel does. */
  /**
   * Whether the panel is collapsed.
   *
   * Only to skip drawing when it is: the *control* is the transport bar's now,
   * so this panel no longer offers one and takes no `onToggle`.
   */
  collapsed: boolean;
};

export function KeyboardPanel({ document, collapsed }: KeyboardPanelProps) {
  const { size, onLayout, measured } = useContainerSize();
  const [sounding, setSounding] = useState<ReadonlySet<number>>(NO_PITCHES);
  /** What `sounding` holds, readable from the player's callback without a render. */
  const shownSounding = useRef(sounding);
  const activeTrackId = useStore(document.store, selectActiveTrackId);
  const transportState = useStore(document.store, s => s.state);
  const pitchDisplay = useStore(document.store, s => s.pitchDisplay);
  const { resolved } = useTheme();
  const theme = resolved === 'dark' ? DARK_RENDER_THEME : LIGHT_RENDER_THEME;

  /**
   * The group being played. A ref, not state: it changes on every touch and
   * nothing renders from it — putting it in state would re-render the whole
   * keyboard on each press.
   */
  const group = useRef<KeyGroup>(EMPTY_GROUP);
  /**
   * The keys a finger is holding, drawn pressed. State rather than the group
   * ref because this *is* drawn — the native keyboard showed no held key at
   * all, where the web's always has.
   */
  const [held, setHeld] = useState<ReadonlySet<number>>(NO_PITCHES);

  useEffect(() => {
    const player = getAppServices().player;
    /*
      The active track's sounding notes, not every track's.

      This lit whatever was sounding anywhere, so on a multi-track score the
      keys flickered with parts the reader cannot see — the keyboard shows one
      track. Same rule and same reasoning as the notation's playing colour, and
      `playingPitchesForTrack` is where it lives so the two agree.
    */
    return player.onSounding(notes => {
      const next = playingPitchesForTrack(notes, activeTrackId);
      // Nothing to do when no key of this track moved: the player reports
      // every track's notes, and a new set each time re-rendered all the keys
      // for notes this keyboard does not show. Compared before `setSounding`
      // rather than inside an updater, which React still renders to evaluate.
      if (samePitchSet(shownSounding.current, next)) return;
      shownSounding.current = next;
      setSounding(next);
    });
  }, [activeTrackId]);

  /*
    What is drawn pressed is music_editing's `litKeys`, the web keyboard's rule:
    the active track's sounding pitches **only while playing** — the engine
    clears sounding notes on stop but not on pause, so without the gate a paused
    chord stayed lit here — plus the keys held down.

    Fed from the kept set rather than the raw notes, and memoized on it: the
    kept set only changes identity when one of this track's keys does, so the
    lit set does too, and a note on another part still renders nothing.
  */
  const lit = useMemo(
    () =>
      litKeys(
        asSounding(sounding, activeTrackId),
        activeTrackId,
        transportState,
        held,
      ),
    [sounding, activeTrackId, transportState, held],
  );

  /*
    The pitches of the one selected chord, so the keys can show what is in it.

    `chordSelection` is the same rule `playKeyGroup` applies when deciding
    whether a press adds to a chord or writes a new note — asked here so the
    keyboard shows the state that rule is about, rather than the reader having
    to press a key to find out.
  */
  const selectedNotes = useStore(document.store, selectSelectedNotes);
  const selectedMidis = useMemo(() => {
    const chord = chordSelection(selectedNotes);
    return new Set<number>(
      (chord?.notes ?? []).map(note => pitchToMidi(note.pitch)),
    );
  }, [selectedNotes]);

  const track = useStore(document.store, s =>
    s.score?.tracks.find(t => t.id === activeTrackId),
  );
  const program = track?.midiProgram ?? 0;
  const isPercussion = track?.clef === 'percussion';

  /**
   * The keys, their size, names and label rows — music_drawing's
   * `keyboardKeys`, the web keyboard's own call.
   *
   * It folds in the range (the instrument's compass widened to every note the
   * track holds, keys outside the compass marked, through the track rather
   * than `midiProgram` alone since a percussion track's program is a kit), the
   * naming, the label gutter, and the lettering of a transposing part read in
   * written pitch. `fit: 'width'` is the one native difference, and the
   * library's own option for it: the whole range always fits, because a
   * keyboard you have to scroll is one you cannot play a two-handed chord on.
   */
  const keyboard = useMemo(
    () =>
      keyboardKeys({
        width: size.width,
        height: KEYBOARD_HEIGHT,
        track,
        pitchDisplay,
        fit: 'width',
      }),
    [size.width, track, pitchDisplay],
  );
  const { playable } = keyboard;

  const onKeyDown = useCallback(
    (midi: number) => {
      // Out of the instrument's compass: neither sounded nor written.
      if (playable && !midiIsInRange(midi, playable)) return;
      group.current = pressKey(group.current, midi, Date.now());
      setHeld(current => new Set(current).add(midi));
      // Audition only: `noteOn` touches no transport state. The clef is as
      // load-bearing as the program — it decides whether that number is an
      // instrument or a drum kit.
      getAppServices().player.noteOn(midi, program, isPercussion);
    },
    [program, isPercussion, playable],
  );

  const onKeyUp = useCallback(
    (midi: number) => {
      getAppServices().player.noteOff(midi);
      setHeld(current => {
        if (!current.has(midi)) return current;
        const next = new Set(current);
        next.delete(midi);
        return next;
      });
      const { group: next, finished } = releaseKey(
        group.current,
        midi,
        Date.now(),
      );
      group.current = next;
      // Only once the last finger lifts. `playKeyGroup` decides the rest —
      // whether these join a chord, replace a selected note or enter at the
      // caret, and what note value the held time comes to.
      if (finished) playKeyGroup(document.store, finished);
    },
    [document],
  );

  /*
    Nothing at all when collapsed.

    This used to be a bar of its own carrying the show/hide control, which cost
    a whole row for one button — and put the control that *reveals* the keyboard
    inside the thing it reveals, so the row had to survive collapsing in order
    to stay reachable. The control is the transport bar's now, directly above,
    so there is nothing left down here that has to stay on screen.
  */
  if (collapsed) return null;

  return (
    // `testID` so the panel is addressable as a whole: its keys are not drawn
    // until it has been measured, and a test renderer measures nothing, so
    // there is no key to point at when asserting where the panel sits.
    <View testID="piano-keyboard-panel" className="border-border border-t">
      <View onLayout={onLayout} style={{ height: KEYBOARD_HEIGHT }}>
        {measured ? (
          <PianoKeyboard
            keys={keyboard.keys}
            width={keyboard.width}
            height={KEYBOARD_HEIGHT}
            theme={theme}
            lit={lit}
            selected={selectedMidis}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
          />
        ) : null}
      </View>
    </View>
  );
}

const NO_PITCHES: ReadonlySet<number> = new Set();

/** The kept pitch set, in the shape `litKeys` reads: already this track's. */
function asSounding(
  pitches: ReadonlySet<number>,
  trackId: UUID | null,
): SoundingNote[] {
  if (!trackId) return [];
  return [...pitches].map(midi => ({ noteId: '', trackId, midi }));
}
