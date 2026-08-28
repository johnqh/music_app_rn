/**
 * Exporting asks a question only when there is one to ask.
 *
 * A tracker module is lossy in three ways — the row grid, the channel count and
 * the note range — and the numbers have to be offered *before* anything lands
 * on disk. But a clean fit must not cost the reader a tap: for XM that is the
 * common case, and a confirmation dialog that always says "nothing was lost" is
 * a dialog people learn to dismiss without reading.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { createEmptyScore } from '@sudobility/music_types';
import { createDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import { ExportSheet } from './ExportSheet';

function setup() {
  const document = createDocument({
    id: 'd',
    title: 'Jig',
    // Empty bars: nothing to clamp, drop or quantise, so the fit is clean.
    score: createEmptyScore({ title: 'Jig', measures: 4 }),
  });
  const onExport = jest.fn();
  const onClose = jest.fn();
  const view = renderWithApp(
    <ExportSheet
      open
      document={document}
      onClose={onClose}
      onExport={onExport}
    />,
  );
  return { view, onExport, onClose };
}

describe('ExportSheet', () => {
  it('writes MIDI straight away, with nothing to ask', () => {
    const { view, onExport, onClose } = setup();
    fireEvent.press(view.getByText('MIDI'));
    expect(onExport).toHaveBeenCalledWith('midi');
    expect(onClose).toHaveBeenCalled();
  });

  it('writes a clean tracker fit without a confirmation', () => {
    const { view, onExport } = setup();
    fireEvent.press(view.getByText('Tracker module (XM)'));
    expect(onExport).toHaveBeenCalledWith('xm');
  });

  it('offers every format the app can write', () => {
    // In order of how much of the music each keeps. A format silently missing
    // from this list is a format nobody can reach.
    const { view } = setup();
    for (const label of [
      'MIDI',
      'MusicXML',
      'Tracker module (XM)',
      'Audio (WAV)',
      'Audio (MP3)',
    ]) {
      expect(view.getByText(label)).toBeTruthy();
    }
  });
});
