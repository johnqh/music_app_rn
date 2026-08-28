/**
 * Jumping the caret to a bar by number.
 *
 * Two things worth pinning. Bars are numbered **from 1**, matching the gutter
 * and the status strip rather than the zero-based index the score stores — an
 * off-by-one here sends every jump to the wrong bar and looks like a rounding
 * error. And a bar that does not exist keeps the sheet open with a message
 * saying what the range is, rather than closing over a caret that did not move.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import { GoToBarSheet } from './GoToBarSheet';

function setup(onGo: (bar: number) => boolean = () => true) {
  const onClose = jest.fn();
  const view = renderWithApp(
    <GoToBarSheet open barCount={12} onClose={onClose} onGo={onGo} />,
  );
  return { view, onClose };
}

describe('GoToBarSheet', () => {
  it('passes the number as typed, one-based', () => {
    const onGo = jest.fn(() => true);
    const { view } = setup(onGo);
    fireEvent.changeText(view.getByLabelText('Bar number'), '7');
    fireEvent.press(view.getByRole('button', { name: 'Go' }));
    expect(onGo).toHaveBeenCalledWith(7);
  });

  it('closes once the caret has moved', () => {
    const { view, onClose } = setup(() => true);
    fireEvent.changeText(view.getByLabelText('Bar number'), '3');
    fireEvent.press(view.getByRole('button', { name: 'Go' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open and says the range when the bar does not exist', () => {
    // Closing over a caret that did not move is the failure that looks like
    // success — the reader believes they are at bar 99.
    const { view, onClose } = setup(() => false);
    fireEvent.changeText(view.getByLabelText('Bar number'), '99');
    fireEvent.press(view.getByRole('button', { name: 'Go' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(view.getByText(/1 to 12/)).toBeTruthy();
  });

  it('refuses text that is not a number', () => {
    const onGo = jest.fn(() => true);
    const { view, onClose } = setup(onGo);
    fireEvent.changeText(view.getByLabelText('Bar number'), 'chorus');
    fireEvent.press(view.getByRole('button', { name: 'Go' }));
    expect(onGo).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clears the error once the reader starts typing again', () => {
    // A stale complaint about the previous attempt reads as a complaint about
    // what is being typed now.
    const { view } = setup(() => false);
    const field = view.getByLabelText('Bar number');
    fireEvent.changeText(field, '99');
    fireEvent.press(view.getByRole('button', { name: 'Go' }));
    expect(view.queryByText(/1 to 12/)).not.toBeNull();
    fireEvent.changeText(field, '9');
    expect(view.queryByText(/1 to 12/)).toBeNull();
  });
});
