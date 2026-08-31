/**
 * Who is signed in, if anyone.
 *
 * Firebase's **JS SDK**, not `@react-native-firebase`. The plan calls for the
 * native SDK on phones and the web SDK on desktop; the web SDK works on every
 * platform this ships to and needs no native module, so it is what the app
 * starts on — and swapping mobile to the native SDK later is a change to this
 * file alone, because nothing above it knows which one is underneath.
 *
 * **Signing in is optional.** A local document needs no account: `StoreContext`
 * takes an optional client, and everything server-backed reports itself
 * unavailable rather than failing. This provider therefore never blocks the
 * tree — it reports `null` and the app opens into the editor.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getMusicClient } from '@/config/server';
import type { ReactNode } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { CONSTANTS } from '@/config/constants';

export type AuthUser = {
  uid: string;
  email: string | null;
};

export type AuthState = {
  user: AuthUser | null;
  /** True until the first auth-state report; nothing should decide before then. */
  loading: boolean;
  /**
   * Whether this account is a site administrator.
   *
   * `music_api` grants one free generation — no quota, no balance check, no
   * charge — so they sit at a balance of zero forever and any courtesy credit
   * gate must stand aside. `false` while the request is in flight and when it
   * fails, which is the closed default: refusing free service is recoverable,
   * granting it wrongly is not.
   */
  siteAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * The current ID token, or null when signed out.
   *
   * Read per call, never captured: a token held from construction starts
   * failing an hour into a session.
   */
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

function firebaseAuth(): Auth | null {
  if (!CONSTANTS.FIREBASE_API_KEY) return null;
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: CONSTANTS.FIREBASE_API_KEY,
      authDomain: CONSTANTS.FIREBASE_AUTH_DOMAIN,
      projectId: CONSTANTS.FIREBASE_PROJECT_ID,
    });
  return getAuth(app);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteAdmin, setSiteAdmin] = useState(false);
  const auth = useMemo(firebaseAuth, []);

  useEffect(() => {
    if (!auth) {
      // No Firebase configured: this build is local-only, which is a supported
      // state rather than an error.
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (next: User | null) => {
      setUser(next ? { uid: next.uid, email: next.email } : null);
      setLoading(false);
      /*
        Whether this account is a site administrator.

        `music_api` grants an administrator free generation — no quota, no
        balance check, no charge — so they sit at a balance of zero forever, and
        a courtesy gate that did not know it would refuse work the server would
        have accepted. One chain with one catch at the end, so a synchronous
        throw is caught as well as a rejected fetch: failing to learn somebody
        is an administrator costs them free service, where an unhandled
        rejection here would break signing in.
      */
      if (!next) {
        setSiteAdmin(false);
        return;
      }
      void next
        .getIdToken()
        .then(async token => {
          const client = getMusicClient();
          if (!client || !token) return;
          const me = await client.getCurrentUser(token);
          setSiteAdmin(me.siteAdmin);
        })
        .catch(() => setSiteAdmin(false));
    });
  }, [auth]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      siteAdmin,
      signIn: async (email, password) => {
        if (!auth) throw new Error('Sign-in is not configured in this build.');
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUp: async (email, password) => {
        if (!auth) throw new Error('Sign-in is not configured in this build.');
        await createUserWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        if (auth) await firebaseSignOut(auth);
      },
      getToken: async () => {
        // `currentUser` is null between `getAuth()` and the first state report,
        // so a token read straight away answers null for a signed-in user — the
        // request then omits the header entirely and the server says 401 with
        // "Authorization header required", which is the tell.
        if (!auth) return null;
        await auth.authStateReady();
        return auth.currentUser ? auth.currentUser.getIdToken() : null;
      },
    }),
    [auth, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Tolerant by design: a component that only wants to know whether to offer a
 * server feature should not need auth wiring in its tests. */
export function useAuth(): AuthState {
  return (
    useContext(AuthContext) ?? {
      user: null,
      loading: false,
      // The closed default, matching what the fetch itself falls back to.
      siteAdmin: false,
      signIn: async () => undefined,
      signUp: async () => undefined,
      signOut: async () => undefined,
      getToken: async () => null,
    }
  );
}
