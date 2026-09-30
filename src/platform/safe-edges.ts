/**
 * Which edges of the screen a layout clears, for the device in hand: the
 * rule in `safe-edges-rule.ts`, fed the form factor and where the notch is.
 * `useNotchPosition` (building_blocks_rn) says which side, natively on iOS,
 * where the insets alone cannot tell.
 */
import { useMemo } from 'react';
import { useFormFactor } from '@sudobility/components-rn';
import { useNotchPosition } from '@sudobility/building_blocks_rn';
import { edgesAmong, safeEdgesFor } from './safe-edges-rule';
import type { Edge, SafeEdges } from './safe-edges-rule';

export type { Edge, SafeEdges } from './safe-edges-rule';

export function useSafeEdges(): SafeEdges {
  const formFactor = useFormFactor();
  const notch = useNotchPosition();
  return useMemo(() => safeEdgesFor(formFactor, notch), [formFactor, notch]);
}

export function useSafeEdgeList(among: readonly Edge[]): Edge[] {
  const edges = useSafeEdges();
  return useMemo(() => edgesAmong(edges, among), [edges, among]);
}
