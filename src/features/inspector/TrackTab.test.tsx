/**
 * The one track editor.
 *
 * There used to be two — a panel beside the keyboard and this tab — which is
 * how they came to disagree about whether program 0 was "Piano" or "Acoustic
 * Grand Piano". This one **reflects and invokes only**: every edit is a
 * `track-slice` action, and the rules those enforce are rules about a score,
 * which is why they live in music_editing rather than here.
 */
import { act, fireEvent } from '@testing-library/react-native';
import { addBlankTrack } from '@sudobility/music_editing';
import { renderWithApp, testDocument } from '@/test/render';
import type { MusicDocument } from '@/documents/document';

const { TrackTab } = require('./TrackTab') as typeof import('./TrackTab');

function setup(tracks = 1) {
  const document = testDocument();
  act(() => {
    for (let i = 1; i < tracks; i += 1) addBlankTrack(document.store);
  });
  const view = renderWithApp(<TrackTab document={document} />);
  return { view, document };
}

function activeTrack(document: MusicDocument) {
  const state = document.store.getState();
  const id = state.activeTrackId;
  const score = state.score!;
  return score.tracks.find(t => t.id === id) ?? score.tracks[0];
}

describe('TrackTab', () => {
  it('shows the active track without needing one to be chosen', () => {
    /*
      `selectActiveTrackId` falls back to the first track, which is what makes
      "one track is always active" true with no reconciliation step. Reading
      the raw field gives null on a fresh score and the panel renders nothing.
    */
    const { view } = setup();
    expect(view.getByLabelText(/name/i)).toBeTruthy();
  });

  it('commits a rename on blur, not per keystroke', () => {
    // Otherwise every letter is its own undo entry.
    const { view, document } = setup();
    const field = view.getByLabelText(/name/i);
    fireEvent.changeText(field, 'Cello');
    expect(activeTrack(document).name).not.toBe('Cello');
    fireEvent(field, 'blur');
    expect(activeTrack(document).name).toBe('Cello');
  });

  it('keeps mix controls live, because mixing is not editing', () => {
    /*
      Volume, pan, mute and solo are `kind: 'mix'` and reach the engine live —
      muting a part while listening is how an arrangement gets listened to.
      Only *content* controls go disabled while the transport plays.
    */
    const { view, document } = setup();
    act(() => {
      // Straight onto the slice, as music_editing's own tests do: the
      // transport state is reported *by the engine*, so there is no action to
      // set it — which is the point, since nothing in the UI may claim to be
      // playing when the engine is not.
      document.store.setState({ state: 'playing' });
    });
    const mute = view.getByLabelText(/mute/i);
    expect(mute.props.accessibilityState?.disabled).not.toBe(true);
  });
});
