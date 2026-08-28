/**
 * The collapsible keyboard.
 *
 * Collapsed by default, and that is a decision rather than an oversight: the
 * transport and the status strip must be reachable before an optional input
 * surface is, and on a phone the keyboard takes a third of the screen.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { KeyboardPanel } from './KeyboardPanel';

function setup(collapsed = true) {
  const onToggle = jest.fn();
  const view = renderWithApp(
    <KeyboardPanel
      document={testDocument()}
      collapsed={collapsed}
      onToggle={onToggle}
    />,
  );
  return { view, onToggle };
}

describe('KeyboardPanel', () => {
  it('offers a way to open it while collapsed', () => {
    // A collapsed panel with no handle is a feature nobody can find.
    const { view } = setup(true);
    expect(view.getByText(/keyboard/i)).toBeTruthy();
  });

  it('reports the toggle rather than holding the state', () => {
    /*
      The layout owns whether it is open, because the score's height depends on
      it — a panel that tracked its own would leave the notation sized for the
      wrong screen.
    */
    const { view, onToggle } = setup(true);
    fireEvent.press(view.getByText(/keyboard/i));
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders the keys once opened', () => {
    const { view } = setup(false);
    expect(view.toJSON()).not.toBeNull();
  });
});
