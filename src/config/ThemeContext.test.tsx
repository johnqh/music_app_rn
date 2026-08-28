/**
 * Which colour scheme is in force, and how it changes.
 *
 * Three behaviours here are load-bearing and each fails quietly:
 *
 *   - `useTheme()` **answers without a provider**. That tolerance is what lets
 *     a component that only wants to know the scheme be tested with no theme
 *     wiring at all; if it threw instead, every such test would need a wrapper.
 *   - `system` resolves through the OS and *keeps* resolving — a device that
 *     goes dark at sunset takes the app with it, with no relaunch.
 *   - `setMode` repaints immediately and writes in the background. Awaiting the
 *     disk write before applying makes the toggle feel broken, and that is
 *     exactly the kind of change that looks harmless in review.
 *
 * `useColorScheme` is mocked at its own module path rather than through the
 * `react-native` barrel. Both obvious barrel approaches fail: a wholesale
 * factory drops every other export, and spreading `requireActual('react-native')`
 * *evaluates React Native's lazy getters* — `FlatList`, `SafeAreaView`,
 * `ProgressBarAndroid` — which fires their deprecation warnings and drags
 * VirtualizedList in at import time, failing the suite before a test runs.
 * Mocking the one module touches none of that.
 */
import { jest } from '@jest/globals';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

const mockColorScheme = jest.fn(() => 'light' as string | null);
const mockLoad = jest.fn(async () => 'system' as string);
const mockSave = jest.fn(async () => undefined);

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));
jest.mock('./theme-preference', () => ({
  loadThemeMode: (...a: unknown[]) => mockLoad(...(a as [])),
  saveThemeMode: (...a: unknown[]) => mockSave(...(a as [])),
}));
jest.mock('@/documents/rn-key-value', () => ({
  createKeyValueStore: () => ({}),
}));

const { ThemeProvider, useTheme } =
  require('./ThemeContext') as typeof import('./ThemeContext');

function Probe() {
  const { mode, resolved } = useTheme();
  return <Text>{`${mode}/${resolved}`}</Text>;
}

async function renderTheme() {
  const view = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  // The persisted mode arrives from an effect; let it land.
  await act(async () => {});
  return view;
}

beforeEach(() => {
  mockColorScheme.mockReturnValue('light');
  mockLoad.mockResolvedValue('system');
  mockSave.mockClear();
});

describe('useTheme without a provider', () => {
  it('answers rather than throwing', () => {
    render(<Probe />);
    expect(screen.getByText('system/light')).toBeTruthy();
  });

  it('has a setMode that is safe to call', () => {
    function Setter() {
      const { setMode } = useTheme();
      return <Text onPress={() => setMode('dark')}>set</Text>;
    }
    expect(() => render(<Setter />)).not.toThrow();
  });
});

describe('resolving the scheme', () => {
  it('follows the OS in system mode', async () => {
    mockColorScheme.mockReturnValue('dark');
    await renderTheme();
    expect(screen.getByText('system/dark')).toBeTruthy();
  });

  it('treats an unknown OS scheme as light', async () => {
    // `useColorScheme` answers null before the OS has reported; guessing dark
    // there would flash the wrong theme on every cold start.
    mockColorScheme.mockReturnValue(null);
    await renderTheme();
    expect(screen.getByText('system/light')).toBeTruthy();
  });

  it('lets an explicit choice override the OS', async () => {
    mockColorScheme.mockReturnValue('dark');
    mockLoad.mockResolvedValue('light');
    await renderTheme();
    expect(screen.getByText('light/light')).toBeTruthy();
  });
});

describe('the remembered preference', () => {
  it('adopts what was stored, rather than defaulting over it', async () => {
    mockLoad.mockResolvedValue('dark');
    await renderTheme();
    expect(screen.getByText('dark/dark')).toBeTruthy();
  });
});
