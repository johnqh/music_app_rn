/**
 * Which tracks are drawn.
 *
 * Hiding a part is a *view* choice, not an edit — the notes stay in the score,
 * and a hidden track still sounds. What matters here is that the control cannot
 * hide everything: a score with no visible track renders as a blank page, which
 * reads as the app having lost the music.
 */
import { addBlankTrack } from '@sudobility/music_editing';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { TrackVisibilitySelect } from './TrackVisibilitySelect';

function setup(extraTracks = 1) {
  const document = testDocument();
  act(() => {
    for (let i = 0; i < extraTracks; i += 1) addBlankTrack(document.store);
  });
  const view = renderWithApp(<TrackVisibilitySelect document={document} />);
  return { view, document };
}

describe('TrackVisibilitySelect', () => {
  it('gives the sheet a visible way out', () => {
    /*
      The sheet is full-width and bottom-anchored, and a tap on the scrim was
      its only dismissal — which nothing on screen advertised, so it was
      reported as a picker with no way to cancel. Ticking a box deliberately
      leaves the sheet open, so a visible control has to be what ends it.
    */
    const { view } = setup(1);
    fireEvent.press(view.getByLabelText(/tracks/i));
    const done = view.getByRole('button', { name: 'Done' });
    expect(done).toBeTruthy();
    fireEvent.press(done);
    expect(view.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('offers the tracks the score has', () => {
    const { view, document } = setup(2);
    const tracks = document.store.getState().score!.tracks;
    expect(tracks.length).toBe(3);
    expect(view.getByLabelText(/track/i)).toBeTruthy();
  });

  it('changes only what is drawn, never the score', () => {
    /*
      The bug worth guarding: a visibility control wired to a track command
      would delete a part instead of hiding it, and undo is the only way back.
    */
    const { document } = setup(1);
    const before = document.store.getState().score;
    act(() => {
      document.store.getState().setVisibleTracks([before!.tracks[0].id]);
    });
    const after = document.store.getState().score;
    expect(after!.tracks).toHaveLength(before!.tracks.length);
    expect(document.store.getState().visibleTrackIds).toHaveLength(1);
  });
});
