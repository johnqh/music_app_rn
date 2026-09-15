/**
 * The print sheet collects the web print view's three answers and hands them
 * to `printPlan` unchanged.
 *
 * The rules for what each answer prints are music_drawing's and tested there;
 * what this pins is that the answers arrive — native printed straight off the
 * title bar with none of them, so every printout was the whole score on A4.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { createEmptyScore } from '@sudobility/music_types';
import { renderWithApp } from '@/test/render';
import { PrintSheet } from './PrintSheet';

describe('PrintSheet', () => {
  it('prints the visible tracks of the whole score on portrait A4 by default', () => {
    const score = createEmptyScore({ title: 'A' });
    const onPrint = jest.fn();
    const visible = [score.tracks[0]!.id];
    const view = renderWithApp(
      <PrintSheet
        open
        score={score}
        visibleTrackIds={visible}
        onClose={jest.fn()}
        onPrint={onPrint}
      />,
    );
    // The pickers print their current choice in words, from the shared keys.
    expect(view.getByText('Whole score')).toBeTruthy();
    expect(view.getByText('A4')).toBeTruthy();
    expect(view.getByText('Portrait')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Print' }));
    expect(onPrint).toHaveBeenCalledWith({
      scope: 'score',
      visibleTrackIds: visible,
      paper: 'a4',
      orientation: 'portrait',
    });
  });
});
