/**
 * What `music_client`'s hooks need, or null when there is no server.
 *
 * Null rather than a context with no token: the hooks would then fire requests
 * that are guaranteed to fail, and every screen would have to distinguish "not
 * configured" from "failed" itself.
 *
 * **The token is a getter, awaited per request, never a value.** This used to
 * resolve the token into React state and hand the hooks a string, which had
 * two failures built in: a token captured when the context was built starts
 * failing an hour into a session, and the first render after start-up handed
 * over `null` for a signed-in user (Firebase's `currentUser` is null until the
 * first auth-state report) so every query sat disabled until a re-render
 * happened to fix it. `getToken` is the auth layer's own, which waits for the
 * session to be restored; `userId` is what lets a query know synchronously
 * whether it may run at all, and keys per-account answers such as `useSiteAdmin`
 * so one account's answer is never shown to the next.
 */
import { useMemo } from 'react';
import type { MusicHookContext } from '@sudobility/music_client';
import { getMusicClient, getNetworkClient } from '@/config/server';
import { CONSTANTS } from '@/config/constants';
import { useAuth } from '@/auth/AuthContext';

export function useServerContext(): MusicHookContext | null {
  const { user, getToken } = useAuth();
  const userId = user?.uid ?? null;

  return useMemo(() => {
    if (!getMusicClient()) return null;
    return {
      networkClient: getNetworkClient(),
      baseUrl: CONSTANTS.API_URL,
      getToken,
      userId,
    };
  }, [getToken, userId]);
}
