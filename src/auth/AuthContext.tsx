/**
 * AuthContext — Firebase Authentication, on every platform.
 *
 * The same code as sudojo_app_rn's and svgr_app_rn's `AuthContext`: Firebase's
 * **JS SDK** everywhere, through `@sudobility/auth_lib`'s `useFirebaseAuthJs`
 * with `platform` set. The China proxy is a `fetch` wrapper, which the JS
 * SDK's requests pass through on a phone exactly as in a browser and the
 * native SDK's never do. Native Firebase is still here for what has no JS
 * equivalent in React Native — analytics, crashlytics, messaging, remote
 * config, performance (`src/di/initializeServices`) — as a separate Firebase
 * app that auth never touches.
 *
 * How each platform signs in is auth_lib's (`@sudobility/auth_lib/signin`):
 * Google's SDK on iOS and Android, the system browser on macOS and Windows,
 * Apple's sheet on iOS and Apple's web flow on Android — each borrowed for an
 * ID token that goes to the JS SDK's `signInWithCredential`. This file
 * supplies what is this app's: the configuration and the native modules,
 * `require`d inside a getter so a desktop build loads without either half.
 * Configuration: iOS and Android from their Google services files, through
 * native Firebase's options (Android's Google web client from
 * `google-services.json`); macOS and Windows, which Firebase serves as web
 * apps, from `.env` (`src/config/env.ts`).
 *
 * **Signing in is optional.** A local document needs no account, so there is
 * no anonymous sign-in: a signed-out build opens into the editor.
 */

import {
  createFirebaseAuthContext,
  loadFirebaseJsAuth,
  useFirebaseAuthJs,
  type FirebaseAuthConfig,
} from '@sudobility/auth_lib/auth-js';
import {
  appleSignInAvailable,
  googleSignInAvailable,
  type SignInPlatform,
} from '@sudobility/auth_lib/signin';
import { WebAuth } from '@sudobility/building_blocks_rn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { FIREBASE_CONFIG, SIGN_IN_CONFIG } from '@/config/env';
import { trackUserId } from '@/analytics';
import { loadAppleAuthModule } from './apple-auth-module';

export type { AuthUser, AuthContextValue } from '@sudobility/auth_lib/auth-js';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const platform = Platform.OS as SignInPlatform;
const mobile = platform === 'ios' || platform === 'android';

/**
 * The whole auth configuration — one object, so the context and
 * `readIdToken` below initialise the same Firebase Auth.
 */
const AUTH_CONFIG: FirebaseAuthConfig = {
  platform,
  // iOS and Android: what native Firebase read from the services files.
  serviceFiles: {
    nativeFirebaseOptions: () =>
      (
        require('@react-native-firebase/app') as typeof import('@react-native-firebase/app')
      ).getApp().options,
    googleServicesJson: require('../../android/app/google-services.json'),
  },
  // macOS and Windows: this desktop's Firebase web app.
  firebaseConfig: FIREBASE_CONFIG,
  asyncStorage: AsyncStorage,
  signIn: SIGN_IN_CONFIG,
  webAuth: WebAuth,
  getGoogleSignin: () =>
    (
      require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin')
    ).GoogleSignin,
  getAppleAuth: () => loadAppleAuthModule().appleAuth,
  getAppleAuthAndroid: () => loadAppleAuthModule().appleAuthAndroid,
  providers: {
    // iOS and Android take their Google client from the services files.
    google: mobile || googleSignInAvailable(platform, SIGN_IN_CONFIG),
    apple: appleSignInAvailable(platform, SIGN_IN_CONFIG),
    anonymous: false,
    emailPassword: true,
  },
  autoSignInAnonymously: false,
  // Native analytics (iOS/Android) learns who this is. Not cleared on
  // sign-out: Firebase Analytics handles that itself.
  onUserChanged: user => {
    if (user) trackUserId(user.uid);
  },
  onIdentityChange: (prev, next) => {
    if (prev !== null && prev !== next) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  },
};

export const { AuthProvider, useAuth } = createFirebaseAuthContext(
  useFirebaseAuthJs,
  AUTH_CONFIG,
);

/*
  What this app needs beyond the shared context — kept beside it rather than
  inside it, so the context above stays the family's.
*/

/**
 * Whether this build can sign in at all. iOS and Android always can — their
 * services files ship with the app; a desktop needs its web app configured.
 */
const firebaseConfigured = mobile || FIREBASE_CONFIG.apiKey !== '';

/** Whether to offer Google sign-in here. Same rule the context enables it by. */
export const googleAvailable =
  firebaseConfigured && Boolean(AUTH_CONFIG.providers?.google);

/** Whether to offer Sign in with Apple here. */
export const appleAvailable =
  firebaseConfigured && Boolean(AUTH_CONFIG.providers?.apple);

/**
 * The current ID token, or null when signed out — without a React tree.
 *
 * Module-level so the document stores' `StoreContext` can hold it: the scratch
 * document is built before any provider mounts, and a store captures its
 * context for life, so a getter closed over a provider's state would be the
 * one from whenever that store happened to be made. It reads the same Firebase
 * Auth the context uses — `loadFirebaseJsAuth` initialises it once, whichever
 * asks first.
 *
 * `currentUser` is null between initialisation and the first state report, so
 * a token read straight away answers null for a signed-in user — the request
 * then omits the header and the server says 401 "Authorization header
 * required", which is the tell. Hence `authStateReady` first.
 */
export async function readIdToken(): Promise<string | null> {
  const auth = await loadFirebaseJsAuth(AUTH_CONFIG);
  if (!auth) return null;
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
