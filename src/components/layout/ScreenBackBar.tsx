/**
 * The way back out of a pushed screen — nothing, on the platforms that have one.
 *
 * iOS and Android draw the native stack's own header, with its own back button
 * and its own gesture, and a second one drawn in the body would be a duplicate
 * of a control the platform already provides.
 *
 * `ScreenBackBar.macos.tsx` is the one that draws something: see it for why.
 */
export function ScreenBackBar() {
  return null;
}
