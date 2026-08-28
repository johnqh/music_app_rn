/**
 * Activates the design-system theme for React Native.
 *
 * A side-effect module: importing it configures the theme before any component
 * renders. With a theme active, `variants.*` return theme-aware semantic
 * classes (`bg-primary`, `text-destructive`) rather than hardcoded legacy ones,
 * and NativeWind resolves those to colours through `createTailwindPreset()`.
 *
 * **Swiss, because that is what the web app uses** — `music_app`'s composition
 * root calls `configureTheme(swissTheme)`. The two apps are one product, and a
 * different palette on native would be a different product wearing the same
 * name.
 *
 * `native: true` resolves class overrides to each theme's
 * `nativeClassOverrides`, dropping web-only utilities like `backdrop-blur`.
 *
 * This theme MUST match `tailwind.config.js`, `themeVars.ts` and
 * `scripts/generate-theme-css.js`. Changing one alone gives an app whose
 * variables and utilities disagree.
 */
import { configureTheme } from '@sudobility/design';
import { swissTheme } from '@sudobility/design/themes';
import { cssInterop } from 'nativewind';
import Svg from 'react-native-svg';

configureTheme(swissTheme, { native: true });

/*
  Let react-native-svg — and the heroicons that render it — honour `className`
  colour utilities, mapping the resolved text colour onto the svg's `color`
  prop. Without this an icon cannot be tinted by a class and cannot follow
  light/dark.
*/
cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});
