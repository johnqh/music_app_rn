/**
 * The tracker fit report — the half of exporting that asks a question.
 *
 * A module is lossy in three ways: the row grid, the channel count and the note
 * range. The numbers are offered *before* anything lands on disk, and they are
 * **named rather than summarised** — "some notes were changed" is not something
 * a reader can act on, where "12 notes outside the format's range were moved"
 * tells them to try a different format.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import {
  createEmptyScore,
  midiToPitch,
  createId,
} from '@sudobility/music_types';
import type { NoteEvent } from '@sudobility/music_types';
import { createDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import { ExportSheet } from './ExportSheet';

/**
 * A score with a note above anything XM can address.
 *
 * MIDI 110 — measured, not assumed: XM reaches lower than one might expect, so
 * a bass note is a clean fit and this is not. Out-of-range notes move by whole
 * **octaves**, which is a real loss the report has to count: an octave
 * displacement keeps the pitch class, so the line still reads as itself, but it
 * is not the music that was written.
 */
function outOfRangeDocument() {
  const score = createEmptyScore({ title: 'Deep', measures: 2 });
  const track = score.tracks[0];
  const measure = track.measures[0];
  const note: NoteEvent = {
    id: createId(),
    pitch: midiToPitch(110),
    startTick: measure.startTick,
    durationTicks: measure.durationTicks,
    velocity: 80,
    voiceId: measure.voices[0].id,
    trackId: track.id,
  };
  const withNote = {
    ...score,
    tracks: [
      {
        ...track,
        measures: track.measures.map((m, i) =>
          i === 0 ? { ...m, voices: [{ ...m.voices[0], events: [note] }] } : m,
        ),
      },
    ],
  };
  return createDocument({ id: 'd', title: 'Deep', score: withNote });
}

describe('ExportSheet — tracker fit', () => {
  it('asks before writing when something would be lost', () => {
    const onExport = jest.fn();
    const view = renderWithApp(
      <ExportSheet
        open
        document={outOfRangeDocument()}
        onClose={jest.fn()}
        onExport={onExport}
      />,
    );
    fireEvent.press(view.getByText('Tracker module (XM)'));
    // Not written yet: the numbers come first.
    expect(onExport).not.toHaveBeenCalled();
    expect(view.getByText(/moved into range|octave|range/i)).toBeTruthy();
  });

  it('writes it anyway once the reader has seen the numbers', () => {
    const onExport = jest.fn();
    const view = renderWithApp(
      <ExportSheet
        open
        document={outOfRangeDocument()}
        onClose={jest.fn()}
        onExport={onExport}
      />,
    );
    fireEvent.press(view.getByText('Tracker module (XM)'));
    fireEvent.press(view.getByRole('button', { name: 'Export anyway' }));
    expect(onExport).toHaveBeenCalledWith('xm');
  });

  it('lets the reader back out without writing', () => {
    const onExport = jest.fn();
    const view = renderWithApp(
      <ExportSheet
        open
        document={outOfRangeDocument()}
        onClose={jest.fn()}
        onExport={onExport}
      />,
    );
    fireEvent.press(view.getByText('Tracker module (XM)'));
    fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
    expect(onExport).not.toHaveBeenCalled();
  });
});
