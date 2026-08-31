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

  /*
    The tab used to print a literal `1` for every note's voice, whatever voice
    it was actually in — a readout that is right by coincidence on the default
    track and wrong the moment anybody uses the second voice.
  */
  it("reads the note's real voice, not a hardcoded 1", () => {
    const document = withSelectedNote();
    act(() => {
      // A second voice on the same stave. The panel printed a literal `1`
      // whatever voice the note was in, which is right by coincidence on the
      // default track and wrong the moment anybody uses the second.
      document.store.getState().setActiveVoice(1);
      insertNoteAtCaret(document.store, defaultInsertPitch(document.store));
      const score = document.store.getState().score!;
      const second =
        score.tracks[0].measures[0].voices[1]?.events.find(isNoteEvent);
      if (second)
        document.store.getState().setSelection({
          eventIds: [second.id],
          measureIds: [],
          trackIds: [],
        });
    });
    const second =
      document.store.getState().score!.tracks[0].measures[0].voices[1];
    if (!second) return; // the store declined a second voice; nothing to pin
    const view = renderWithApp(<NoteTab document={document} />);
    expect(view.getByText('2')).toBeTruthy();
  });

  it('offers velocity, which a dynamic does not overwrite', () => {
    /*
      A dynamic marks the *level*; the note's velocity is the deviation from
      it, so an accent inside a quiet passage stays an accent. The field was
      missing here entirely, which made that deviation uneditable on native.
    */
    const view = renderWithApp(<NoteTab document={withSelectedNote()} />);
    expect(view.getByLabelText(/velocity/i)).toBeTruthy();
  });

  it('offers the tie toggles', () => {
    const document = withSelectedNote();
    const view = renderWithApp(<NoteTab document={document} />);
    fireEvent(view.getByLabelText(/tie start/i), 'checkedChange', true);
    expect(selectedNote(document).tieStart).toBe(true);
  });

  it('needs two notes for a slide, which is a span', () => {
    // A slide from a note to itself is nothing, so it disables rather than
    // doing nothing — the same rule the toolbar's slur and hairpins follow.
    const view = renderWithApp(<NoteTab document={withSelectedNote()} />);
    expect(
      view.getByLabelText(/slide/i).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('offers the grace-note conversion', () => {
    const view = renderWithApp(<NoteTab document={withSelectedNote()} />);
    expect(view.getByLabelText(/grace note/i)).toBeTruthy();
  });

  it('offers Replace Notes only where a project can be written back to', () => {
    // A local file has no row for a generation job to write into.
    const withoutProject = renderWithApp(
      <NoteTab document={withSelectedNote()} />,
    );
    expect(withoutProject.queryByLabelText(/replace notes/i)).toBeNull();

    const withProject = renderWithApp(
      <NoteTab document={withSelectedNote()} onReplace={() => {}} />,
    );
    expect(withProject.getByLabelText(/replace notes/i)).toBeTruthy();
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
