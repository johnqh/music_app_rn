/**
 * The Sign in with Apple module, `require`d when it is first used (never
 * `import()`ed — see `AuthContext.tsx`). A file of its own so Windows can
 * answer without it: see `apple-auth-module.windows.ts`.
 */
type AppleAuthModule =
  typeof import('@invertase/react-native-apple-authentication');

export function loadAppleAuthModule(): AppleAuthModule {
  return require('@invertase/react-native-apple-authentication') as AppleAuthModule;
}
