/**
 * Windows: no Sign in with Apple, and no `require` of its module. Metro
 * resolves every `require` it sees, behind a platform check or not, and the
 * package ships `AppleButton` as `.ios`/`.android`/`.macos` files with no
 * plain fallback — so merely naming it left the Windows bundle unbuildable.
 * Never called: the desktops are offered no Apple button
 * (`appleSignInAvailable`).
 */
type AppleAuthModule =
  typeof import('@invertase/react-native-apple-authentication');

export function loadAppleAuthModule(): AppleAuthModule {
  throw new Error('Sign in with Apple is not available on Windows.');
}
