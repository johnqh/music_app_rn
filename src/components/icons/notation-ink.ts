/**
 * The colour a notation glyph is drawn in.
 *
 * `currentColor` is an SVG idea `react-native-svg` does not resolve, so every
 * `NotationIcon` is handed a literal colour — and a literal colour is exactly
 * the thing that cannot follow the theme. The toolbar used to hardcode
 * `#18181b`, which is invisible on a dark background: every drawn glyph on the
 * editing bar disappeared in dark mode while the heroicons beside them, tinted
 * through `className`, did not.
 *
 * Read from the same `swissTheme` tokens `themeVars.ts` applies, so there is
 * one statement of what "foreground" is rather than a hex copy of it. The
 * tokens are HSL triples (`0 0% 0%`), which react-native-svg will not parse, so
 * they are converted here.
 */
import { useMemo } from 'react';
import { swissTheme } from '@sudobility/design/themes';
import { useTheme } from '@/config/ThemeContext';

export type NotationInk = {
  /** Ordinary ink: a glyph on the bar's own surface. */
  foreground: string;
  /** Ink on a pressed toggle, whose chip is `bg-primary`. */
  onPrimary: string;
  /** A glyph that is present but not the subject — a readout, a hint. */
  muted: string;
};

/** `"0 0% 45%"` — the shape every `@sudobility/design` colour token has. */
function hslTripleToHex(triple: string): string {
  const [h = 0, s = 0, l = 0] = triple
    .split(/\s+/)
    .map(part => Number.parseFloat(part));
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const sector = Math.floor((((h % 360) + 360) % 360) / 60);
  const rgb = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][sector] ?? [0, 0, 0];
  const hex = rgb
    .map(channel =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
  return `#${hex}`;
}

export function useNotationInk(): NotationInk {
  const { resolved } = useTheme();
  return useMemo(() => {
    const tokens = resolved === 'dark' ? swissTheme.dark : swissTheme.light;
    return {
      foreground: hslTripleToHex(tokens.foreground),
      onPrimary: hslTripleToHex(tokens.primaryForeground),
      muted: hslTripleToHex(tokens.mutedForeground),
    };
  }, [resolved]);
}
