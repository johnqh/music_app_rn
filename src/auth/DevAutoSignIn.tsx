/**
 * Signs a debug build in to the test account `.env` names
 * (`DEV_SIGNIN_EMAIL`/`DEV_SIGNIN_PASSWORD`), once per launch.
 *
 * For what cannot be done signed out and cannot be signed in to by hand: the
 * store screenshots, which run unattended across a row of simulators and
 * show Generate, which needs an account. Through the email provider the
 * sign-in screen already offers, so the session is an ordinary one — tokens,
 * the server, credits and all — rather than a pretend user the server would
 * refuse.
 *
 * Mounted in debug builds only (`App.tsx`), and `DEV_SIGN_IN` is null in a
 * release build anyway. Once per launch, and only when nobody is signed in:
 * signing out stays signed out until the app is restarted, and an account
 * somebody chose is never replaced.
 */
import { useEffect } from 'react';
import { DEV_SIGN_IN } from '@/config/env';
import { useAuth } from './AuthContext';

let attempted = false;

export function DevAutoSignIn() {
  const { isReady, user, signInWithEmail } = useAuth();

  useEffect(() => {
    if (!DEV_SIGN_IN || attempted || !isReady || user) return;
    attempted = true;
    signInWithEmail(DEV_SIGN_IN.email, DEV_SIGN_IN.password).catch(
      (error: unknown) =>
        console.warn(
          `Debug sign-in as ${DEV_SIGN_IN?.email} failed:`,
          error instanceof Error ? error.message : error,
        ),
    );
  }, [isReady, user, signInWithEmail]);

  return null;
}
