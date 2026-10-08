import { describe, expect, it } from 'vitest';
import {
  CanvasScoreRenderer,
  DARK_RENDER_THEME,
  LIGHT_RENDER_THEME,
} from '@sudobility/music_drawing';
import { twinkleScore } from '@sudobility/music_types/test';
import {
  FORMAT_VERSION,
  Op,
  PictureRecorder,
  parseColor,
} from '@sudobility/windows_canvas_rn/core';
import type { Picture } from '@sudobility/windows_canvas_rn/core';
import { createPictureLayeredPaint } from './picture-layered-paint';
import type { ScorePicture } from './picture-layered-paint';

/** Which ops a picture holds, and the colours its fills use. */
function survey(picture: Picture) {
  const ops = new Set<number>();
  const fills = new Set<number>();
  // Walk op by op only as far as each op's opcode and colour: enough to see
  // what was drawn without re-implementing the decoder here.
  const raw = picture.ops;
  expect(raw[0]).toBe(FORMAT_VERSION);
  // A NaN would reach Direct2D as a point or a width.
  expect(raw.every(Number.isFinite)).toBe(true);
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === Op.Fill && Number.isInteger(raw[i + 1])) {
      fills.add(raw[i + 1]!);
    }
  }
  for (const value of [Op.Fill, Op.Stroke, Op.Text]) {
    if (raw.includes(value)) ops.add(value);
  }
  return { ops, fills };
}

function paintTwinkle(theme = LIGHT_RENDER_THEME) {
  const score = twinkleScore();
  const pictures: ScorePicture[] = [];
  const paint = createPictureLayeredPaint(
    new CanvasScoreRenderer(),
    (width, height) => new PictureRecorder(width, height),
    () => ({ width: 600, height: 300 }),
    picture => pictures.push(picture),
  );
  const options = {
    width: 600,
    layoutMode: 'page' as const,
    zoom: 1,
    theme,
    activeTrackId: score.tracks[0]!.id,
    viewport: { top: 0, bottom: 300, left: 0, right: 600 },
  };
  return { score, pictures, paint, options };
}

describe('Windows layered score rendering', () => {
  it('returns complete hit-testing and lookahead metadata across repeated paints and page changes', () => {
    const { score, pictures, paint, options } = paintTwinkle();
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
      expect(result?.idToBBox.size).toBeGreaterThan(0);
      expect(result?.measureNotePositions).toBeInstanceOf(Map);
      expect(result?.plan.systems.length).toBeGreaterThan(0);
    }
    // Only the lit notes changed between the first two paints: same base.
    expect(pictures[0]!.base).toBe(pictures[1]!.base);
    expect(pictures[2]!.base).not.toBe(pictures[1]!.base);
  });

  it('records the notation as shapes and its words as text', () => {
    const { score, pictures, paint, options } = paintTwinkle();
    paint(score, options, { baseVersion: 1 });
    const { base, overlay } = pictures[0]!;
    const drawn = survey(base);
    expect(drawn.ops.has(Op.Fill)).toBe(true);
    expect(drawn.ops.has(Op.Stroke)).toBe(true);
    // Words, which react-native-svg on Windows dropped: the bar numbers are
    // in the base, and the gutter — the track's name — is painted last, over
    // the overlay.
    expect(drawn.ops.has(Op.Text)).toBe(true);
    expect(base.strings).toContain('2');
    expect(overlay.strings).toContain(score.tracks[0]!.name);
    // The active track's notes are the overlay.
    expect(survey(overlay).ops.has(Op.Fill)).toBe(true);
  });

  it('paints no background of its own, so a dark theme is not drawn on white', () => {
    const { score, pictures, paint, options } = paintTwinkle(DARK_RENDER_THEME);
    paint(score, options, { baseVersion: 1 });
    const { fills } = survey(pictures[0]!.base);
    expect(fills.has(parseColor('#ffffff'))).toBe(false);
    expect(fills.has(parseColor(DARK_RENDER_THEME.foreground))).toBe(true);
  });
});
