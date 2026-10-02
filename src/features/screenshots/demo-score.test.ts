import { describe, expect, it } from 'vitest';
import { BAR_LENGTH, DEMO_PARTS, demoMusicXml, parseBar } from './demo-score';

describe('the demo score', () => {
  it('fills every bar of every part, and every part has as many bars', () => {
    const barCount = DEMO_PARTS[0]!.bars.length;
    for (const part of DEMO_PARTS) {
      expect(part.bars, part.name).toHaveLength(barCount);
      part.bars.forEach((bar, index) => {
        const length = parseBar(bar).reduce(
          (sum, note) => sum + note.length,
          0,
        );
        expect(length, `${part.name} bar ${index + 1}`).toBe(BAR_LENGTH);
      });
    }
  });

  it('writes one part per instrument, with its program', () => {
    const xml = demoMusicXml();
    for (const part of DEMO_PARTS) {
      expect(xml).toContain(`<part-name>${part.name}</part-name>`);
      expect(xml).toContain(`<midi-program>${part.program}</midi-program>`);
    }
    expect(xml.match(/<part id=/g)).toHaveLength(DEMO_PARTS.length);
  });

  it('refuses a length no single note can be written as', () => {
    expect(() => parseBar('C4:5')).toThrow();
  });
});
