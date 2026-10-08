import { describe, expect, it } from 'vitest';
import {
  CanvasScoreRenderer,
  LIGHT_RENDER_THEME,
} from '@sudobility/music_drawing';
import { twinkleScore } from '@sudobility/music_types/test';
import { createSvgLayeredPaint } from './svg-layered-paint';
import type { SvgPicture } from './svg-layered-paint';

describe('Windows layered score rendering', () => {
  it('returns complete hit-testing and lookahead metadata across repeated paints and page changes', () => {
    const score = twinkleScore();
    const pictures: SvgPicture[] = [];
    const paint = createSvgLayeredPaint(
      new CanvasScoreRenderer(),
      () => ({ width: 600, height: 300 }),
      picture => pictures.push(picture),
    );
    const options = {
      width: 600,
      layoutMode: 'page' as const,
      zoom: 1,
      theme: LIGHT_RENDER_THEME,
      activeTrackId: score.tracks[0]!.id,
      viewport: { top: 0, bottom: 300, left: 0, right: 600 },
    };
    for (const [version, top] of [
      [1, 0],
      [1, 0],
      [2, 300],
      [3, 600],
    ]) {
      const result = paint(
        score,
        {
          ...options,
          viewport: { ...options.viewport, top, bottom: top + 300 },
        },
        { baseVersion: version },
      );
      expect(result?.drawnMeasureIndices).toBeInstanceOf(Set);
      expect(result?.idToBBox).toBeInstanceOf(Map);
      expect(result?.measureNotePositions).toBeInstanceOf(Map);
      expect(result?.plan.systems.length).toBeGreaterThan(0);
    }
    expect(pictures[0]!.base).toBe(pictures[1]!.base);
    expect(pictures[0]!.overlay).not.toContain('fill="white"');
  });
});
