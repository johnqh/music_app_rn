/**
 * Whether the inspector opens before anybody has said.
 *
 * Pinned as arithmetic rather than through a render, because a rendered test
 * cannot see it: `AppLayout.test.tsx` renders with no layout at all, so
 * `useContainerSize` answers 0×0 and this rule is never exercised. It shipped
 * wrong for exactly that reason and only the simulator caught it.
 */
import { describe, expect, it } from 'vitest';
import {
  INSPECTOR_COLUMN_WIDTH,
  MIN_SCORE_WIDTH,
  inspectorOpensByDefault,
} from './inspector-default';

const NO_INSETS = { left: 0, right: 0 };

/** The sensor housing is on a *side* in landscape, which is where this bites. */
const IPHONE_LANDSCAPE_INSETS = { left: 62, right: 62 };

describe('inspectorOpensByDefault', () => {
  it('is closed before the frame has been measured', () => {
    // `useContainerSize` starts at 0×0, and a panel opened on a guess would
    // flick shut on the first real layout.
    expect(inspectorOpensByDefault(0, NO_INSETS)).toBe(false);
  });

  it('stays closed on a landscape phone, insets and all', () => {
    // 874 − 62 − 62 − 320 = 430, under the 480 a system needs.
    expect(inspectorOpensByDefault(874, IPHONE_LANDSCAPE_INSETS)).toBe(false);
  });

  it('would have opened on that phone if the insets were ignored', () => {
    /*
      The bug stated as a fact rather than as a memory. `onLayout` reports the
      frame and `SafeAreaView` pads *inside* it, so the width arriving here is
      the whole 874 — which clears the bar. Measured on an iPhone 16 Pro: the
      panel opened, the score got 430pt and the column was 105pt tall with
      "Piano" cut off halfway.
    */
    expect(inspectorOpensByDefault(874, NO_INSETS)).toBe(true);
  });

  it('opens on a landscape 11-inch tablet', () => {
    // 1194 − 320 = 874, and an iPad has no side insets in landscape.
    expect(inspectorOpensByDefault(1194, NO_INSETS)).toBe(true);
  });

  it('opens in a desktop window', () => {
    expect(inspectorOpensByDefault(1280, NO_INSETS)).toBe(true);
  });

  it('turns exactly on "a readable system is left"', () => {
    // Stated against the constants rather than a copied number, so tuning
    // either moves the boundary rather than leaving this test asserting the
    // old one.
    const edge = INSPECTOR_COLUMN_WIDTH + MIN_SCORE_WIDTH;
    expect(inspectorOpensByDefault(edge, NO_INSETS)).toBe(true);
    expect(inspectorOpensByDefault(edge - 1, NO_INSETS)).toBe(false);
  });
});
