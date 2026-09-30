/**
 * The two clients the account's sections talk to the server through.
 *
 * Both are given a base URL and a network client and nothing else, so neither
 * needs a purchase SDK, a native module or an adapter — the reason the
 * balance could be shown here while the store could not. The bearer is
 * attached per request and read fresh each time: a token held from when the
 * client was made starts failing an hour into a session.
 *
 * Null where this build has no server, which every section reads as
 * "unavailable" rather than as a failure.
 */
import { useMemo } from 'react';
import { ConsumablesApiClient } from '@sudobility/consumables_client';
import { EntityClient } from '@sudobility/entity_client';
import type { NetworkClient } from '@sudobility/types';
import { CONSTANTS } from '@/config/constants';
import { getNetworkClient } from '@/config/server';

/**
 * The address as the server knows it: with no slash after the path.
 *
 * `ConsumablesApiClient` builds its addresses with `new URL(…).toString()`,
 * and React Native's `URL` answers `…/consumables/balance/` where a browser's
 * answers `…/consumables/balance`. The server routes the second and not the
 * first, so every credits request this app made came back 404 — measured in
 * the API's log: 44 of 44 — and the balance read "—" on a screen that
 * existed to show it. The slash is taken off where the request leaves, so
 * that whatever builds an address is put right in one place.
 */
export function withoutTrailingSlash(url: string): string {
  const query = url.search(/[?#]/);
  const path = query === -1 ? url : url.slice(0, query);
  const rest = query === -1 ? '' : url.slice(query);
  // Not the slash that *is* the path, as in `https://host/`.
  const bare = /^[a-z][a-z0-9+.-]*:\/\/[^/]*\/$/i.test(path);
  return bare || !path.endsWith('/') ? url : `${path.slice(0, -1)}${rest}`;
}

/** Attaches the bearer per request, reading it fresh each time. */
export function authenticated(
  inner: NetworkClient,
  getToken: () => Promise<string | null>,
): NetworkClient {
  const withAuth = async (
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const token = await getToken();
    if (!token) return options ?? {};
    const headers = {
      ...((options?.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${token}`,
    };
    return { ...(options ?? {}), headers };
  };
  return {
    get: async (url: string, options?: never) =>
      inner.get(withoutTrailingSlash(url), (await withAuth(options)) as never),
    post: async (url: string, body?: unknown, options?: never) =>
      inner.post(
        withoutTrailingSlash(url),
        body,
        (await withAuth(options)) as never,
      ),
    put: async (url: string, body?: unknown, options?: never) =>
      inner.put(
        withoutTrailingSlash(url),
        body,
        (await withAuth(options)) as never,
      ),
    delete: async (url: string, options?: never) =>
      inner.delete(
        withoutTrailingSlash(url),
        (await withAuth(options)) as never,
      ),
  } as NetworkClient;
}

export function useConsumablesClient(
  getToken: () => Promise<string | null>,
): ConsumablesApiClient | null {
  return useMemo(
    () =>
      CONSTANTS.API_URL
        ? new ConsumablesApiClient({
            baseUrl: CONSTANTS.API_URL,
            networkClient: authenticated(getNetworkClient(), getToken),
          })
        : null,
    [getToken],
  );
}

export function useEntityClient(
  getToken: () => Promise<string | null>,
): EntityClient | null {
  return useMemo(
    () =>
      CONSTANTS.API_URL
        ? new EntityClient({
            baseUrl: `${CONSTANTS.API_URL}/api/v1`,
            networkClient: authenticated(getNetworkClient(), getToken),
          })
        : null,
    [getToken],
  );
}
