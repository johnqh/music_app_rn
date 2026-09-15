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
import { View } from 'react-native';
import { useStore } from 'zustand';
import { selectActiveTrackId } from '@sudobility/music_editing';
import {
  EMPTY_GROUP,
  playKeyGroup,
  playingPitchesForTrack,
  pressKey,
  releaseKey,
  selectSelectedNotes,
} from '@sudobility/music_editing';
import { midiIsInRange } from '@sudobility/music_types';
import {
  FULL_RANGE,
  snapToWhiteKeys,
  trackKeyboardSpan,
} from '@sudobility/music_drawing';
import { getAppServices } from '@/config/initialize';
import type { MusicDocument } from '@/documents/document';
import { PianoKeyboard } from './PianoKeyboard';
import { useContainerSize } from '@/features/layout/useContainerSize';

import type { KeyGroup } from '@sudobility/music_editing';

/** The keyboard's own height; the container states it so it can be measured. */
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
  const [sounding, setSounding] = useState<ReadonlySet<number>>(new Set());
  const activeTrackId = useStore(document.store, selectActiveTrackId);

  /**
   * The group being played. A ref, not state: it changes on every touch and
   * nothing renders from it — putting it in state would re-render the whole
   * keyboard on each press.
   */
  const group = useRef<KeyGroup>(EMPTY_GROUP);

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
      setSounding(playingPitchesForTrack(notes, activeTrackId));
    });
  }, [activeTrackId]);

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

  const program = useStore(document.store, s => {
    const track = s.score?.tracks.find(t => t.id === activeTrackId);
    return track?.midiProgram ?? 0;
  });
  const isPercussion = useStore(document.store, s => {
    const track = s.score?.tracks.find(t => t.id === activeTrackId);
    return track?.clef === 'percussion';
  });

  /**
   * The instrument's compass, widened to reach every note the track holds, with
   * the keys outside the compass marked — `trackKeyboardSpan`, the same call
   * the web keyboard makes.
   *
   * Widened because an import can hold notes the instrument cannot play (a
   * sub-octave bass layer is the usual one), and a keyboard that stopped at the
   * compass lit no key for them. Through the track, never `midiProgram` alone:
   * on a percussion track that number is a drum kit.
   */
  const track = useStore(document.store, s =>
    s.score?.tracks.find(t => t.id === activeTrackId),
  );
  const span = useMemo(
    () =>
      track
        ? trackKeyboardSpan(track)
        : { range: snapToWhiteKeys(FULL_RANGE), playable: null },
    [track],
  );

  const onKeyDown = useCallback(
    (midi: number) => {
      // Out of the instrument's compass: neither sounded nor written.
      if (span.playable && !midiIsInRange(midi, span.playable)) return;
      group.current = pressKey(group.current, midi, Date.now());
      // Audition only: `noteOn` touches no transport state.
      getAppServices().player.noteOn(midi, program, isPercussion);
    },
    [program, isPercussion, span.playable],
  );

  const onKeyUp = useCallback(
    (midi: number) => {
      getAppServices().player.noteOff(midi);
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
            width={size.width}
            height={KEYBOARD_HEIGHT}
            range={span.range}
            playable={span.playable}
            naming={isPercussion ? 'percussion' : 'pitch'}
            sounding={sounding}
            selected={selectedMidis}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
          />
        ) : null}
      </View>
    </View>
  );
}
