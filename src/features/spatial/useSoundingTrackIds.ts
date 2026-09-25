/**
 * Which tracks have a note sounding right now, as a set that keeps its
 * identity until the answer changes — the web app's `useSoundingTrackIds`.
 *
 * Read off the player's bus with `useSyncExternalStore` rather than through
 * the document store: sounding notes arrive on every note-on and note-off
 * of every track, far too often to route through zustand (see
 * `music_player`'s `bus.ts`). The identity guard is what keeps the Spatial
 * view from re-rendering on a note that changed nothing it draws — a second
 * note starting on a track already lit.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { SoundingNote } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';

const NO_TRACK_IDS: ReadonlySet<string> = new Set();

function sameIdSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function trackIdsOf(notes: readonly SoundingNote[]): ReadonlySet<string> {
  if (notes.length === 0) return NO_TRACK_IDS;
  return new Set(notes.map(note => note.trackId));
}

export function useSoundingTrackIds(): ReadonlySet<string> {
  const kept = useRef<ReadonlySet<string>>(NO_TRACK_IDS);
  /*
    The latest notes, held here rather than read back off `player.bus` on
    every snapshot: the subscription already delivers them, and a player
    without a bus (a test's recording double) then still works. The bus is
    consulted once, for what was sounding before this subscribed.
  */
  const latest = useRef<readonly SoundingNote[] | null>(null);
  const subscribe = useCallback((onChange: () => void) => {
    return getAppServices().player.onSounding(notes => {
      latest.current = notes;
      onChange();
    });
  }, []);
  const get = useCallback(() => {
    const notes = latest.current ?? getAppServices().player.bus?.sounding ?? [];
    const next = trackIdsOf(notes);
    if (!sameIdSet(next, kept.current)) kept.current = next;
    return kept.current;
  }, []);
  return useSyncExternalStore(subscribe, get, get);
}
