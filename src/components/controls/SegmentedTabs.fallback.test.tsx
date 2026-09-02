/**
 * The non-iOS segmented picker — a tab row.
 *
 * Imported by explicit filename, because jest resolves `./SegmentedTabs` to the
 * `.ios` variant and this file is what Android and macOS actually ship. Without
 * this the fallback has no test at all: every other suite exercises the native
 * control.
 */
import { jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { SegmentedTabs } from './SegmentedTabs.tsx';

const OPTIONS = [
  { value: 'track', label: 'Track' },
  { value: 'note', label: 'Note' },
] as const;

describe('SegmentedTabs (tab-row fallback)', () => {
  it('renders every option as pressable text', () => {
    const view = render(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="track"
        onChange={() => {}}
      />,
    );
    expect(view.getByText('Track')).toBeTruthy();
    expect(view.getByText('Note')).toBeTruthy();
  });

  it('reports the value behind the label that was pressed', () => {
    const onChange = jest.fn();
    const view = render(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="track"
        onChange={onChange}
      />,
    );
    fireEvent.press(view.getByText('Note'));
    expect(onChange).toHaveBeenCalledWith('note');
  });
});
