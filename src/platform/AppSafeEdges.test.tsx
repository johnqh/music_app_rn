/**
 * The one rule reaches what the library draws, and what this app draws over
 * every screen.
 *
 * A sheet on a phone is a full-screen `FormModal`, and it padded all four of
 * the system's insets whatever the app had decided: the Print sheet on a
 * landscape Android phone had a band where the hidden status bar would have
 * been and gutters down the plain side and above the navigation bar, around a
 * layout unlike any screen behind it. `AppSafeEdges` hands the rule to the
 * library; these tests stand the rule in as a phone held notch-left, and give
 * every edge an inset so that one left in is visible.
 */
import { jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import type { ViewStyle } from 'react-native';
import { FormModal } from '@sudobility/components-rn';
import { renderWithApp } from '@/test/render';

const insets = { top: 24, right: 48, bottom: 34, left: 159 };
// The shared mock (`jest.mocks.cjs`) with an inset at every edge. Not
// `requireActual`: the real provider draws nothing until it has measured, and
// a test renderer measures nothing, so a sheet inside one never mounts.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const frame = { x: 0, y: 0, width: 844, height: 390 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaView: ({
      children,
      ...rest
    }: { children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement(View, rest, children),
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});
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

const { AppSafeEdges } =
  require('./AppSafeEdges') as typeof import('./AppSafeEdges');
const { createToastQueue, Toasts } =
  require('@/features/toasts/Toasts') as typeof import('@/features/toasts/Toasts');

function allStyles(view: ReturnType<typeof renderWithApp>): ViewStyle[] {
  const nodes = view.UNSAFE_root.findAll(() => true) as {
    props?: { style?: unknown };
  }[];
  return nodes.map(
    node =>
      (StyleSheet.flatten(node.props?.style as ViewStyle) ?? {}) as ViewStyle,
  );
}

describe('AppSafeEdges', () => {
  it("pads a phone's full-screen sheet for the notch's side alone", () => {
    const view = renderWithApp(
      <AppSafeEdges>
        <FormModal visible title="Print" onClose={() => {}} actions={[]}>
          <Text>body</Text>
        </FormModal>
      </AppSafeEdges>,
    );
    const styles = allStyles(view);
    expect(
      styles.some(
        s =>
          s.paddingLeft === 159 && s.paddingRight === 0 && s.paddingTop === 0,
      ),
    ).toBe(true);
    // Neither the hidden status bar's row, nor the far side, nor the bottom.
    expect(styles.some(s => s.paddingTop === 24)).toBe(false);
    expect(styles.some(s => s.paddingRight === 48)).toBe(false);
    expect(styles.some(s => s.paddingBottom === 34)).toBe(false);
  });
});

describe('Toasts', () => {
  it("keeps clear of the notch's side, and of no other edge", () => {
    const queue = createToastQueue();
    const view = renderWithApp(<Toasts queue={queue} />);
    act(() => {
      queue.push({ id: 't1', severity: 'info', message: 'Saved' });
    });
    expect(
      allStyles(view).some(
        s => s.left === 16 + 159 && s.right === 16 && s.bottom === 16,
      ),
    ).toBe(true);
  });
});
