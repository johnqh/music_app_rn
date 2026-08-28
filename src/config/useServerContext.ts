/**
 * What `music_client`'s hooks need, or null when there is no server.
 *
 * Null rather than a context with an empty token: the hooks would then fire
 * requests that are guaranteed to fail, and every screen would have to
 * distinguish "not configured" from "failed" itself.
 *
 * The token is resolved rather than captured — Firebase's `currentUser` is null
 * between start-up and the first auth-state report, so a token read too early
 * answers null for a signed-in user.
 */
import { useEffect, useMemo, useState } from 'react';
import type { MusicHookContext } from '@sudobility/music_client';
import { getMusicClient, getNetworkClient } from '@/config/server';
import { CONSTANTS } from '@/config/constants';
import { useAuth } from '@/auth/AuthContext';

export function useServerContext(): MusicHookContext | null {
  const { user, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getToken().then(next => {
      if (!cancelled) setToken(next);
    });
    return () => {
      cancelled = true;
    };
    // Re-read when the signed-in user changes: a token belongs to an account.
  }, [getToken, user?.uid]);

  return useMemo(() => {
    if (!getMusicClient()) return null;
    return {
      networkClient: getNetworkClient(),
      baseUrl: CONSTANTS.API_URL,
      token,
    };
  }, [token]);
}
