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
  /** Whether the canvas was asked to draw the track-info gutter. */
  showTrackInfo?: boolean;
} = {};
jest.mock('@/features/score/ScrollingScore', () => ({
  ScrollingScore: (props: typeof mockScoreProps) => {
    mockScoreProps.onPress = props.onPress;
    mockScoreProps.onLongPress = props.onLongPress;
    mockScoreProps.showTrackInfo = props.showTrackInfo;
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
        onSettings={jest.fn()}
        onDocuments={jest.fn()}
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
        onSettings={jest.fn()}
        onDocuments={jest.fn()}
      />,
    );
    expect(view.queryByTestId('piano-keyboard-panel')).not.toBeNull();
    fireEvent.press(view.getByLabelText('Hide keyboard'));
    expect(devicePrefs.getState().keyboardCollapsed).toBe(true);
    expect(view.queryByTestId('piano-keyboard-panel')).toBeNull();
    act(() => devicePrefs.getState().setKeyboardCollapsed(false));
  });

  it('insets every edge, because a landscape phone wears its notch on a side', () => {
    /*
      Phones are landscape-only, so the sensor housing is never at the top and
      the top inset is 0 — which is exactly why `edges={['top','bottom']}`
      looked right on the Mac and on the iPad and was wrong on every iPhone.
      Measured on an iPhone 16 Pro simulator with the display mask on: the
      Dynamic Island covered the transport's Go-to-start button completely, the
      first control of the editing bar, and the word "Acoustic" in the canvas
      track gutter.

      Asserted on the prop rather than on a rendered inset: a test renderer has
      no safe area to measure, and the bug was the *declaration*.
    */
    const view = renderWithApp(
      <AppLayout
        document={testDocument()}
        onSave={jest.fn()}
        onExport={jest.fn()}
        onSettings={jest.fn()}
        onDocuments={jest.fn()}
      />,
    );
    const edges = view
      .UNSAFE_getAllByProps({})
      .map(node => node.props.edges as string[] | undefined)
      .find(value => Array.isArray(value));
    expect(edges).toBeDefined();
    expect([...edges!].sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });

  describe('touches on the score', () => {
    function layout() {
      const document = testDocument({ measures: 4 });
      const view = renderWithApp(
        <AppLayout
          document={document}
          onSave={jest.fn()}
          onExport={jest.fn()}
          onSettings={jest.fn()}
          onDocuments={jest.fn()}
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

/**
 * The inspector is a right-hand column, and on touch it trades places with the
 * canvas track gutter.
 *
 * Both halves matter and neither is visible in the other. It used to be a
 * column above 760×600 and a strip beneath the score below that — a rule that
 * made sense while a portrait tablet was possible and does not now that every
 * device is landscape-only, where a column costs width (plentiful) and a strip
 * costs height (the only thing the score has none of). And a column beside a
 * 220pt gutter left 216pt of music on a landscape phone, which is one bar per
 * system: the gutter has to go while the panel is up.
 */
describe('AppLayout inspector', () => {
  function render() {
    return renderWithApp(
      <AppLayout
        document={testDocument()}
        onSave={jest.fn()}
        onExport={jest.fn()}
        onSettings={jest.fn()}
        onDocuments={jest.fn()}
      />,
    );
  }

  /** The wrapper `View` the inspector sits in, by walking up from its label. */
  function inspectorWrapper(view: ReturnType<typeof render>) {
    // `getAllBy…`: the name reaches the tree more than once on the way through
    // the component and its host view, and either is the same place in it.
    let node = view.getAllByLabelText('Inspector')[0]?.parent ?? null;
    while (node) {
      const className = node.props?.className as string | undefined;
      if (className?.includes('border-l') || className?.includes('border-t')) {
        return className;
      }
      node = node.parent;
    }
    return undefined;
  }

  it('is a column on the right, never a strip underneath', () => {
    const view = render();
    fireEvent.press(view.getByLabelText('Toggle inspector panel'));
    const wrapper = inspectorWrapper(view);
    expect(wrapper).toBeDefined();
    // A left border and a stated width: a column. `border-t`/`flex-1` was the
    // strip, and there is no arrangement that produces one any more.
    expect(wrapper).toContain('border-l');
    expect(wrapper).toContain('w-80');
    expect(wrapper).not.toContain('border-t');
  });

  it('hides the track gutter while it is shown, and brings it back', () => {
    const view = render();
    // Unmeasured, so it opens closed: the gutter is what is on screen.
    expect(mockScoreProps.showTrackInfo).toBe(true);
    fireEvent.press(view.getByLabelText('Toggle inspector panel'));
    expect(mockScoreProps.showTrackInfo).toBe(false);
    fireEvent.press(view.getByLabelText('Toggle inspector panel'));
    expect(mockScoreProps.showTrackInfo).toBe(true);
  });
});
