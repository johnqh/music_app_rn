/**
 * The transport.
 *
 * Its controls reach the *player*, not the store — playback state lives in the
 * engine, and a control wired to the store instead would move a number nothing
 * reads. Each one here is checked against the player it should have called.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { installTestAppServices } from '@/config/initialize';
import type { IMusicPlayer } from '@sudobility/music_player';
import type { PlaybackLoadState } from '@sudobility/music_types';
import { selectMeasureRange } from '@sudobility/music_editing';
import { renderWithApp, testDocument } from '@/test/render';
import { usePlayerBinding } from './usePlayerBinding';
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
      setLoop: (range: unknown) =>
        void calls.push(range ? `setLoop:${JSON.stringify(range)}` : 'setLoop'),
      setVisibleTracks: () => {},
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

function Harness({
  document,
  keyboard,
}: {
  document: ReturnType<typeof testDocument>;
  keyboard?: { collapsed: boolean; onToggle: () => void };
}) {
  const score = document.store.getState().score!;
  const transport = usePlayerBinding(document.store);
  return (
    <TransportBar
      score={score}
      transport={transport}
      store={document.store}
      {...(keyboard
        ? {
            keyboardCollapsed: keyboard.collapsed,
            onToggleKeyboard: keyboard.onToggle,
          }
        : {})}
    />
  );
}

function setup() {
  const { calls, player } = recordingPlayer();
  installTestAppServices({ player });
  const document = testDocument();
  const view = renderWithApp(<Harness document={document} />);
  return { view, calls, document };
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
    expect(calls.some(c => c.startsWith('setLoop'))).toBe(true);
  });

  /*
    The binder's rule, shared with the web: loop the selection when there is
    one. This bar used to loop the whole score whatever was selected, and held
    the toggle in its own state.
  */
  it('loops the selected bars rather than the whole score', () => {
    const { view, calls, document } = setup();
    const score = document.store.getState().score!;
    const second = score.tracks[0]!.measures[1]!;
    act(() => {
      selectMeasureRange(document.store, {
        index: 1,
        anchor: null,
        extend: false,
        allTracks: false,
      });
    });
    fireEvent.press(view.getByLabelText(/loop/i));
    const loop = calls.find(c => c.startsWith('setLoop:'));
    expect(loop).toBeDefined();
    const range = JSON.parse(loop!.slice('setLoop:'.length));
    expect(range.startTick).toBe(second.startTick);
    expect(document.store.getState().loopRange).not.toBeNull();
  });

  it('shows the metronome as the store has it', () => {
    // A setting read back from the store the binding writes, so a second tab
    // over the same player cannot show it off while it ticks.
    const { view, document } = setup();
    fireEvent.press(view.getByLabelText(/metronome/i));
    expect(document.store.getState().metronome).toBe(true);
    expect(
      view.getByLabelText(/metronome/i).props.accessibilityState.selected,
    ).toBe(true);
  });

  it('reports a failed play as a toast in the library words', async () => {
    const { player } = recordingPlayer();
    installTestAppServices({
      player: {
        ...player,
        play: async () => {
          throw new Error('no audio device');
        },
      } as unknown as IMusicPlayer,
    });
    const document = testDocument();
    const view = renderWithApp(<Harness document={document} />);
    await act(async () => {
      fireEvent.press(view.getByLabelText(/^play$/i));
    });
    const toasts = document.store.getState().toasts;
    expect(toasts.at(-1)?.severity).toBe('error');
    expect(toasts.at(-1)?.message).toMatch(/no audio device/);
  });

  it('stops through the engine', () => {
    const { view, calls } = setup();
    fireEvent.press(view.getByLabelText(/stop/i));
    expect(calls).toContain('stop');
  });

  it('sends a speed chosen from the sheet to the engine', () => {
    // A picker, not a chip that cycles: six multipliers reached one press at a
    // time meant five presses to slow a passage down, and no way to see what
    // the choices were.
    const { view, calls } = setup();
    fireEvent.press(view.getByLabelText(/playback speed/i));
    fireEvent.press(view.getByLabelText('0.5x'));
    expect(calls).toContain('setTempoMultiplier');
  });

  /*
    Tempo is the one control here that edits the *score*. Everything else is
    real-time device control and reaches the player; the BPM is persisted with
    the music, so it goes through the document's store.
  */
  describe('tempo', () => {
    it('shows the opening tempo as a readout', () => {
      const { view } = setup();
      expect(view.getByText(/\d+ BPM/)).toBeTruthy();
    });

    it('writes a new tempo into the score, not into the player', () => {
      const { view, calls, document } = setup();
      fireEvent.press(view.getByLabelText(/tempo/i));
      const field = view.getByLabelText(/tempo/i);
      fireEvent.changeText(field, '96');
      act(() => {
        fireEvent(field, 'blur');
      });
      expect(document.store.getState().score!.tempoMap[0]!.bpm).toBe(96);
      expect(calls).not.toContain('setTempoMultiplier');
    });

    it('refuses a tempo that is not a number, leaving the score alone', () => {
      // The field is numeric, but a paste can still put anything in it — and a
      // score with a NaN tempo has no tempo at all.
      const { view, document } = setup();
      const before = document.store.getState().score!.tempoMap[0]!.bpm;
      fireEvent.press(view.getByLabelText(/tempo/i));
      const field = view.getByLabelText(/tempo/i);
      fireEvent.changeText(field, 'fast');
      act(() => {
        fireEvent(field, 'blur');
      });
      expect(document.store.getState().score!.tempoMap[0]!.bpm).toBe(before);
    });
  });
});

describe('the keyboard toggle', () => {
  /*
    It used to sit on a bar of the keyboard's own, above it — a whole row for
    one button, and the control that *reveals* the keyboard was inside the thing
    it reveals, so the row had to survive collapsing in order to stay reachable.
    Here it is a transport control like the metronome beside it. The web app
    puts it in the same place, drawn with the same shared glyph.
  */
  it('reports a toggle rather than holding the state itself', () => {
    const onToggle = jest.fn();
    installTestAppServices({ player: recordingPlayer().player });
    const view = renderWithApp(
      <Harness
        document={testDocument()}
        keyboard={{ collapsed: false, onToggle }}
      />,
    );

    fireEvent.press(view.getByLabelText('Hide keyboard'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('names what pressing it will do, not what is showing', () => {
    // A button says what it does. Collapsed, it offers to show the keyboard.
    installTestAppServices({ player: recordingPlayer().player });
    const view = renderWithApp(
      <Harness
        document={testDocument()}
        keyboard={{ collapsed: true, onToggle: jest.fn() }}
      />,
    );
    expect(view.getByLabelText('Show keyboard')).toBeTruthy();
  });

  it('offers nothing when the host has no keyboard below it', () => {
    // Rather than a dead control.
    const { view } = setup();
    expect(view.queryByLabelText(/keyboard/i)).toBeNull();
  });
});
