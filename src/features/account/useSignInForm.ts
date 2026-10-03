/**
 * What the shared sign-in form needs from this app: who signs somebody in
 * (`useAuth`), which providers this platform can do, the words, and which way
 * the theme resolved.
 *
 * The form itself is the family's, in two shells that mirror the web's:
 * `SignInPage` (building_blocks_rn's `LoginPage`) where somebody goes in order
 * to sign in, and `SignInModal` (components-rn's `LoginModal`) where signing in
 * interrupts something else. Both read this hook, so the two never offer
 * different providers or say different words.
 *
 * Google matters more than a convenience: an account made on the web with
 * Google has no password, so without it the person who made it could not
 * sign in here at all. Each platform does it its own way, and one that
 * cannot shows no button — see `googleSignInAvailable`. Apple is offered
 * wherever Google is on an Apple device, which is Apple's condition for
 * offering the other at all, and the view puts it first there.
 */
import { useTranslation } from 'react-i18next';
import type { AppleLogoTone, LoginViewText } from '@sudobility/components-rn';
import { appleAvailable, googleAvailable, useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/config/ThemeContext';
import { trackButtonClick, trackError, trackEvent } from '@/analytics';

/**
 * `action`, reported to analytics under sudojo_app_rn's event names: the
 * press (`<button>`), then `login_success`, or the error — rethrown, since
 * showing it is the form's.
 */
function tracked<A extends unknown[]>(
  button: string,
  action: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    trackButtonClick(button);
    try {
      await action(...args);
      trackEvent('login_success', { method: button });
    } catch (error) {
      trackError(
        error instanceof Error ? error.message : String(error),
        `${button}_failed`,
      );
      throw error;
    }
  };
}

export type SignInForm = {
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onAppleSignIn: () => Promise<void>;
  /** Whether this build can sign in with Google — `googleAvailable`. */
  showGoogleSignIn: boolean;
  /** Whether this build can sign in with Apple — `appleAvailable`. */
  showAppleSignIn: boolean;
  appleLogoTone: AppleLogoTone;
  /** Every string the form itself shows. */
  text: LoginViewText;
};

export function useSignInForm(): SignInForm {
  const { t } = useTranslation();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    sendPasswordResetEmail,
  } = useAuth();
  const { resolved } = useTheme();
  return {
    onEmailSignIn: tracked('email_sign_in', signInWithEmail),
    onEmailSignUp: tracked('email_sign_up', signUpWithEmail),
    // Sending the link is not a sign-in, so it is not reported as one.
    onPasswordReset: async email => {
      trackButtonClick('password_reset');
      await sendPasswordResetEmail(email);
    },
    onGoogleSignIn: tracked('google_sign_in', signInWithGoogle),
    onAppleSignIn: tracked('apple_sign_in', signInWithApple),
    showGoogleSignIn: googleAvailable,
    showAppleSignIn: appleAvailable,
    // Black or white, against what it sits on — the mark's own rule, and
    // the one colour here the theme does decide.
    appleLogoTone: resolved === 'dark' ? 'white' : 'black',
    text: {
      signIn: t('nav.signIn'),
      signUp: t('auth.signUp'),
      emailLabel: t('auth.email'),
      emailPlaceholder: '',
      passwordLabel: t('auth.passwordLabel'),
      passwordPlaceholder: '',
      orContinueWith: t('auth.orContinueWith'),
      signInWithGoogle: t('auth.signInWithGoogle'),
      signInWithApple: t('auth.signInWithApple'),
      // The question alone: the link after it is `signIn` / `signUp`.
      alreadyHaveAccount: t('auth.alreadyHaveAccount'),
      dontHaveAccount: t('auth.dontHaveAccount'),
      missingFields: t('auth.missingFields'),
      genericError: t('auth.genericError'),
      forgotPassword: t('auth.forgotPassword'),
      resetPasswordHint: t('auth.resetPasswordHint'),
      sendResetLink: t('auth.sendResetLink'),
      resetEmailSent: t('auth.resetEmailSent'),
      backToSignIn: t('auth.backToSignIn'),
      missingEmail: t('auth.missingEmail'),
    },
  };
}
