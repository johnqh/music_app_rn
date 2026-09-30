/**
 * Which edges of the screen a layout clears: the rule, as a pure function.
 *
 * Every screen used to decide for itself — a top edge here, both sides there,
 * the left side only somewhere else — and the phone held with its notch on
 * the right was the case none of them had thought about. Now one rule says,
 * and `useSafeEdges` (`safe-edges.ts`) asks it for the device in hand.
 *
 * - **A desktop clears nothing**: a window has no notch and no status bar.
 * - **A tablet clears the top and the bottom**: the status bar and the home
 *   indicator. Its sides are plain.
 * - **A phone clears the notch's side and nothing else.** A phone is held on
 *   its side here, its status bar is hidden, and the notch — the island, the
 *   camera cutout — is on the left or the right depending on which way it was
 *   turned. The other side, which iOS insets all the same, is used to the
 *   edge.
 *
 * Apart from the hook, and with type-only imports, so that a test of the
 * rule needs no React Native.
 */
import type { FormFactor } from '@sudobility/components-rn';
import type { NotchPosition } from '@sudobility/building_blocks_rn';

export type SafeEdges = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

export type Edge = keyof SafeEdges;

export const NO_SAFE_EDGES: SafeEdges = {
  top: false,
  bottom: false,
  left: false,
  right: false,
};

export function safeEdgesFor(
  formFactor: FormFactor,
  notch: NotchPosition,
): SafeEdges {
  if (formFactor === 'desktop') return NO_SAFE_EDGES;
  if (formFactor === 'tablet')
    return { ...NO_SAFE_EDGES, top: true, bottom: true };
  return {
    ...NO_SAFE_EDGES,
    left: notch === 'left',
    right: notch === 'right',
  };
}

/**
 * The edges a `SafeAreaView` should clear: those the rule names, among the
 * ones this element is responsible for. A bar across the screen answers for
 * the sides; a screen's root answers for the top.
 */
export function edgesAmong(edges: SafeEdges, among: readonly Edge[]): Edge[] {
  return among.filter(edge => edges[edge]);
}
