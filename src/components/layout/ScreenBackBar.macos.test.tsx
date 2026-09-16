/**
 * The way back out of a pushed screen on macOS.
 *
 * Imported by explicit filename, because jest resolves `./ScreenBackBar` to the
 * variant every other platform gets — which renders nothing, since their
 * navigator draws its own header. This one exists because that header is not
 * drawn on this react-native-macos build at all: Settings, Docs and every other
 * pushed screen offered no back control of any kind, to the pointer or to
 * VoiceOver, and a Mac has no swipe-back either. That was invisible only
 * because nothing navigated anywhere; the moment the title bar could open
 * Settings, a screen with no way out became reachable.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';

const mockNavigation = { canGoBack: () => true, goBack: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

const { ScreenBackBar } =
  require('./ScreenBackBar.macos.tsx') as typeof import('./ScreenBackBar.macos');
const { ScreenBackBar: Other } =
  require('./ScreenBackBar.tsx') as typeof import('./ScreenBackBar');

describe('ScreenBackBar (macOS)', () => {
  beforeEach(() => {
    mockNavigation.canGoBack = () => true;
    mockNavigation.goBack.mockClear();
  });

  it('offers a named back control that goes back', () => {
    const view = renderWithApp(<ScreenBackBar />);
    fireEvent.press(view.getByLabelText('Back'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('draws nothing where there is nowhere to go back to', () => {
    // The editor is the stack's first route; a back that did nothing would be
    // worse than none.
    mockNavigation.canGoBack = () => false;
    expect(
      renderWithApp(<ScreenBackBar />).queryByLabelText('Back'),
    ).toBeNull();
  });

  it('is nothing at all on the platforms whose navigator draws a header', () => {
    // Their stack draws its own back button; a second would be a duplicate.
    expect(renderWithApp(<Other />).queryByLabelText('Back')).toBeNull();
  });
});
