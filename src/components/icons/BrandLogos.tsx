/**
 * The marks of the companies somebody can sign in with.
 *
 * Drawn, not shipped as images: `react-native-svg` is already here for the
 * notation glyphs, a path is sharp at any size on any screen, and a PNG
 * would need a copy per density and still blur on a desktop window dragged
 * to a larger display.
 *
 * **These are the one place a colour is written as a literal.** Every other
 * colour in the app comes from the theme, so that it follows light and dark.
 * A trademark does not: Google's four colours are Google's, specified by
 * their branding guidelines, and a "G" recoloured to suit a theme is no
 * longer their mark. So `GoogleLogo` takes no colour at all. Apple's mark is
 * a single shape in black or white, which is the placement's to choose —
 * white on a black button, black on a white one — so it takes a tone.
 */
import Svg, { Path } from 'react-native-svg';

export type BrandLogoProps = {
  /** Width and height; both marks are drawn square. */
  size?: number;
};

const DEFAULT_SIZE = 18;

/** Google's "G", in its own four colours. */
export function GoogleLogo({ size = DEFAULT_SIZE }: BrandLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** The two colours Apple's mark may be drawn in, and nothing between. */
const APPLE_TONE = { black: '#000000', white: '#ffffff' } as const;

/**
 * Apple's mark. `tone` is black or white, chosen against what it sits on —
 * named rather than passed as a colour, so the literal stays in this file.
 *
 * Drawn in a square although the mark itself is taller than it is wide
 * (814 by 1000): the box is what lines it up with the text beside it and
 * with `GoogleLogo` above or below it, and the shape is centred inside.
 */
export function AppleLogo({
  size = DEFAULT_SIZE,
  tone,
}: BrandLogoProps & { tone: keyof typeof APPLE_TONE }) {
  return (
    <Svg width={size} height={size} viewBox="-93 0 1000 1000">
      <Path
        fill={APPLE_TONE[tone]}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.8-155.5-127.4c-58.3-81.3-105.4-207.1-105.4-326.6C-0.9 502 46.9 381.1 130.8 315c58.3-46.2 128.3-73.3 194.6-73.3 64.3 0 120.5 43.4 184.7 43.4 62.2 0 112.3-46.2 190.2-46.2 24.2 0 52.5 4.5 77.8 14zM554.6 0c13 63.5-18.5 127-43.4 167.7C476.5 220.4 422.8 262 362.7 262c-2.6-12.3-4.5-25.3-4.5-38.3 0-61.6 23.4-127 68-172.7C467 8.4 528.8-4.5 554.6 0z"
      />
    </Svg>
  );
}
