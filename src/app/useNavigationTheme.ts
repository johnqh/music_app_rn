/**
 * The navigator's own chrome — the headers it draws and the tab bar — in the
 * app's colours and the scheme in force.
 *
 * It was left on React Navigation's defaults, which are light whatever the
 * theme says. Built from the app's theme rather than read back from a
 * `NavigationContainer`, so that a navigation tree with no container above
 * it — each panel of a split view is one — arrives at the same answer.
 *
 * **A bar is the colour of the screen it is over, not of a card.** React
 * Navigation paints its bars `card`, which by default is white over a grey
 * screen. On an iPad the system's tab bar floats in that same row, drawn
 * over whatever is behind it — so a white bar put a white slab behind the
 * tab bar and beneath a grey status bar, where the bar was meant to be part
 * of the screen. `card` is therefore the app's background.
 */
import { useMemo } from 'react';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';
import { swissTheme } from '@sudobility/design/themes';
import {
  hslTripleToHex,
  useNotationInk,
} from '@/components/icons/notation-ink';
import { useTheme } from '@/config/ThemeContext';

export function useNavigationTheme(): Theme {
  const { resolved } = useTheme();
  const ink = useNotationInk();
  return useMemo(() => {
    const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
    const tokens = resolved === 'dark' ? swissTheme.dark : swissTheme.light;
    const background = hslTripleToHex(tokens.background);
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: ink.primary,
        background,
        card: background,
        text: ink.foreground,
        border: ink.border,
      },
    };
  }, [resolved, ink]);
}
