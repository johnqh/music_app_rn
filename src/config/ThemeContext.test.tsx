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
 *   - `setMode` writes the **device prefs**, which is the one store every open
 *     document mirrors and the binding persists. Setting it anywhere else would
 *     change one tab and remember nothing.
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

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));
const { ThemeProvider, useTheme } =
  require('./ThemeContext') as typeof import('./ThemeContext');
const { devicePrefs } =
  require('./useDevicePrefs') as typeof import('./useDevicePrefs');

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
  await act(async () => {});
  return view;
}

beforeEach(() => {
  mockColorScheme.mockReturnValue('light');
  devicePrefs.getState().setThemeMode('system');
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
    devicePrefs.getState().setThemeMode('light');
    await renderTheme();
    expect(screen.getByText('light/light')).toBeTruthy();
  });
});

describe('the device preference', () => {
  it('adopts what the prefs store holds, rather than defaulting over it', async () => {
    devicePrefs.getState().setThemeMode('dark');
    await renderTheme();
    expect(screen.getByText('dark/dark')).toBeTruthy();
  });

  it('writes a change to the prefs store and repaints at once', async () => {
    function Setter() {
      const { mode, setMode } = useTheme();
      return <Text onPress={() => setMode('dark')}>{`mode:${mode}`}</Text>;
    }
    render(
      <ThemeProvider>
        <Setter />
      </ThemeProvider>,
    );
    await act(async () => {
      screen.getByText('mode:system').props.onPress();
    });
    expect(devicePrefs.getState().themeMode).toBe('dark');
    expect(screen.getByText('mode:dark')).toBeTruthy();
  });
});
