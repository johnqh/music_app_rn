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
import { useSiteAdmin } from '@sudobility/music_client';
import { getMusicClient, getNetworkClient } from '@/config/server';
import type { ReactNode } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import * as firebaseAuthModule from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { Auth, OAuthCredential, Persistence, User } from 'firebase/auth';
import { Platform } from 'react-native';
import {
  buildAppleCredential,
  buildGoogleCredential,
  signInWithGoogleOAuthDesktop,
} from '@sudobility/auth_lib/oauth';
import { WebAuth } from '@sudobility/building_blocks_rn';
import { CONSTANTS } from '@/config/constants';

/**
 * Whether Google sign-in can be offered here, and how it is done.
 *
 * On the desktop it goes through the system browser — an
 * `ASWebAuthenticationSession` on macOS — by way of building_blocks_rn's
 * `WebAuth` and auth_lib's PKCE flow, the same pair every desktop app in the
 * family uses. `WebAuth` has no iOS or Android half, so a phone or tablet
 * asks Google's own SDK (`@react-native-google-signin/google-signin`, the
 * module `sudojo_app_rn` uses) for an ID token instead.
 *
 * Either way what comes back is a credential for **this** file's Firebase —
 * the JS SDK. `sudojo_app_rn` runs `@react-native-firebase` on mobile; the
 * native modules are the same two, but only for the token: taking its auth
 * stack as well would be a second Firebase with a second session.
 *
 * And it needs a client to sign in *with*: an unconfigured build shows no
 * button, exactly as one with no Firebase key shows no server. iOS signs in
 * with the iOS client, whose reversed form is also a URL scheme in
 * `Info.plist`; Android is given the web client, which is what makes Google
 * return an ID token there at all.
 */
// Asked each time rather than held: it costs nothing, and a test can then
// stand on any platform without reloading the module.
function isDesktop(): boolean {
  return Platform.OS === 'macos' || Platform.OS === 'windows';
}
export function googleSignInAvailable(): boolean {
  if (CONSTANTS.FIREBASE_API_KEY === '') return false;
  if (isDesktop()) {
    return (
      CONSTANTS.GOOGLE_OAUTH_CLIENT_ID !== '' &&
      CONSTANTS.GOOGLE_OAUTH_REVERSED_CLIENT_ID !== ''
    );
  }
  if (Platform.OS === 'ios') return CONSTANTS.GOOGLE_OAUTH_CLIENT_ID !== '';
  if (Platform.OS === 'android') return CONSTANTS.GOOGLE_WEB_CLIENT_ID !== '';
  return false;
}

/**
 * Whether Sign in with Apple can be offered here.
 *
 * iOS has it built in. Android has no such thing, so there it is Apple's web
 * flow and needs a Services ID and a redirect to name — without both, no
 * button. The desktops do not offer it: macOS would need the entitlement on
 * a build of its own, and Windows has no implementation.
 */
export function appleSignInAvailable(): boolean {
  if (CONSTANTS.FIREBASE_API_KEY === '') return false;
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') {
    return (
      CONSTANTS.APPLE_SERVICE_ID !== '' && CONSTANTS.APPLE_REDIRECT_URI !== ''
    );
  }
  return false;
}

/** Google's credential, or null when the reader closed the sheet. */
async function googleCredential(): Promise<OAuthCredential | null> {
  if (isDesktop()) {
    return signInWithGoogleOAuthDesktop(
      {
        clientId: CONSTANTS.GOOGLE_OAUTH_CLIENT_ID,
        reversedClientId: CONSTANTS.GOOGLE_OAUTH_REVERSED_CLIENT_ID,
      },
      WebAuth,
    );
  }
  /*
    Asked for when needed, never at the top of the file: the module has no
    macOS or Windows half, and a desktop build must be able to load this
    file. `require`, not `import()` — Metro answers a dynamic import by
    fetching a second bundle when the button is pressed, and here that fetch
    fails with "Could not load bundle" and nothing signs in.
  */
  const { GoogleSignin } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    ...(CONSTANTS.GOOGLE_OAUTH_CLIENT_ID
      ? { iosClientId: CONSTANTS.GOOGLE_OAUTH_CLIENT_ID }
      : {}),
    ...(CONSTANTS.GOOGLE_WEB_CLIENT_ID
      ? { webClientId: CONSTANTS.GOOGLE_WEB_CLIENT_ID }
      : {}),
  });
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('No ID token from Google');
  return buildGoogleCredential(idToken);
}

