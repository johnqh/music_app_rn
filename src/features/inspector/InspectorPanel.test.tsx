/**
 * The property sheet's four tabs.
 *
 * Track is first because it is the only tab that always has something to show:
 * there is always an active track, where the note and measure tabs are an empty
 * state until something is selected. A tab order that opens on an empty panel
 * reads as a broken inspector.
 *
 * The tabs are driven through the control rather than by pressing their labels.
 * `SegmentedTabs` is a real `UISegmentedControl` on iOS — which is the platform
 * jest simulates — and its labels are a `values` prop on a native view, not
 * `Text` a query can find or a `Pressable` a test can press.
 */
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { InspectorPanel } from './InspectorPanel';

/** Selects a tab the way a tap on that segment does. */
function selectTab(view: ReturnType<typeof renderWithApp>, index: number) {
  fireEvent(view.getByTestId('inspector-tabs'), 'change', {
    nativeEvent: { selectedSegmentIndex: index },
  });
}

describe('InspectorPanel', () => {
  it('opens on the track, which always has something to say', () => {
    const view = renderWithApp(<InspectorPanel document={testDocument()} />);
    /*
      The track tab's Name field, which exists for every score — by its
      accessible name, not by the word on the tab. This used to assert
      `getByText('Track')`, which the *tab label* satisfied, so it would have
      passed just as happily with an empty panel behind it.
    */
    expect(view.getByLabelText('Name')).toBeTruthy();
  });

  it('offers all four tabs', () => {
    const view = renderWithApp(<InspectorPanel document={testDocument()} />);
    expect(view.getByTestId('inspector-tabs').props.values).toEqual([
      'Track',
      'Note',
      'Measure',
      'Score',
    ]);
  });

  it('shows an empty state rather than nothing when no note is selected', () => {
    /*
      A blank panel is indistinguishable from a broken one. The note tab says
      what to do instead — which is why `EmptyTab` exists rather than a null
      return.
    */
    const view = renderWithApp(<InspectorPanel document={testDocument()} />);
    selectTab(view, 1);
    expect(view.getByText(/select/i)).toBeTruthy();
  });
});
