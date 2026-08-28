/**
 * The transport.
 *
 * Its controls reach the *player*, not the store — playback state lives in the
 * engine, and a control wired to the store instead would move a number nothing
 * reads. Each one here is checked against the player it should have called.
 */
import { act, fireEvent } from '@testing-library/react-native';
import { installTestAppServices } from '@/config/initialize';
import type { IMusicPlayer } from '@sudobility/music_player';
import type { PlaybackLoadState } from '@sudobility/music_types';
import { renderWithApp, testDocument } from '@/test/render';
import { useTransport } from './useTransport';
import { TransportBar } from './TransportBar';

/** Records what the transport asked the engine to do. */
/**
 * A player whose load state can be driven from the test.
 *
 * The silent player's `onLoadState` never emits, which is right for the other
 * tests here and useless for the one thing this seam exists for: the seconds
 * before the first sound.
 */
function loadingPlayer() {
  const listeners: ((s: PlaybackLoadState) => void)[] = [];
  const { calls, player } = recordingPlayer();
  return {
    calls,
    emit: (state: PlaybackLoadState) => {
      for (const fn of listeners) fn(state);
    },
    player: {
      ...player,
      onLoadState: (fn: (s: PlaybackLoadState) => void) => {
        listeners.push(fn);
        return () => {};
      },
    } as unknown as IMusicPlayer,
  };
}

function recordingPlayer() {
  const calls: string[] = [];
  const unsubscribe = (): void => {};
  return {
    calls,
    player: {
      onSounding: () => unsubscribe,
      onPosition: () => unsubscribe,
      onTransport: () => unsubscribe,
      onLoadState: () => unsubscribe,
      noteOn: () => {},
      noteOff: () => {},
      setLoop: () => void calls.push('setLoop'),
      setMetronome: () => void calls.push('setMetronome'),
      setTempoMultiplier: () => void calls.push('setTempoMultiplier'),
      setMasterVolume: () => void calls.push('setMasterVolume'),
      load: async () => {},
      play: async () => void calls.push('play'),
      pause: () => void calls.push('pause'),
      stop: () => void calls.push('stop'),
      seek: () => void calls.push('seek'),
      applyMix: () => {},
    } as unknown as IMusicPlayer,
  };
}

function Harness({ document }: { document: ReturnType<typeof testDocument> }) {
  const score = document.store.getState().score!;
  const transport = useTransport(score);
  return <TransportBar score={score} transport={transport} />;
}

function setup() {
  const { calls, player } = recordingPlayer();
  installTestAppServices({ player });
  const document = testDocument();
  const view = renderWithApp(<Harness document={document} />);
  return { view, calls };
}

function setupLoading() {
  const { calls, player, emit } = loadingPlayer();
  installTestAppServices({ player });
  const document = testDocument();
  const view = renderWithApp(<Harness document={document} />);
  return { view, calls, emit };
}

describe('TransportBar', () => {
  /*
    The first press of Play has tens of megabytes of soundfont to fetch, and
    the engine deliberately withholds `playing` until the synth is up — so
    without this the button simply looks dead for several seconds.
  */
  describe('while the instruments load', () => {
    it('says nothing when the engine is ready', () => {
      const { view, emit } = setupLoading();
      act(() => emit({ status: 'ready' }));
      expect(view.queryByLabelText(/preparing instruments/i)).toBeNull();
      expect(
        view.getByLabelText(/^play$/i).props.accessibilityState.disabled,
      ).toBeFalsy();
    });

    it('reports progress and holds Play until a sound is possible', () => {
      const { view, emit } = setupLoading();
      act(() => emit({ status: 'loading', fraction: 0.45 }));
      expect(view.getByLabelText(/preparing instruments 45%/i)).toBeTruthy();
      expect(
        view.getByLabelText(/^play$/i).props.accessibilityState.disabled,
      ).toBe(true);
    });

    it('states the wait without a percentage when there is none', () => {
      // The synth digesting the font reports nothing, and a bar moving through
      // that half would claim progress the engine has not made.
      const { view, emit } = setupLoading();
      act(() => emit({ status: 'loading', fraction: null }));
      expect(view.getByLabelText(/preparing instruments$/i)).toBeTruthy();
    });

    it('says so when the instruments fail, and frees the button', () => {
      const { view, emit } = setupLoading();
      act(() => emit({ status: 'failed', message: 'nope' }));
      expect(view.getByText(/failed to load/i)).toBeTruthy();
      expect(
        view.getByLabelText(/^play$/i).props.accessibilityState.disabled,
      ).toBeFalsy();
    });
  });

  it('sends the metronome to the engine, not to the store', () => {
    // The metronome is a sound; a store flag nothing reads would be silent.
    const { view, calls } = setup();
    fireEvent.press(view.getByLabelText(/metronome/i));
    expect(calls).toContain('setMetronome');
  });

  it('sends looping to the engine', () => {
    const { view, calls } = setup();
    fireEvent.press(view.getByLabelText(/loop/i));
    expect(calls).toContain('setLoop');
  });

  it('stops through the engine', () => {
    const { view, calls } = setup();
    fireEvent.press(view.getByLabelText(/stop/i));
    expect(calls).toContain('stop');
  });
});
