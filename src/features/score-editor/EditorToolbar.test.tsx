/**
 * The editing bar's controls do what their labels say.
 *
 * Worth testing at this level rather than by calling the library directly: the
 * bar's job is *wiring*, and every bug it has had has been a wiring bug — Copy
 * bound to `duplicateSelected` (which writes into the score) instead of
 * `copySelection` (which fills the clipboard), a chip that reads a value it
 * never writes, a control left live while the transport plays. Types catch
 * none of those, because both sides typecheck.
 */
/*
  `jest` is imported rather than taken from the globals: this repo's tsconfig
  declares vitest's globals (the other half of the suite runs under vitest), and
  loading both packages' global types makes `expect` two incompatible things.
  The runner still injects the globals; this only gives TypeScript a name it can
  resolve.
*/
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import {
  insertNoteAtCaret,
  defaultInsertPitch,
} from '@sudobility/music_editing';
import { isNoteEvent } from '@sudobility/music_types';
import { renderWithApp, testDocument } from '@/test/render';
import type { MusicDocument } from '@/documents/document';
import { EditorToolbar } from './EditorToolbar';

function setup(overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  const document = testDocument();
  const onLayoutModeChange = jest.fn();
  const onEnterLyrics = jest.fn();
  const onToggleInspector = jest.fn();
  const view = renderWithApp(
    <EditorToolbar
      document={document}
      layoutMode="page"
      onLayoutModeChange={onLayoutModeChange}
      onEnterLyrics={onEnterLyrics}
      onToggleInspector={onToggleInspector}
      inspectorVisible={false}
      {...overrides}
    />,
  );
  return {
    view,
    document,
    onLayoutModeChange,
    onEnterLyrics,
    onToggleInspector,
  };
}

/**
 * Writes a note and selects it, since a rest is not something Copy takes.
 *
 * Inside `act` because both writes are store changes the rendered bar
 * subscribes to: outside it React warns, and the render the assertion reads may
 * not have happened yet.
 */
function selectFirstNote(document: MusicDocument): void {
  const store = document.store;
  act(() => {
    insertNoteAtCaret(store, defaultInsertPitch(store));
    const score = store.getState().score!;
    const note =
      score.tracks[0].measures[0].voices[0].events.find(isNoteEvent)!;
    store
      .getState()
      .setSelection({ eventIds: [note.id], measureIds: [], trackIds: [] });
  });
}

describe('EditorToolbar', () => {
  /*
    Add Track asks before it acts. It used to add a blank track on the spot
    from an icon it shared with Add Bar, which left "Generate Track" nowhere to
    live — the whole reason this is a menu.
  */
  describe('add track', () => {
    it('opens a menu rather than adding a track outright', () => {
      const { view, document } = setup();
      const before = document.store.getState().score!.tracks.length;
      fireEvent.press(view.getByLabelText(/add track/i));
      expect(document.store.getState().score!.tracks).toHaveLength(before);
      // Each answer appears twice by design — once in the body, which says
      // what it does, and once as the button that does it.
      expect(view.getByRole('button', { name: 'Blank Track' })).toBeTruthy();
      expect(view.getByRole('button', { name: 'Generate Track' })).toBeTruthy();
    });

    it('adds a blank track when that is the answer', () => {
      const { view, document } = setup();
      const before = document.store.getState().score!.tracks.length;
      fireEvent.press(view.getByLabelText(/add track/i));
      act(() => {
        fireEvent.press(view.getByRole('button', { name: 'Blank Track' }));
      });
      expect(document.store.getState().score!.tracks).toHaveLength(before + 1);
    });

    it('hands the other answer to the generator', () => {
      const onGenerateTrack = jest.fn();
      const { view, document } = setup({ onGenerateTrack });
      const before = document.store.getState().score!.tracks.length;
      fireEvent.press(view.getByLabelText(/add track/i));
      fireEvent.press(view.getByRole('button', { name: 'Generate Track' }));
      expect(onGenerateTrack).toHaveBeenCalled();
      // The generator writes the track; the menu must not write one too.
      expect(document.store.getState().score!.tracks).toHaveLength(before);
    });

    it('still lists Generate Track when there is no generator, greyed', () => {
      // Listed rather than dropped: a menu whose entries come and go teaches
      // the reader nothing about where to find them.
      const { view } = setup();
      fireEvent.press(view.getByLabelText(/add track/i));
      const generate = view.getByRole('button', { name: 'Generate Track' });
      expect(generate.props.accessibilityState.disabled).toBe(true);
    });
  });

  it('toggles note input, which decides what a tap on a stave means', () => {
    const { view, document } = setup();
    expect(document.store.getState().noteInput).toBe(false);
    fireEvent.press(view.getByLabelText(/note input/i));
    expect(document.store.getState().noteInput).toBe(true);
  });

  it('zooms by a ratio and clamps at the limits', () => {
    const { view, document } = setup();
    fireEvent.press(view.getByLabelText(/zoom in/i));
    expect(document.store.getState().zoom).toBeCloseTo(1.25, 5);
    // Far more presses than the range holds: the clamp is the point.
    for (let i = 0; i < 30; i += 1)
      fireEvent.press(view.getByLabelText(/zoom out/i));
    expect(document.store.getState().zoom).toBe(0.25);
  });

  it('reports a layout mode change rather than holding one of its own', () => {
    const { view, onLayoutModeChange } = setup();
    fireEvent.press(view.getByLabelText(/continuous/i));
    expect(onLayoutModeChange).toHaveBeenCalledWith('continuous');
  });

  it('leaves paste disabled until something has been copied', () => {
    const { view, document } = setup();
    const paste = view.getByLabelText(/paste/i);
    expect(paste.props.accessibilityState.disabled).toBe(true);

    // The clipboard holds *notes*, so an empty score's rests will not fill it —
    // which is correct, and is why this writes one first.
    selectFirstNote(document);
    fireEvent.press(view.getByLabelText(/copy/i));
    expect(document.store.getState().clipboard).not.toBeNull();
  });

  it('copies without writing into the score', () => {
    // The bug this exists for: Copy was bound to `duplicateSelected`, which
    // writes a second copy into the music straight away. Both typecheck.
    const { view, document } = setup();
    selectFirstNote(document);
    const before = document.store.getState().score;
    fireEvent.press(view.getByLabelText(/copy/i));
    expect(document.store.getState().score).toBe(before);
  });

  it('starts lyric entry through its caller, which owns the note list', () => {
    const { view, onEnterLyrics } = setup();
    fireEvent.press(view.getByLabelText(/lyrics/i));
    expect(onEnterLyrics).toHaveBeenCalled();
  });
});
