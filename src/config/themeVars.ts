/**
 * The theme's CSS variables, applied at runtime.
 *
 * NativeWind on native does **not** switch CSS-variable blocks written in CSS
 * (`:root` / `.dark`). The variables are applied with `vars()` on a wrapping
 * view and swapped by colour scheme instead — which is what makes semantic
 * classes resolve to the active theme *and* flip light/dark.
 */
import { vars } from 'nativewind';
import { swissTheme } from '@sudobility/design/themes';
import type { ThemeTokens } from '@sudobility/design';

/** Keep in sync with tailwind.config.js, designTheme.ts and the css generator. */
const activeTheme = swissTheme;

function toVars(tokens: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    const name = '--' + key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    out[name] = String(value);
  }
  return out;
}

export const lightThemeVars = vars(toVars(activeTheme.light));
export const darkThemeVars = vars(toVars(activeTheme.dark));
