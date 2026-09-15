/**
 * The editor's row order, which is the one thing about this layout that has to
 * match the web app exactly.
 *
 * Somebody who knows where the transport is should not have to look for it, and
 * the order is not something either app can check for itself — each is
 * internally consistent whichever way round these two sit.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { devicePrefs } from '@/config/useDevicePrefs';
import { renderWithApp, testDocument } from '@/test/render';

/*
  The tab strip reads the open-document list from a provider this test has no
  reason to stand up — it is a sibling of the rows under test, not part of them.
*/
jest.mock('@/features/documents/DocumentTabs', () => ({
  DocumentTabs: () => null,
}));

/*
  The score view is replaced by one that records the two touch callbacks it is
  handed, so the tests can press "a note" or "a stave" without a canvas. What a
  touch *means* is music_editing's and tested there; what is pinned here is that
  the editor hands the view's answer to it, and opens the menu on a long press.
*/
const mockScoreProps: {
  onPress?: (hit: unknown, pointTick: number | null) => void;
  onLongPress?: (hit: unknown) => void;
} = {};
jest.mock('@/features/score/ScrollingScore', () => ({
  ScrollingScore: (props: typeof mockScoreProps) => {
    mockScoreProps.onPress = props.onPress;
    mockScoreProps.onLongPress = props.onLongPress;
    return null;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppLayout } = require('./AppLayout') as typeof import('./AppLayout');

describe('AppLayout', () => {
  it('puts the transport above the keyboard', () => {
    /*
      The keyboard is the only row down there whose height changes — it
      collapses, and it is optional. With it in between, opening or closing it
      moved the transport, which is the row a thumb goes to without looking.

      Asserted on the rendered tree's order rather than on a snapshot: what is
      being pinned is which comes first, not the markup around either.
    */
    const view = renderWithApp(
      <AppLayout
        document={testDocument()}
        onSave={jest.fn()}
        onExport={jest.fn()}
      />,
    );

    // Expanded by default, as on the web, so there is an order to assert
    // without opening it first.
    const marks = view
      .UNSAFE_getAllByProps({})
      .map(node => node.props.accessibilityLabel ?? node.props.testID)
      .filter(
        (mark): mark is string =>
          mark === 'Playback transport' || mark === 'piano-keyboard-panel',
      );

    expect(marks[0]).toBe('Playback transport');
    expect(marks).toContain('piano-keyboard-panel');
  });

  it('starts with the keyboard expanded and remembers collapsing it as a device pref', () => {
    /*
      It was a `useState(true)` here: collapsed on every launch and forgotten on
      every tab. The web starts expanded, and a reader who collapses it has
      collapsed it for the device.
    */
    devicePrefs.getState().setKeyboardCollapsed(false);
    const view = renderWithApp(
      <AppLayout
        document={testDocument()}
        onSave={jest.fn()}
        onExport={jest.fn()}
      />,
    );
    expect(view.queryByTestId('piano-keyboard-panel')).not.toBeNull();
    fireEvent.press(view.getByLabelText('Hide keyboard'));
    expect(devicePrefs.getState().keyboardCollapsed).toBe(true);
    expect(view.queryByTestId('piano-keyboard-panel')).toBeNull();
    act(() => devicePrefs.getState().setKeyboardCollapsed(false));
  });

  describe('touches on the score', () => {
    function layout() {
      const document = testDocument({ measures: 4 });
      const view = renderWithApp(
        <AppLayout
          document={document}
          onSave={jest.fn()}
          onExport={jest.fn()}
        />,
      );
      return { document, view };
    }

    it('routes a tap on a track name through the shared press rules', () => {
      const { document } = layout();
      const trackId = document.store.getState().score!.tracks[0]!.id;
      act(() =>
        mockScoreProps.onPress!({ kind: 'trackGutter', trackId }, null),
      );
      expect(document.store.getState().selection.trackIds).toEqual([trackId]);
    });

    it('keeps the selection when a long press lands on a bare stave, and opens the menu', () => {
      /*
        The long press used to aim the caret first, which clears the selection
        — so the menu opened over nothing, on the very selection it was meant
        to act on.
      */
      const { document, view } = layout();
      const score = document.store.getState().score!;
      const track = score.tracks[0]!;
      const measureIds = [track.measures[1]!.id];
      act(() =>
        document.store
          .getState()
          .setSelection({ eventIds: [], measureIds, trackIds: [] }),
      );
      act(() =>
        mockScoreProps.onLongPress!({
          kind: 'stave',
          trackId: track.id,
          tick: 0,
          pitch: null,
          measureIndex: 0,
        }),
      );
      expect(document.store.getState().selection.measureIds).toEqual(
        measureIds,
      );
      // The menu names what it acts on.
      expect(view.getByText('Bar')).toBeTruthy();
    });
  });
});
