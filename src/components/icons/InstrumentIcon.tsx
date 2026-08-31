/**
 * An instrument's line art, drawn with `react-native-svg`.
 *
 * The art itself (`trackInstrumentIcon`) lives in music_types beside the GM
 * catalogue, because the canvas renderer draws the same shapes into the track
 * gutter — one source beats passing a per-track art map into the renderer as an
 * option. This is the React Native half of the pair the web's
 * `instrument-icon.tsx` is the DOM half of, so an oboe on a phone is the web's
 * oboe rather than a lookalike.
 *
 * The colour is **passed, not inherited**: `currentColor` is an SVG idea
 * react-native-svg does not resolve, which is the same reason `NotationIcon`
 * takes one. `useNotationInk` is what keeps it following the theme.
 */
import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  ICON_STROKE_WIDTH,
  ICON_VIEWBOX,
  trackInstrumentIcon,
} from '@sudobility/music_types';
import type { Track } from '@sudobility/music_types';

export type InstrumentIconProps = {
  /**
   * The track, not a program number: `midiProgram` addresses a drum kit on a
   * percussion track, so the same number that draws a violin there should draw
   * a kit. Only the two fields that decide the art are required.
   */
  track: Pick<Track, 'clef' | 'midiProgram'>;
  size?: number;
  color: string;
};

const DEFAULT_SIZE = 16;

/**
 * Decorative: the instrument's name is always rendered beside it, so this
 * carries no accessible name of its own and a screen reader gets the words.
 */
export const InstrumentIcon = memo(function InstrumentIcon({
  track,
  size = DEFAULT_SIZE,
  color,
}: InstrumentIconProps) {
  const art = trackInstrumentIcon(track);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      fill="none"
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {art.shapes.map((shape, index) =>
        shape.kind === 'circle' ? (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ) : (
          <Path key={index} d={shape.d} />
        ),
      )}
    </Svg>
  );
});
