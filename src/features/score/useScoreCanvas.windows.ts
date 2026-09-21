/**
 * Windows score-canvas fallback.
 *
 * The real adapter records music_drawing into Skia pictures. Skia has no
 * Windows target, so this keeps the editor shell and document state usable
 * without loading the unsupported native module. It deliberately reports no
 * score geometry until a Windows drawing surface is implemented.
 */
import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';
import type {
  LayoutMode,
  PitchDisplay,
  Score,
  ScoreCanvasHit,
} from '@sudobility/music_types';
import type { RenderTheme } from '@sudobility/music_drawing';

export type CursorState = {
  path: null;
  motion: { tick: number; atMs: number; ticksPerSecond: number };
  id: number;
};

export type ScrollOffset = { left: number; top: number };

export type Signal<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useSignal<T>(signal: Signal<T>): T {
  return signal.get();
}

export type ScoreCanvasHandles = {
  vertical: RefObject<ScrollView | null>;
  horizontal: RefObject<ScrollView | null>;
  size: RefObject<{ width: number; height: number }>;
};

const EMPTY_CURSOR: CursorState = {
  path: null,
  motion: { tick: 0, atMs: 0, ticksPerSecond: 0 },
  id: 0,
};

export function useScoreCanvas({ size }: ScoreCanvasHandles) {
  const picture = createSignal<null>(null);
  const cursor = createSignal<CursorState>(EMPTY_CURSOR);
  const scroll = createSignal<ScrollOffset>({ left: 0, top: 0 });
  const canvas = {
    setStoredScore: (_score: Score, _pitchDisplay: PitchDisplay) => {},
    setView: (_options: {
      width: number;
      height: number;
      zoom: number;
      layoutMode: LayoutMode;
      theme: RenderTheme;
      showTrackInfo: boolean;
      trackIds?: string[];
    }) => {},
    contentSize: () => ({
      width: size.current.width,
      height: size.current.height,
    }),
    setActiveTrack: (_trackId: string | null) => {},
    setSelectedNotes: (
      _ids: readonly string[],
      _options: { regenerated: boolean },
    ) => {},
    setSelectedMeasures: (_ids: readonly string[]) => {},
    setScroll: (_left: number, _top: number) => {},
    followTarget: (_tick: number): ScrollOffset => ({ left: 0, top: 0 }),
    hitTest: (_point: { x: number; y: number }): ScoreCanvasHit | null => null,
    tickAt: (_point: { x: number; y: number }): number | null => null,
    dispose: () => {},
  };

  return { canvas, picture, cursor, scroll };
}
