/**
 * The collapsible keyboard.
 *
 * Collapsed by default, and that is a decision rather than an oversight: the
 * transport and the status strip must be reachable before an optional input
 * surface is, and on a phone the keyboard takes a third of the screen.
 */
import { Profiler } from 'react';
import { jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import type { SoundingNote } from '@sudobility/music_types';
import type { IMusicPlayer } from '@sudobility/music_player';
import {
  getAppServices,
  installTestAppServices,
  resetAppServices,
} from '@/config/initialize';
import { renderWithApp, testDocument } from '@/test/render';
import { KeyboardPanel } from './KeyboardPanel';

function setup(collapsed = true) {
  const view = renderWithApp(
    <KeyboardPanel document={testDocument()} collapsed={collapsed} />,
  );
  return { view };
}

describe('KeyboardPanel', () => {
  it('draws nothing at all when collapsed', () => {
    /*
      It used to be a bar of its own carrying the show/hide control — a whole
      row for one button, and the control that reveals the keyboard sat inside
      the thing it reveals, so the row had to survive collapsing to stay
      reachable. The control is the transport bar's now, so there is nothing
      down here that has to stay on screen.
    */
    const { view } = setup(true);
    // The wrapper the test renderer provides is all that is left; the panel
    // itself contributes nothing.
    const tree = view.toJSON();
    expect(Array.isArray(tree) ? tree : tree?.children ?? null).toBeNull();
  });

  it('renders the keys once opened', () => {
    const { view } = setup(false);
    expect(view.toJSON()).not.toBeNull();
  });

  it('does not render for a note sounding on another track', () => {
    // The player reports every track's notes; the keyboard shows one. Each
    // used to hand React a new set and re-render all the keys.
    let publish: (notes: readonly SoundingNote[]) => void = () => undefined;
    installTestAppServices();
    const player = getAppServices().player;
    installTestAppServices({
      player: {
        ...player,
        onSounding: (listener: (notes: readonly SoundingNote[]) => void) => {
          publish = listener;
          return () => undefined;
        },
      } as IMusicPlayer,
    });
    try {
      const document = testDocument();
      const trackId = document.store.getState().score!.tracks[0]!.id;
      const commits = jest.fn();
      renderWithApp(
        <Profiler id="keyboard" onRender={commits}>
          <KeyboardPanel document={document} collapsed={false} />
        </Profiler>,
      );
      const mine: SoundingNote = { noteId: 'a', trackId, midi: 60 };
      act(() => publish([mine]));
      commits.mockClear();

      act(() => publish([mine, { noteId: 'b', trackId: 'other', midi: 67 }]));

      expect(commits).not.toHaveBeenCalled();
    } finally {
      resetAppServices();
    }
  });
});
