/**
 * The two states every server-backed screen has to be able to show.
 *
 * "No server" and "not signed in" are different problems with different
 * remedies, and a screen that renders an empty list for either leaves the
 * reader guessing which. Saying which is missing is the whole job.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import {
  ScreenScaffold,
  ServerUnavailable,
  SignInRequired,
} from './ScreenScaffold';

describe('ScreenScaffold', () => {
  it('says the server is missing, not that there is nothing here', () => {
    const view = renderWithApp(
      <ScreenScaffold title="Projects">
        <ServerUnavailable />
      </ScreenScaffold>,
    );
    expect(view.getByText(/server/i)).toBeTruthy();
  });

  it('offers a way in when the problem is an account', () => {
    // A remedy, not just a diagnosis.
    const onSignIn = jest.fn();
    const view = renderWithApp(
      <ScreenScaffold title="Projects">
        <SignInRequired onSignIn={onSignIn} />
      </ScreenScaffold>,
    );
    // By role: the explanation above the button also says "sign in".
    fireEvent.press(view.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('tells the two apart', () => {
    /*
      The failure worth guarding: one empty state used for both. A reader with
      no account is told to check their connection, and gives up.
    */
    const noServer = renderWithApp(
      <ScreenScaffold title="P">
        <ServerUnavailable />
      </ScreenScaffold>,
    );
    const noAccount = renderWithApp(
      <ScreenScaffold title="P">
        <SignInRequired onSignIn={jest.fn()} />
      </ScreenScaffold>,
    );
    expect(noServer.queryByRole('button', { name: 'Sign in' })).toBeNull();
    expect(noAccount.queryByText(/server/i)).toBeNull();
  });
});