/** Apple's credential, or null when the reader closed the sheet. */
async function appleCredential(): Promise<OAuthCredential | null> {
  // `require` for the reason `googleCredential` gives.
  const { appleAuth, appleAuthAndroid } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@invertase/react-native-apple-authentication') as typeof import('@invertase/react-native-apple-authentication');
  if (Platform.OS === 'android') {
    if (!appleAuthAndroid.isSupported) {
      throw new Error('Apple sign-in is not supported on this device');
    }
    appleAuthAndroid.configure({
      clientId: CONSTANTS.APPLE_SERVICE_ID,
      redirectUri: CONSTANTS.APPLE_REDIRECT_URI,
      responseType: appleAuthAndroid.ResponseType.ALL,
      scope: appleAuthAndroid.Scope.ALL,
    });
    try {
      const response = await appleAuthAndroid.signIn();
      if (!response.id_token) throw new Error('No identity token from Apple');
      return buildAppleCredential({
        idToken: response.id_token,
        ...(response.nonce ? { rawNonce: response.nonce } : {}),
      });
    } catch (error) {
      if (errorCode(error) === appleAuthAndroid.Error.SIGNIN_CANCELLED) {
        return null;
      }
      throw error;
    }
  }
  try {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    if (!response.identityToken) {
      throw new Error('No identity token from Apple');
    }
    return buildAppleCredential({
      idToken: response.identityToken,
      ...(response.nonce ? { rawNonce: response.nonce } : {}),
    });
  } catch (error) {
    // Closing the sheet is an answer, not a failure to report.
    if (errorCode(error) === appleAuth.Error.CANCELED) return null;
    throw error;
  }
}

/** What either Apple module puts on a rejection, where it puts anything. */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown; message?: unknown }).code;
  if (typeof code === 'string') return code;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

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
  /**
   * Signs in with Google, where `googleAvailable` says it can.
   *
   * Resolves either way: closing the browser sheet is an ordinary outcome,
   * not a failure to report, and the auth state simply does not change.
   */
  signInGoogle: () => Promise<void>;
  /** Whether to offer it. See `googleSignInAvailable`. */
  googleAvailable: boolean;
  /** Signs in with Apple, where `appleAvailable` says it can. */
  signInApple: () => Promise<void>;
  /** Whether to offer it. See `appleSignInAvailable`. */
  appleAvailable: boolean;
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

/**
 * Made once. `initializeAuth` may be called a single time per app, and
 * `readIdToken` asks for this on every request.
 */
let cachedAuth: Auth | null = null;

function firebaseAuth(): Auth | null {
  if (!CONSTANTS.FIREBASE_API_KEY) return null;
  if (cachedAuth) return cachedAuth;
  const existing = getApps()[0];
  if (existing) {
    cachedAuth = getAuth(existing);
    return cachedAuth;
  }
  const app = initializeApp({
    apiKey: CONSTANTS.FIREBASE_API_KEY,
    authDomain: CONSTANTS.FIREBASE_AUTH_DOMAIN,
    projectId: CONSTANTS.FIREBASE_PROJECT_ID,
  });
  /*
    Kept on the device, so signing in is done once rather than at every
    launch. Left to `getAuth`, the JS SDK holds a session in memory under
    React Native — there is no browser storage for it to fall back on — and
    the account is gone the moment the app quits.

    `getReactNativePersistence` exists only in the SDK's React Native build,
    which Metro resolves and a test runner does not, and its types do not
    declare it. Read off the module so its absence is a fallback rather than
    a crash at import.
  */
  const persistenceFor = (
    firebaseAuthModule as unknown as {
      getReactNativePersistence?: (storage: unknown) => Persistence;
    }
  ).getReactNativePersistence;
  cachedAuth = persistenceFor
    ? initializeAuth(app, { persistence: persistenceFor(AsyncStorage) })
    : getAuth(app);
  return cachedAuth;
}

/**
 * The current ID token, or null when signed out — without a React tree.
 *
 * Module-level so the document stores' `StoreContext` can hold it: the scratch
 * document is built before any provider mounts, and a store captures its
 * context for life, so a getter closed over a provider's state would be the
 * one from whenever that store happened to be made. This reads Firebase's own
 * singleton on every call instead.
 *
 * `currentUser` is null between `getAuth()` and the first state report, so a
 * token read straight away answers null for a signed-in user — the request
 * then omits the header entirely and the server says 401 with "Authorization
 * header required", which is the tell. Hence `authStateReady` first.
 */
export async function readIdToken(): Promise<string | null> {
  const auth = firebaseAuth();
  if (!auth) return null;
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useMemo(firebaseAuth, []);
  /*
    Whether this account is a site administrator, asked the way the web asks
    it: music_client's `useSiteAdmin`, keyed by the account and closed by
    default. It was a `GET /me` chained onto the auth-state callback here, with
    its own state and its own catch — the same question as the web's, answered
    by a second copy of the code.
  */
  const siteAdmin = useSiteAdmin(
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
      signInGoogle: async () => {
        if (!auth) throw new Error('Sign-in is not configured in this build.');
        const credential = await googleCredential();
        // Null is the reader closing the sheet.
        if (credential) await signInWithCredential(auth, credential);
      },
      googleAvailable: googleSignInAvailable(),
      signInApple: async () => {
        if (!auth) throw new Error('Sign-in is not configured in this build.');
        const credential = await appleCredential();
        if (credential) await signInWithCredential(auth, credential);
      },
      appleAvailable: appleSignInAvailable(),
      signOut: async () => {
        if (auth) await firebaseSignOut(auth);
      },
      getToken: readIdToken,
    }),
    // `siteAdmin` arrives after `user`, from its own query — leaving it out of
    // the deps kept an administrator's context reading `false` until something
    // else changed, so the credit gate refused them free work.
    [auth, user, loading, siteAdmin],
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
      signInGoogle: async () => undefined,
      googleAvailable: false,
      signInApple: async () => undefined,
      appleAvailable: false,
      signOut: async () => undefined,
      getToken: async () => null,
    }
  );
}
