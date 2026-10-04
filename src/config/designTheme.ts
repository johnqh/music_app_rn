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
  Let an `<Svg>` written in this app's JSX honour `className` colour
  utilities, mapping the resolved text colour onto the svg's `color` prop.

  It does **not** reach the heroicons. NativeWind applies an interop only to
  elements created through its JSX runtime, or through a `createElement` its
  babel plugin can see is React's; `react-native-heroicons` is prebuilt and
  calls `createElement` through a bundler alias the plugin does not
  recognise, so a `className` handed to a heroicon arrives at the `Svg` raw
  and `fill="currentColor"` resolves to black. Icons take `color` from
  `useNotationInk()`; `design-system.test.ts` refuses a class on one.
*/
cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});
