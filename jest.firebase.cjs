/**
 * The Firebase JS SDK, stubbed.
 *
 * `useSignInForm` reads `isSignInCancelled` from `@sudobility/auth_lib/signin`,
 * and that subpath also carries `createFirebaseJsAuth`, which imports
 * `firebase/app` and `firebase/auth` at the top. Firebase ships ESM (`.mjs`
 * included) that jest's CJS pipeline cannot load, and no component test signs
 * anybody in — every one mocks `@/auth/AuthContext`. So the SDK is inert here
 * and the sign-in form renders; the app loads the real one.
 */
const unavailable = () => {
  throw new Error('Firebase is not available under jest');
};

module.exports = {
  getApps: () => [],
  initializeApp: unavailable,
  getAuth: unavailable,
  initializeAuth: unavailable,
};
