/**
 * The signed-out state of a screen that needs an account.
 *
 * "No server" and "not signed in" are different problems with different
 * remedies, and a screen that renders an empty list for either leaves the
 * reader guessing which. This one offers the remedy — and offers it *over*
 * the screen, as `LoginModal`, because signing in is in the way of what the
 * screen is for rather than the point of it: done, the reader is still there.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';

const mockSignIn = jest.fn<() => Promise<void>>();

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    getToken: async () => null,
    signInWithEmail: () => mockSignIn(),
    signUpWithEmail: async () => {},
    signInWithGoogle: async () => {},
    signInWithApple: async () => {},
    sendPasswordResetEmail: async () => {},
    signOut: async () => {},
  }),
  googleAvailable: false,
  appleAvailable: false,
}));

const { SignInRequired } =
  require('./SignInRequired') as typeof import('./SignInRequired');

beforeEach(() => {
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue(undefined);
});

describe('SignInRequired', () => {
  it('says an account is what is missing, not the server', () => {
    const view = renderWithApp(<SignInRequired />);
    expect(view.getByText(/sign in to continue/i)).toBeTruthy();
    expect(view.queryByText(/server/i)).toBeNull();
  });

  it('opens the sign-in modal over the screen on arrival', () => {
    const view = renderWithApp(<SignInRequired />);
    expect(view.getByTestId('login-view')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('once: closed, it leaves the prompt and its button, which open it again', () => {
    const view = renderWithApp(<SignInRequired />);
    fireEvent.press(view.getByRole('button', { name: 'Close' }));
    expect(view.queryByTestId('login-view')).toBeNull();
    expect(view.getByText(/sign in to continue/i)).toBeTruthy();

    // Re-rendering is not arriving again: it stays closed.
    view.rerender(<SignInRequired />);
    expect(view.queryByTestId('login-view')).toBeNull();

    // By role: the explanation above the button also says "sign in".
    fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
    expect(view.getByTestId('login-view')).toBeTruthy();
  });

  it('closes once signed in', async () => {
    const view = renderWithApp(<SignInRequired />);
    expect(view.getByTestId('login-view')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Close' })).toBeTruthy();

    fireEvent.changeText(view.getByLabelText(/email/i), 'a@example.com');
    fireEvent.changeText(view.getByLabelText(/password/i), 'hunter2hunter2');
    await act(async () => {
      // The modal's form is the last "Sign in" on screen: the prompt's own
      // button is behind it.
      const buttons = view.getAllByRole('button', { name: 'Sign in' });
      fireEvent.press(buttons[buttons.length - 1]!);
    });

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('login-view')).toBeNull();
  });
});
