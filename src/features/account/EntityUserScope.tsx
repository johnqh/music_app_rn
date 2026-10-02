/**
 * Names the signed-in user for every entity_client hook in the app.
 *
 * entity_client caches every workspace, member, invitation and API key under
 * the user it was fetched for, so one account's answers can never be served to
 * the next — the web app once kept the previous account's workspace after a
 * sign-out and registration, sent its id on every request, and was refused on
 * all of them. The web app gets the user from `CurrentEntityProvider`; this app
 * calls the hooks without that provider, so without this scope every query
 * would share one entry for "no user", which is exactly the shared cache that
 * caused it.
 */
import type { ReactNode } from 'react';
import { EntityUserProvider } from '@sudobility/entity_client';
import { useAuth } from '@/auth/AuthContext';

export function EntityUserScope({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <EntityUserProvider userId={user?.uid ?? null}>
      {children}
    </EntityUserProvider>
  );
}
