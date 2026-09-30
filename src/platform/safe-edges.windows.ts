/**
 * Windows: a desktop window, which clears nothing. Answered without the
 * device-layout hooks, which read the safe-area module this platform has no
 * build of (see `SafeArea.windows.tsx`).
 */
import { NO_SAFE_EDGES } from './safe-edges-rule';
import type { Edge, SafeEdges } from './safe-edges-rule';

export type { Edge, SafeEdges } from './safe-edges-rule';

export function useSafeEdges(): SafeEdges {
  return NO_SAFE_EDGES;
}

export function useSafeEdgeList(_among: readonly Edge[]): Edge[] {
  return [];
}
