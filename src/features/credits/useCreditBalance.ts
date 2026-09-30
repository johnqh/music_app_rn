/**
 * How many credits are left.
 *
 * **Only the balance, and deliberately not the store.** Buying credits needs
 * RevenueCat — `@sudobility/consumables_client` peers `react-native-purchases`
 * and the web peers `@revenuecat/purchases-js` — and neither this app nor its
 * build has that wired up. `ConsumablesApiClient` is the half that does not:
 * it takes a base URL and a network client and nothing else, so the balance is
 * readable with no purchase SDK, no native pods and no adapter. Purchasing
 * stays on the web, which the Credits screen says out loud.
 *
 * **The client carries no token; its network client must.** `MusicClient` takes
 * a token per call, so this app's `RNNetworkClient` deliberately adds no auth —
 * but `ConsumablesApiClient` has no token parameter at all and expects an
 * already-authenticated client. So it gets a wrapper that attaches the bearer
 * per request, read **per request and never captured**: a token held from
 * construction starts failing an hour into a session. The web app learned this
 * one as a 401 rendered inside its store page.
 */
import { useCallback, useEffect, useState } from 'react';
import { ConsumablesApiClient } from '@sudobility/consumables_client';
import { CONSTANTS } from '@/config/constants';
import { getNetworkClient } from '@/config/server';
import { authenticated } from '@/features/account/useAccountClients';

export type CreditBalance = {
  /** Null while unknown — which is not the same as zero. */
  balance: number | null;
  loading: boolean;
  refresh: () => void;
};

export function useCreditBalance(
  getToken: () => Promise<string | null>,
  signedIn: boolean,
): CreditBalance {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!CONSTANTS.API_URL || !signedIn) return;
    setLoading(true);
    const client = new ConsumablesApiClient({
      baseUrl: CONSTANTS.API_URL,
      networkClient: authenticated(getNetworkClient(), getToken),
    });
    void client
      .getBalance()
      .then(result => setBalance(result.balance))
      // Left unknown rather than shown as zero: a failed read is not an empty
      // wallet, and reporting one as the other is what would make the app
      // refuse work the server would have accepted.
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [getToken, signedIn]);

  useEffect(refresh, [refresh]);

  return { balance, loading, refresh };
}
