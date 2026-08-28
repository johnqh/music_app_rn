/**
 * The notation glyphs, drawn with `react-native-svg`.
 *
 * The shapes come from `NOTATION_ICONS` in `@sudobility/music_types` — the same
 * description the web toolbar draws. That is the whole point: a sharp sign here
 * and a sharp sign there are one drawing, not two that happen to look alike, so
 * tuning one cannot leave the other behind.
 *
 * `currentColor` is an SVG idea that react-native-svg does not resolve, so it
 * is substituted for the resolved `color` on the way through. Everything else —
 * the geometry, the fill rules, the stroke widths — is replayed verbatim.
 */
import { memo } from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { NOTATION_ICONS, NOTATION_ICON_VIEWBOX } from '@sudobility/music_types';
import type {
  NotationIconName,
  NotationIconShape,
} from '@sudobility/music_types';

export type NotationIconProps = {
  name: NotationIconName;
  /** Matches the web's `ICON_GLYPH_CLASS`, which is 18px. */
  size?: number;
  color?: string;
};

const DEFAULT_SIZE = 18;

/** The web authors these against `fill="currentColor"` on the root `<svg>`. */
function paint(value: string | undefined, color: string): string | undefined {
  if (value === undefined) return undefined;
  return value === 'currentColor' ? color : value;
}

function renderShape(
  shape: NotationIconShape,
  color: string,
  key: number,
): React.ReactElement | null {
  // Every shape inherits the icon's colour unless it names its own — which is
  // how the authored glyphs express "unfilled outline" with `fill="none"`.
  const common = {
    fill: paint((shape as { fill?: string }).fill, color) ?? color,
    stroke: paint((shape as { stroke?: string }).stroke, color),
    strokeWidth: (shape as { strokeWidth?: number }).strokeWidth,
    strokeLinecap: (shape as { strokeLinecap?: 'butt' | 'round' | 'square' })
      .strokeLinecap,
    strokeLinejoin: (shape as { strokeLinejoin?: 'miter' | 'round' | 'bevel' })
      .strokeLinejoin,
    strokeDasharray: (shape as { strokeDasharray?: string }).strokeDasharray,
    opacity: (shape as { opacity?: number }).opacity,
    transform: (shape as { transform?: string }).transform,
  };

  switch (shape.kind) {
    case 'path':
      return (
        <Path
          key={key}
          {...common}
          d={shape.d}
          {...(shape.fillRule ? { fillRule: shape.fillRule } : {})}
        />
      );
    case 'rect':
      return (
        <Rect
          key={key}
          {...common}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          {...(shape.rx === undefined ? {} : { rx: shape.rx })}
        />
      );
    case 'ellipse':
      return (
        <Ellipse
          key={key}
          {...common}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
        />
      );
    case 'circle':
      return (
        <Circle key={key} {...common} cx={shape.cx} cy={shape.cy} r={shape.r} />
      );
    case 'text':
      return (
        <SvgText
          key={key}
          {...common}
          x={shape.x}
          y={shape.y}
          {...(shape.fontSize === undefined
            ? {}
            : { fontSize: shape.fontSize })}
          {...(shape.fontStyle
            ? { fontStyle: shape.fontStyle as 'normal' | 'italic' }
            : {})}
          {...(shape.textAnchor
            ? { textAnchor: shape.textAnchor as 'start' | 'middle' | 'end' }
            : {})}
        >
          {shape.content}
        </SvgText>
      );
    case 'group':
      return (
        <G key={key} {...common} fill={common.fill}>
          {shape.shapes.map((child, index) => renderShape(child, color, index))}
        </G>
      );
    default:
      return null;
  }
}

export const NotationIcon = memo(function NotationIcon({
  name,
  size = DEFAULT_SIZE,
  color = '#000000',
}: NotationIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${NOTATION_ICON_VIEWBOX} ${NOTATION_ICON_VIEWBOX}`}
    >
      {NOTATION_ICONS[name].map((shape, index) =>
        renderShape(shape, color, index),
      )}
    </Svg>
  );
});
