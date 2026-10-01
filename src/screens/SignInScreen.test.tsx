/**
 * Signing in, and creating an account.
 *
 * One form for both, because they take the same two fields — and the mode
 * decides which call is made. Getting that backwards silently creates an
 * account for somebody trying to sign in, which is not recoverable from the
 * screen.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';

const mockSignIn = jest.fn<() => Promise<void>>();
/* The context calls it `signUpWithEmail`; naming the mock otherwise leaves it undefined. */
const mockCreate = jest.fn<() => Promise<void>>();
const mockGoogle = jest.fn<() => Promise<void>>();
const mockGoogleAvailable = jest.fn<() => boolean>();
const mockApple = jest.fn<() => Promise<void>>();
const mockAppleAvailable = jest.fn<() => boolean>();

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    getToken: async () => null,
    signInWithEmail: () => mockSignIn(),
    signUpWithEmail: () => mockCreate(),
    signInWithGoogle: () => mockGoogle(),
    signInWithApple: () => mockApple(),
    signOut: async () => {},
  }),
  // Module exports beside the shared context, read at render time — getters,
  // so each test's mockReturnValue is what the screen sees.
  get googleAvailable() {
    return mockGoogleAvailable();
  },
  get appleAvailable() {
    return mockAppleAvailable();
  },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

const { SignInScreen } =
  require('./SignInScreen') as typeof import('./SignInScreen');

beforeEach(() => {
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue(undefined);
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(undefined);
  mockGoogle.mockReset();
  mockGoogle.mockResolvedValue(undefined);
  mockGoogleAvailable.mockReset();
  mockGoogleAvailable.mockReturnValue(false);
  mockApple.mockReset();
  mockApple.mockResolvedValue(undefined);
  mockAppleAvailable.mockReset();
  mockAppleAvailable.mockReturnValue(false);
});

function fill(view: ReturnType<typeof renderWithApp>) {
  fireEvent.changeText(view.getByLabelText(/email/i), 'a@example.com');
  fireEvent.changeText(view.getByLabelText(/password/i), 'hunter2hunter2');
}

describe('SignInScreen', () => {
  describe('Apple', () => {
    it('is offered where it can be done, and signs in with it', async () => {
      mockAppleAvailable.mockReturnValue(true);
      const view = renderWithApp(<SignInScreen />);

      await act(async () => {
        fireEvent.press(
          view.getByRole('button', { name: 'Continue with Apple' }),
        );
      });

      expect(mockApple).toHaveBeenCalledTimes(1);
      expect(mockGoogle).not.toHaveBeenCalled();
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('is not offered where it cannot be done', () => {
      const view = renderWithApp(<SignInScreen />);
      expect(view.queryByText('Continue with Apple')).toBeNull();
    });

    it('says why when it fails', async () => {
      mockAppleAvailable.mockReturnValue(true);
      mockApple.mockRejectedValue(new Error('No identity token from Apple'));
      const view = renderWithApp(<SignInScreen />);

      await act(async () => {
        fireEvent.press(
          view.getByRole('button', { name: 'Continue with Apple' }),
        );
      });

      expect(view.getByText('No identity token from Apple')).toBeTruthy();
    });

    it('comes before Google, as it must where both are offered', () => {
      mockAppleAvailable.mockReturnValue(true);
      mockGoogleAvailable.mockReturnValue(true);
      const view = renderWithApp(<SignInScreen />);
      const labels = view
        .getAllByRole('button')
        .map(button => button.props.accessibilityLabel as string | undefined);
      expect(labels.indexOf('Continue with Apple')).toBeGreaterThan(-1);
      expect(labels.indexOf('Continue with Apple')).toBeLessThan(
        labels.indexOf('Continue with Google'),
      );
    });
  });

  describe('Google', () => {
    it('is offered where it can be done, and signs in with it', async () => {
      // An account made on the web with Google has no password: without
      // this, the person who made it cannot sign in here at all.
      mockGoogleAvailable.mockReturnValue(true);
      const view = renderWithApp(<SignInScreen />);

      await act(async () => {
        fireEvent.press(
          view.getByRole('button', { name: 'Continue with Google' }),
        );
      });

      expect(mockGoogle).toHaveBeenCalledTimes(1);
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("carries Google's mark beside the words, and still reads out as the words", () => {
      mockGoogleAvailable.mockReturnValue(true);
      const view = renderWithApp(<SignInScreen />);

      expect(
        view.getByRole('button', { name: 'Continue with Google' }),
      ).toBeTruthy();
      expect(view.getByText('Continue with Google')).toBeTruthy();
      // The four colours are the mark: a "G" in the theme's ink is not it.
      // The renderer hands colours on as opaque ARGB numbers.
      const drawn = JSON.stringify(view.toJSON());
      for (const colour of ['EA4335', '4285F4', 'FBBC05', '34A853']) {
        expect(drawn).toContain(String(0xff000000 + parseInt(colour, 16)));
      }
    });

    it('is not offered where it cannot, rather than offered and failing', () => {
      const view = renderWithApp(<SignInScreen />);
      expect(view.queryByText('Continue with Google')).toBeNull();
    });

    it('says why when it fails', async () => {
      mockGoogleAvailable.mockReturnValue(true);
      mockGoogle.mockRejectedValue(new Error('OAuth error: access_denied'));
      const view = renderWithApp(<SignInScreen />);

      await act(async () => {
        fireEvent.press(
          view.getByRole('button', { name: 'Continue with Google' }),
        );
      });

      expect(view.getByText(/access_denied/)).toBeTruthy();
    });
  });

  it('signs in by default, rather than creating an account', () => {
    const view = renderWithApp(<SignInScreen />);
    fill(view);
    act(() => {
      fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
    });
    expect(mockSignIn).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates an account only after switching mode', () => {
    const view = renderWithApp(<SignInScreen />);
    fireEvent.press(view.getByText(/create an account/i));
    fill(view);
    act(() => {
      fireEvent.press(view.getByRole('button', { name: 'Create account' }));
    });
    expect(mockCreate).toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows a failure rather than appearing to succeed', async () => {
    // A form that clears on a failed sign-in reads as having worked.
    mockSignIn.mockRejectedValue(new Error('wrong password'));
    const view = renderWithApp(<SignInScreen />);
    fill(view);
    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
    });
    expect(view.getByText('wrong password')).toBeTruthy();
  });
});
