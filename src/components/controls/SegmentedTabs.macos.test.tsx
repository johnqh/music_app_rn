/**
 * The macOS segmented picker.
 *
 * Imported by explicit filename, because jest resolves `./SegmentedTabs` to the
 * `.ios` variant; without this the Mac's own control has no test at all.
 *
 * Two things are pinned, and the app shipped with both wrong while this was
 * `@react-native-segmented-control`'s JS drawing. Its selected segment is moved
 * by `Animated.timing({useNativeDriver: true})`, which never reaches a view on
 * react-native-macos — so the indicator stayed where the panel mounted while
 * the label styling followed the real selection, and the active tab was drawn
 * white on white. And its segments take their accessible name from
 * `Platform.select({android, ios})`, which answers `undefined` on macOS — so
 * every segment was an unnamed button to VoiceOver. Both are facts about what
 * the control *says about itself*, which is what these assert: the selection is
 * rendered from `value` on every render, and every segment is named.
 */
import { jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { SegmentedTabs } from './SegmentedTabs.macos.tsx';

const OPTIONS = [
  { value: 'track', label: 'Track' },
  { value: 'note', label: 'Note' },
] as const;

function selectedLabels(view: ReturnType<typeof render>): string[] {
  return view
    .queryAllByRole('button', { selected: true })
    .map(node => String(node.props.accessibilityLabel));
}

describe('SegmentedTabs (macOS)', () => {
  it('names every segment', () => {
    const view = render(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="track"
        onChange={() => {}}
      />,
    );
    expect(view.getByLabelText('Track')).toBeTruthy();
    expect(view.getByLabelText('Note')).toBeTruthy();
  });

  it('marks exactly the segment that is selected', () => {
    const view = render(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="track"
        onChange={() => {}}
      />,
    );
    expect(selectedLabels(view)).toEqual(['Track']);
  });

  it('moves the selection when the value changes under it', () => {
    const view = render(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="track"
        onChange={() => {}}
      />,
    );
    // The panel switches tab by itself when a note is selected, so the
    // indicator has to follow a value it did not press.
    view.rerender(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="note"
        onChange={() => {}}
      />,
    );
    expect(selectedLabels(view)).toEqual(['Note']);
  });

  it('reports the value behind the segment that was pressed', () => {
    const onChange = jest.fn();
    const view = render(
      <SegmentedTabs
        label="Inspector"
        options={OPTIONS}
        value="track"
        onChange={onChange}
      />,
    );
    fireEvent.press(view.getByLabelText('Note'));
    expect(onChange).toHaveBeenCalledWith('note');
  });
});
