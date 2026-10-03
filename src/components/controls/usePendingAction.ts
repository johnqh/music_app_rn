/**
 * The waiting state of a call to action.
 *
 * The rule is the user's: **a control that starts work somebody has to wait
 * for turns into a spinner while they wait, and cannot be pressed again
 * meanwhile.** `run` is that rule in one place — it marks the action pending
 * before the work starts, clears it in `finally`, and refuses a second call
 * while the first is in flight. The refusal is a ref, not the state: two taps
 * inside one frame both see the state from before the first, and only a ref
 * is already set when the second arrives.
 *
 * `key` says *which* of several controls is waiting (one Export button among
 * five, one tile's Duplicate among a grid), so only that one spins; every one
 * of them is refused while any is pending.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type PendingAction<K> = {
  /** Something is in flight. */
  pending: boolean;
  /** The key the work in flight was started with, or null. */
  pendingKey: K | null;
  /**
   * Starts `work` unless something is already in flight. Answers what the
   * work answered, or `undefined` when it was refused. A rejection propagates.
   */
  run: <T>(work: () => Promise<T>, key?: K) => Promise<T | undefined>;
};

export function usePendingAction<K = true>(): PendingAction<K> {
  const [pendingKey, setPendingKey] = useState<K | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async <T>(work: () => Promise<T>, key?: K): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPendingKey((key ?? true) as K);
      try {
        return await work();
      } finally {
        inFlight.current = false;
        if (mounted.current) setPendingKey(null);
      }
    },
    [],
  );

  return { pending: pendingKey !== null, pendingKey, run };
}
