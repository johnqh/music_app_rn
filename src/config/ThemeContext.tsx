/**
 * Which colour scheme is in force, and how to change it.
 *
 * Split from `ThemeVarsProvider` because they answer different questions: this
 * one owns the *preference* — read from storage at start-up, written back when
 * it changes — and that one applies whatever is decided. Keeping them apart is
 * what lets a settings screen change the theme without knowing anything about
 * design tokens.
 *
 * `system` resolves through React Native's `useColorScheme`, which reports OS
 * changes as they happen — so a device that goes dark at sunset takes the app
 * with it, without a relaunch.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemeMode } from '@sudobility/music_editing';
import { loadThemeMode, saveThemeMode } from './theme-preference';
import { createKeyValueStore } from '@/documents/rn-key-value';

export type ThemeState = {
  /** What the reader asked for, which may be "follow the OS". */
  mode: ThemeMode;
  /** What that resolves to right now. */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const store = createKeyValueStore();

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    void loadThemeMode(store).then(setModeState);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    // Applied straight away and written in the background: waiting on a disk
    // write to repaint would make the toggle feel broken.
    setModeState(next);
    void saveThemeMode(store, next);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({
      mode,
      resolved:
        mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode,
      setMode,
    }),
    [mode, system, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * The theme, tolerantly.
 *
 * Answers "light, following the system, and changing it does nothing" with no
 * provider, so a component that only wants to know the scheme needs no theme
 * wiring in its tests.
 */
export function useTheme(): ThemeState {
  return (
    useContext(ThemeContext) ?? {
      mode: 'system',
      resolved: 'light',
      setMode: () => {},
    }
  );
}
