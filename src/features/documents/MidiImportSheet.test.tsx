/**
 * The MIDI import sheet's number fields and its one refusal.
 *
 * The rules are music_lib's `patchMidiImportOptions`/`canImportMidi`, tested
 * there; these pin that the sheet actually reaches them. Two ways it did not:
 * the minimum duration was floored at 1 and capped at 480 here where the web
 * floors at 0 with no cap, and the number fields read their text as a number
 * directly, so clearing the split point to type a new one would have moved the
 * split to MIDI 0.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import type { MidiImportOptions, MidiSummary } from '@sudobility/music_lib';
import { renderWithApp } from '@/test/render';
import { MidiImportSheet } from './MidiImportSheet';

const SUMMARY: MidiSummary = {
  ppq: 480,
  durationSeconds: 12,
  tempoEvents: [],
  timeSignatures: [],
  detectedGrid: { grid: null, triplet: false },
  tracks: [
    {
      index: 0,
      name: 'Right hand',
      channel: 0,
      program: 0,
      instrumentName: 'Acoustic Grand Piano',
      noteCount: 12,
      durationSeconds: 12,
      isPercussion: false,
      averageMidi: 67,
    },
  ],
};

function setup() {
  const onImport = jest.fn();
  const view = renderWithApp(
    <MidiImportSheet
      open
      summary={SUMMARY}
      onCancel={() => undefined}
      onImport={onImport}
    />,
  );
  const importNow = (): MidiImportOptions => {
    fireEvent.press(view.getByRole('button', { name: 'Import MIDI' }));
    return onImport.mock.calls.at(-1)![0] as MidiImportOptions;
  };
  return { view, onImport, importNow };
}

describe('MidiImportSheet', () => {
  it("floors the minimum duration at 0 with no ceiling, the web's rule", () => {
    const { view, importNow } = setup();
    const field = view.getByLabelText('Minimum note duration (ticks)');
    fireEvent.changeText(field, '0');
    expect(importNow().minDurationTicks).toBe(0);
    fireEvent.changeText(field, '960');
    expect(importNow().minDurationTicks).toBe(960);
  });

  it('keeps the split point when its field is cleared', () => {
    const { view, importNow } = setup();
    fireEvent(view.getByLabelText('Piano staff split'), 'valueChange', true);
    const field = view.getByLabelText('Split point (MIDI note number)');
    fireEvent.changeText(field, '48');
    fireEvent.changeText(field, '');
    expect(importNow().splitPointMidi).toBe(48);
    // Zero is a note, not an absence.
    fireEvent.changeText(field, '0');
    expect(importNow().splitPointMidi).toBe(0);
  });

  it('refuses to import with no track included', () => {
    const { view, onImport } = setup();
    fireEvent(
      view.getByLabelText('Include track: Right hand'),
      'valueChange',
      false,
    );
    fireEvent.press(view.getByRole('button', { name: 'Import MIDI' }));
    expect(onImport).not.toHaveBeenCalled();
  });
});
