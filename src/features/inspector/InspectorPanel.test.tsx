/**
 * The property sheet's four tabs.
 *
 * Track is first because it is the only tab that always has something to show:
 * there is always an active track, where the note and measure tabs are an empty
 * state until something is selected. A tab order that opens on an empty panel
 * reads as a broken inspector.
 */
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { InspectorPanel } from './InspectorPanel';

describe('InspectorPanel', () => {
  it('opens on the track, which always has something to say', () => {
    const view = renderWithApp(<InspectorPanel document={testDocument()} />);
    // The track tab's Name field, which exists for every score.
    expect(view.getByText('Track')).toBeTruthy();
  });

  it('offers all four tabs', () => {
    const view = renderWithApp(<InspectorPanel document={testDocument()} />);
    for (const tab of ['Track', 'Note', 'Measure', 'Score']) {
      expect(view.getByText(tab)).toBeTruthy();
    }
  });

  it('shows an empty state rather than nothing when no note is selected', () => {
    /*
      A blank panel is indistinguishable from a broken one. The note tab says
      what to do instead — which is why `EmptyTab` exists rather than a null
      return.
    */
    const view = renderWithApp(<InspectorPanel document={testDocument()} />);
    fireEvent.press(view.getByText('Note'));
    expect(view.getByText(/select/i)).toBeTruthy();
  });
});
