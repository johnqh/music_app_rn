/**
 * Hands the one rule (`useSafeEdges`) to components-rn, so the library's
 * edge-anchored surfaces clear the edges every screen here clears.
 *
 * A full-screen `FormModal` — every sheet on a phone — used to pad all four of
 * the system's insets: on a landscape Android phone that drew a band where the
 * hidden status bar would have been, a gutter down the side away from the
 * camera and another above the navigation bar, around a sheet laid out unlike
 * any screen behind it. The library's `SafeAreaEdgesProvider` reaches through
 * a native `Modal`, so stating the edges once at a window's root covers every
 * dialog opened inside it.
 */
import type { ReactNode } from 'react';
import { SafeAreaEdgesProvider } from '@sudobility/components-rn';
import { useSafeEdgeList } from './safe-edges';
import type { Edge } from './safe-edges';

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export function AppSafeEdges({ children }: { children: ReactNode }) {
  const edges = useSafeEdgeList(ALL_EDGES);
  return (
    <SafeAreaEdgesProvider edges={edges}>{children}</SafeAreaEdgesProvider>
  );
}
