/**
 * Editing works against a document's own store, with no app store, no server
 * and no project row behind it.
 *
 * This is the claim the whole native app rests on — it is what the
 * music_editing split was for — so it is checked directly rather than inferred
 * from the fact that it compiles.
 */
import { describe, expect, it } from 'vitest';
import { createDocument } from './document.js';
import {
  defaultInsertPitch,
  insertNoteAtCaret,
  nearestOctaveFor,
} from '@sudobility/music_editing';
import { allNotes, createEmptyScore } from '@sudobility/music_types';
import type { PitchStep } from '@sudobility/music_types';

function doc() {
  return createDocument({
    id: 'd',
    title: 'T',
    score: createEmptyScore({ title: 'T', measures: 4 }),
  });
}

function write(document: ReturnType<typeof doc>, step: PitchStep) {
  const reference = defaultInsertPitch(document.store);
  insertNoteAtCaret(
    document.store,
    { step, accidental: 0, octave: nearestOctaveFor(step, reference) },
    { duration: 'quarter', advanceCaret: true },
  );
}

describe('note entry against a document store', () => {
  it('writes a note and marks the document dirty', () => {
    const d = doc();
    expect(allNotes(d.store.getState().score!)).toHaveLength(0);
    write(d, 'C');
    expect(allNotes(d.store.getState().score!)).toHaveLength(1);
    expect(d.dirty).toBe(true);
  });

  it('advances the caret so a run of taps lays out a melody', () => {
    const d = doc();
    write(d, 'C');
    write(d, 'D');
    write(d, 'E');
    const notes = allNotes(d.store.getState().score!);
    expect(notes).toHaveLength(3);
    const ticks = notes.map(n => n.startTick).sort((a, b) => a - b);
    // Three distinct onsets, not three notes stacked on one.
    expect(new Set(ticks).size).toBe(3);
  });

  it('picks the octave nearest the note before, not always C4', () => {
    const d = doc();
    write(d, 'B');
    write(d, 'C');
    const notes = allNotes(d.store.getState().score!).sort(
      (a, b) => a.startTick - b.startTick,
    );
    const b = notes[0];
    const c = notes[1];
    // C written after B is the C above it, a semitone up — not a seventh down.
    expect(c.pitch.octave).toBe(b.pitch.octave + 1);
  });

  it('undoes an edit, and the undo is per document', () => {
    const a = doc();
    const b = createDocument({
      id: 'd2',
      title: 'T2',
      score: createEmptyScore({ title: 'T2', measures: 4 }),
    });
    write(a, 'C');
    write(b, 'G');
    a.store.getState().undo();
    expect(allNotes(a.store.getState().score!)).toHaveLength(0);
    // b's history is its own.
    expect(allNotes(b.store.getState().score!)).toHaveLength(1);
  });

  it('refuses a content edit while the transport is playing', () => {
    const d = doc();
    d.store.setState({ state: 'playing' });
    write(d, 'C');
    expect(allNotes(d.store.getState().score!)).toHaveLength(0);
    d.store.setState({ state: 'stopped' });
    write(d, 'C');
    expect(allNotes(d.store.getState().score!)).toHaveLength(1);
  });
});
