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
/* The context calls it `signUp`; naming the mock otherwise leaves it undefined. */
const mockCreate = jest.fn<() => Promise<void>>();

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    getToken: async () => null,
    signIn: () => mockSignIn(),
    signUp: () => mockCreate(),
    signOut: async () => {},
  }),
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
});

function fill(view: ReturnType<typeof renderWithApp>) {
  fireEvent.changeText(view.getByLabelText(/email/i), 'a@example.com');
  fireEvent.changeText(view.getByLabelText(/password/i), 'hunter2hunter2');
}

describe('SignInScreen', () => {
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
