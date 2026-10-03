/**
 * The "no server" state every server-backed screen has to be able to show,
 * and the insets its body has to keep clear of. The signed-out state is
 * `SignInRequired`'s, tested beside it.
 */
import { jest } from '@jest/globals';
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
/*
  Which edges are cleared is the one rule's (`useSafeEdges`), stood in for
  here as a phone held with its notch on the left: that side and no other.
*/
jest.mock('@/platform/safe-edges', () => {
  const rule = jest.requireActual('@/platform/safe-edges-rule') as {
    safeEdgesFor: (f: string, n: string) => Record<string, boolean>;
    edgesAmong: (e: Record<string, boolean>, a: string[]) => string[];
  };
  const edges = rule.safeEdgesFor('phone', 'left');
  return {
    useSafeEdges: () => edges,
    useSafeEdgeList: (among: string[]) => rule.edgesAmong(edges, among),
  };
});

const { ScreenScaffold, ServerUnavailable } =
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
});

describe('ScreenScaffold edge padding', () => {
  it("pads the notch's side and no other, and never the bottom", () => {
    const view = renderWithApp(
      <ScreenScaffold title="Projects">
        <ServerUnavailable />
      </ScreenScaffold>,
    );
    const scroller = view.UNSAFE_getByType(ScrollView);
    const style = StyleSheet.flatten(
      scroller.props.contentContainerStyle as object,
    ) as Record<string, number>;
    expect(style.paddingLeft).toBe(16 + insets.left);
    // The far side is used to the edge, whatever the platform insets it by.
    expect(style.paddingRight).toBe(16);
    expect(style.paddingBottom).toBe(16);
  });
});
