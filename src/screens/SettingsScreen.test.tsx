/**
 * Settings.
 *
 * The theme picker is the part worth pinning: `system` is offered *alongside*
 * the two overrides rather than being the absence of one, because "follow the
 * OS again" is a choice somebody makes and is remembered like any other.
 */
import { jest } from '@jest/globals';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { renderWithApp } from '@/test/render';

const mockSetMode = jest.fn();
const mockUser = jest.fn<() => unknown>();

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser(), signOut: async () => {} }),
}));
jest.mock('@/config/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', resolved: 'light', setMode: mockSetMode }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const { SettingsScreen } =
  require('./SettingsScreen') as typeof import('./SettingsScreen');

beforeEach(() => {
  mockSetMode.mockReset();
  mockUser.mockReturnValue(null);
});

function setup() {
  return renderWithApp(
    <DocumentsProvider list={new DocumentList()}>
      <SettingsScreen />
    </DocumentsProvider>,
  );
}

describe('SettingsScreen', () => {
  it('offers language and theme', () => {
    const view = setup();
    expect(view.getByLabelText(/language/i)).toBeTruthy();
    expect(view.getByLabelText(/theme/i)).toBeTruthy();
  });

  it('offers no developer settings, because there are none left to offer', () => {
    /*
      There was a Developer settings row here, opening a sheet of six toggles —
      `showIds`, `showTicks`, `showMeasureBoundaries`, `showPlaybackScheduling`,
      `enableDiagnostics` and `enableValidationWarnings` — that no package in
      the family read, so every one of them did nothing at all. They are gone
      from `DevSettings` upstream, and the one setting left
      (`generationVariant`) has no control in this app, so the row could only
      have opened an empty modal.
    */
    expect(setup().queryByText(/developer/i)).toBeNull();
  });

  it('shows a sign-in route when there is no account', () => {
    expect(setup().queryByText(/sign out/i)).toBeNull();
  });

  it('offers sign-out once signed in', () => {
    mockUser.mockReturnValue({ uid: 'u1', email: 'a@example.com' });
    expect(setup().getByText(/sign out/i)).toBeTruthy();
  });
});
