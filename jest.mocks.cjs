/**
 * Native modules that have no JS implementation to fall back on.
 *
 * Each one here is a module whose absence throws at import time rather than
 * degrading — which would fail every component test for a reason that has
 * nothing to do with the component.
 */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children, ...rest }) =>
      React.createElement(require('react-native').View, rest, children),
    SafeAreaInsetsContext: React.createContext(inset),
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets: inset, frame },
  };
});

/*
  The filesystem, which a component test has none of.

  `react-native-fs` builds a `NativeEventEmitter` at import time and throws
  without its native module, so this has to be a mock rather than a transform
  allowance — there is nothing to transform *to*. Every method resolves rather
  than rejecting: a component under test should exercise its own logic, not a
  storage error it did not ask for.
*/
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(async () => ''),
    writeFile: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    exists: jest.fn(async () => false),
    mkdir: jest.fn(async () => undefined),
    DocumentDirectoryPath: '/documents',
    CachesDirectoryPath: '/caches',
  },
}));

jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageTag: 'en', languageCode: 'en' }],
}));

