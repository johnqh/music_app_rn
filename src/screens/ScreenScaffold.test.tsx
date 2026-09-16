/**
 * The two states every server-backed screen has to be able to show, and the
 * insets its body has to keep clear of.
 *
 * "No server" and "not signed in" are different problems with different
 * remedies, and a screen that renders an empty list for either leaves the
 * reader guessing which. Saying which is missing is the whole job.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { renderWithApp } from '@/test/render';

/*
  A device with something at every edge: a side housing and a navigation bar.
  The shared mock in `jest.mocks.cjs` answers zero on all four, which makes a
  padding rule that forgets an inset indistinguishable from one that applies
  it.
*/
const insets = { top: 44, right: 21, bottom: 34, left: 21 };
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context') as Record<
    string,
    unknown
  >;
  return { ...actual, useSafeAreaInsets: () => insets };
});

const { ScreenScaffold, ServerUnavailable, SignInRequired } =
  require('./ScreenScaffold') as typeof import('./ScreenScaffold');

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

describe('ScreenScaffold insets', () => {
  /**
   * The padding the scrolling body actually lays out with.
   */
  function padding() {
    const view = renderWithApp(
      <ScreenScaffold title="Projects">
        <ServerUnavailable />
      </ScreenScaffold>,
    );
    const scroller = view.UNSAFE_getByType(ScrollView);
    return StyleSheet.flatten(
      scroller.props.contentContainerStyle as object,
    ) as Record<string, number>;
  }

  it('keeps the body clear of the side housing', () => {
    // A notched phone is landscape-only here, so the housing is on a side.
    const style = padding();
    expect(style.paddingLeft).toBeGreaterThan(insets.left);
    expect(style.paddingRight).toBeGreaterThan(insets.right);
  });

  it('keeps the last row clear of the navigation bar', () => {
    /*
      The failure this exists for: `paddingVertical` alone, on the belief that
      "the scroll view's own content inset covers the bottom". That is a
      UIScrollView-inside-a-navigation-controller fact and nothing at all on
      Android, where a scrolled Settings screen put the bottom of its last row
      inside the gesture band — measured on a Pixel 9 Pro XL, whose
      `navigationBars` inset is 24dp.
    */
    const style = padding();
    expect(style.paddingBottom).toBeGreaterThanOrEqual(insets.bottom);
  });

  it('leaves the top to the header the navigator draws', () => {
    // Doubling it would push every screen's first row down by a header again,
    // so the top is the scaffold's own padding and the bottom is that plus the
    // inset — stated as the difference, which is the rule itself.
    const style = padding();
    expect(style.paddingBottom - style.paddingTop).toBe(insets.bottom);
  });
});
