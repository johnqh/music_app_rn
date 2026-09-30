/**
 * The desktop window's tab bar.
 *
 * Drawn by the app, so what the system's bar would have done for it is
 * pinned here: every tab is named, the chosen one says so, and a press goes
 * to the tab pressed.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { renderWithApp } from '@/test/render';
import { DesktopTabBar } from './DesktopTabBar';

const ROUTES = ['Dashboard', 'Community', 'Docs', 'Resources', 'Settings'];

function setup(index = 0, defaultPrevented = false) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented }));
  const props = {
    state: {
      index,
      routes: ROUTES.map(name => ({ key: `${name}-key`, name })),
    },
    navigation: { navigate, emit },
  } as unknown as BottomTabBarProps;
  return { view: renderWithApp(<DesktopTabBar {...props} />), navigate, emit };
}

describe('DesktopTabBar', () => {
  it('names all five tabs, in order', () => {
    const { view } = setup();
    const labels = view
      .getAllByRole('button')
      .map(button => button.props.accessibilityLabel as string);
    expect(labels).toEqual([
      'Projects',
      'Community',
      'Docs',
      'Resources',
      'Settings',
    ]);
  });

  it('says which tab is chosen, and only that one', () => {
    const { view } = setup(2);
    const selected = view
      .getAllByRole('button')
      .filter(button => button.props.accessibilityState.selected)
      .map(button => button.props.accessibilityLabel as string);
    expect(selected).toEqual(['Docs']);
  });

  it('goes to the tab pressed', () => {
    const { view, navigate, emit } = setup();
    fireEvent.press(view.getByLabelText('Resources'));
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'Resources-key' }),
    );
    expect(navigate).toHaveBeenCalledWith('Resources', undefined);
  });

  it('stays put when the tab pressed is the one showing', () => {
    const { view, navigate } = setup(3);
    fireEvent.press(view.getByLabelText('Resources'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('answers an assistive press, which is the only way in on a Mac', () => {
    const { view, navigate } = setup();
    fireEvent(view.getByLabelText('Settings'), 'accessibilityTap');
    expect(navigate).toHaveBeenCalledWith('Settings', undefined);
  });
});
