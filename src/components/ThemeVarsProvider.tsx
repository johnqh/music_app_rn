/**
 * Applies the theme variables and swaps them by colour scheme.
 *
 * Wraps the whole app so every descendant resolves `bg-background`,
 * `text-foreground` and the rest to the active theme. Without it the semantic
 * utilities resolve to undefined variables and the app renders in browser
 * defaults.
 *
 * It applies a decision it does not make: `ThemeProvider` owns the preference,
 * including whether "follow the system" is in force. Keeping the two apart is
 * what lets a settings screen change the theme without knowing anything about
 * design tokens.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { darkThemeVars, lightThemeVars } from '@/config/themeVars';
import { useTheme } from '@/config/ThemeContext';

export function ThemeVarsProvider({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  return (
    <View
      style={[
        styles.fill,
        resolved === 'dark' ? darkThemeVars : lightThemeVars,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
