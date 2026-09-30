/**
 * The one rule for which edges a screen clears.
 */
import { describe, expect, it } from 'vitest';
import { edgesAmong, safeEdgesFor } from './safe-edges-rule';

describe('which edges a layout clears', () => {
  it('is nothing on a desktop', () => {
    expect(safeEdgesFor('desktop', 'left')).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });
  });

  it('is the top and the bottom on a tablet, whatever its notch', () => {
    for (const notch of ['top', 'left', null] as const) {
      expect(safeEdgesFor('tablet', notch)).toEqual({
        top: true,
        bottom: true,
        left: false,
        right: false,
      });
    }
  });

  it("is the notch's side on a phone, and only that", () => {
    expect(safeEdgesFor('phone', 'left')).toEqual({
      top: false,
      bottom: false,
      left: true,
      right: false,
    });
    expect(safeEdgesFor('phone', 'right')).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: true,
    });
  });

  it('is nothing on a phone without a notch, or one held upright', () => {
    expect(safeEdgesFor('phone', null).left).toBe(false);
    expect(safeEdgesFor('phone', 'top')).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });
  });

  it('answers a SafeAreaView with the edges it is responsible for', () => {
    const phone = safeEdgesFor('phone', 'right');
    expect(edgesAmong(phone, ['left', 'right'])).toEqual(['right']);
    expect(edgesAmong(phone, ['top'])).toEqual([]);
    const tablet = safeEdgesFor('tablet', null);
    expect(edgesAmong(tablet, ['top', 'left', 'right'])).toEqual(['top']);
  });
});
