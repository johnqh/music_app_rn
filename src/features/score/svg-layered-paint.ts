import { createLayeredPaint } from '@sudobility/music_drawing';
import type { CanvasScoreRenderer } from '@sudobility/music_drawing';
import { SvgDrawingContext } from './svg-context';

export type SvgPicture = { base: string; overlay: string };

export function createSvgLayeredPaint(
  renderer: CanvasScoreRenderer,
  size: () => { width: number; height: number },
  show: (picture: SvgPicture) => void,
) {
  const context = () => {
    const { width, height } = size();
    return new SvgDrawingContext(width, height);
  };
  return createLayeredPaint<string>(renderer, {
    record: draw => {
      const base = context();
      draw(base);
      return base.toSvg();
    },
    present: (base, drawOverlay) => {
      const overlay = context();
      drawOverlay(overlay);
      show({ base, overlay: overlay.toSvg(null) });
    },
  });
}
