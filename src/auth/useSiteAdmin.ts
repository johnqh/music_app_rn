/**
 * Whether the signed-in account is a site administrator.
 *
 * `music_api` grants an administrator free generation — no quota, no balance
 * check, no charge — so they sit at a balance of zero forever and any
 * courtesy credit gate must stand aside. Asked the way the web asks it:
 * music_client's `useSiteAdmin`, keyed by the account and closed by default
 * (`false` while in flight and on failure — refusing free service is
 * recoverable, granting it wrongly is not). Its own hook rather than a field
 * of `useAuth()`, which is the family's shared context.
 */
import { useMemo } from 'react';
import { useSiteAdmin as useMusicSiteAdmin } from '@sudobility/music_client';
import { getMusicClient, getNetworkClient } from '@/config/server';
import { CONSTANTS } from '@/config/constants';
import { readIdToken, useAuth } from './AuthContext';

export function useSiteAdmin(): boolean {
  const { user } = useAuth();
  return useMusicSiteAdmin(
    useMemo(
      () =>
        getMusicClient()
          ? {
              networkClient: getNetworkClient(),
              baseUrl: CONSTANTS.API_URL,
              getToken: readIdToken,
              userId: user?.uid ?? null,
            }
          : null,
      [user?.uid],
    ),
  );
}
