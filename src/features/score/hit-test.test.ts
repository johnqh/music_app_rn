import { describe, expect, it } from 'vitest';
import { measureAt, tickAt } from './hit-test.js';
import type { LayoutPlan } from '@sudobility/music_drawing';

/** Two tracks, two bars each, stacked — the arrangement that makes order matter. */
function plan(): LayoutPlan {
  const measures = (y: number) => [
    {
      measureIndex: 0,
      isFirstInSystem: true,
      box: { x: 0, y, width: 100, height: 40 },
    },
    {
      measureIndex: 1,
      isFirstInSystem: false,
      box: { x: 100, y, width: 100, height: 40 },
    },
  ];
  return {
    tracks: [],
    trackLayouts: [
      { track: { id: 'upper' }, measures: measures(0) },
      { track: { id: 'lower' }, measures: measures(40) },
    ],
    systems: [],
    totalWidth: 200,
    totalHeight: 80,
  } as unknown as LayoutPlan;
}

describe('measureAt', () => {
  it('finds the bar and the track', () => {
    expect(measureAt(plan(), { x: 150, y: 20 })).toEqual({
      trackId: 'upper',
      measureIndex: 1,
      fraction: 0.5,
    });
  });

  it('tells stacked tracks apart', () => {
    expect(measureAt(plan(), { x: 50, y: 60 })?.trackId).toBe('lower');
  });

  it('reports where along the bar the touch landed', () => {
    expect(measureAt(plan(), { x: 25, y: 10 })?.fraction).toBeCloseTo(0.25);
    expect(measureAt(plan(), { x: 0, y: 10 })?.fraction).toBeCloseTo(0);
  });

  it('answers null outside the music rather than guessing', () => {
    expect(measureAt(plan(), { x: 500, y: 10 })).toBeNull();
    expect(measureAt(plan(), { x: 50, y: 500 })).toBeNull();
  });

  it('picks by nearest centre where boxes abut, not by iteration order', () => {
    // y = 40 is the boundary and belongs to both boxes; just past it the lower
    // stave's centre is nearer, and that is what decides — not which track
    // happened to be visited first.
    expect(measureAt(plan(), { x: 50, y: 45 })?.trackId).toBe('lower');
    expect(measureAt(plan(), { x: 50, y: 35 })?.trackId).toBe('upper');
  });

  it('resolves an exact tie to the upper stave, deterministically', () => {
    // Dead on the boundary both centres are equidistant. Which one wins
    // matters less than that it is always the same one: a hit test that
    // answered differently on identical input would be maddening to use.
    expect(measureAt(plan(), { x: 50, y: 40 })?.trackId).toBe('upper');
  });
});

describe('tickAt', () => {
  it('interpolates across the bar', () => {
    expect(
      tickAt({ trackId: 't', measureIndex: 0, fraction: 0.5 }, 1920, 1920),
    ).toBe(2880);
    expect(
      tickAt({ trackId: 't', measureIndex: 0, fraction: 0 }, 1920, 1920),
    ).toBe(1920);
  });
});
