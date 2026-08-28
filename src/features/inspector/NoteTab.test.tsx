/**
 * The selected note's properties.
 *
 * The tab says note values, bars and key names — never ticks or fifths.
 * "Duration 480" states the storage format; the reader is looking at a quarter
 * note. Those conversions live in music_lib's `music-vocabulary.ts`, because
 * they are music theory rather than panel code, and `durationNameForTicks`
 * answers null for a length no single notehead spells — which the picker shows
 * as Custom rather than relabelling as the nearest name.
 */
import { act, fireEvent } from '@testing-library/react-native';
import {
  insertNoteAtCaret,
  defaultInsertPitch,
} from '@sudobility/music_editing';
import { isNoteEvent } from '@sudobility/music_types';
import { renderWithApp, testDocument } from '@/test/render';
import type { MusicDocument } from '@/documents/document';

const { NoteTab } = require('./NoteTab') as typeof import('./NoteTab');

function withSelectedNote() {
  const document = testDocument();
  act(() => {
    insertNoteAtCaret(document.store, defaultInsertPitch(document.store));
    const score = document.store.getState().score!;
    const note =
      score.tracks[0].measures[0].voices[0].events.find(isNoteEvent)!;
    document.store
      .getState()
      .setSelection({ eventIds: [note.id], measureIds: [], trackIds: [] });
  });
  return document;
}

function selectedNote(document: MusicDocument) {
  const score = document.store.getState().score!;
  const ids = document.store.getState().selection.eventIds;
  return score.tracks[0].measures[0].voices[0].events
    .filter(isNoteEvent)
    .find(n => ids.includes(n.id))!;
}

describe('NoteTab', () => {
  it('says so when nothing is selected, rather than rendering blank', () => {
    // A blank panel is indistinguishable from a broken one.
    const view = renderWithApp(<NoteTab document={testDocument()} />);
    expect(view.getByText(/select/i)).toBeTruthy();
  });

  it('names the note value rather than showing its tick count', () => {
    /*
      "Duration 480" states the storage format. The reader is looking at a
      quarter note, and the conversion is music theory — music_lib's, not this
      panel's.
    */
    const view = renderWithApp(<NoteTab document={withSelectedNote()} />);
    expect(view.queryByText('480')).toBeNull();
  });

  it('counts voices from 1, matching the toolbar', () => {
    // The same note used to read "Voice 1" on the bar and `0` in the panel.
    const view = renderWithApp(<NoteTab document={withSelectedNote()} />);
    expect(view.queryByText(/\bVoice 0\b/)).toBeNull();
  });

  it('writes a chord symbol as typed', () => {
    /*
      `C-7`, `Cmin7` and `Cm7` are one chord written three ways. The model keeps
      the string, so nothing a player writes is refused or silently rewritten.
    */
    const document = withSelectedNote();
    const view = renderWithApp(<NoteTab document={document} />);
    const field = view.queryByLabelText(/chord/i);
    if (!field) return;
    fireEvent.changeText(field, 'Bb7#11');
    fireEvent(field, 'blur');
    expect(selectedNote(document).chordSymbol).toBe('Bb7#11');
  });
});
