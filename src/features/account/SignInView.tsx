/**
 * Sign in or create an account, to be placed in another view.
 *
 * The form is `@sudobility/components-rn`'s `LoginView`, which is no wider
 * than 360, centres itself and paints nothing behind itself — so it sits in a
 * pane, a settings section or a screen alike. What this adds is what only the
 * app knows: who signs somebody in (`useAuth`), which providers this platform
 * can do, the words, and which way the theme resolved.
 *
 * Google matters more than a convenience: an account made on the web with
 * Google has no password, so without it the person who made it could not
 * sign in here at all. Each platform does it its own way, and one that
 * cannot shows no button — see `googleSignInAvailable`. Apple is offered
 * wherever Google is on an Apple device, which is Apple's condition for
 * offering the other at all, and the view puts it first there.
 */
import { useTranslation } from 'react-i18next';
import { LoginView } from '@sudobility/components-rn';
import type { LoginViewMode } from '@sudobility/components-rn';
import { appleAvailable, googleAvailable, useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/config/ThemeContext';
import { trackButtonClick, trackError, trackEvent } from '@/analytics';

/**
 * `action`, reported to analytics under sudojo_app_rn's event names: the
 * press (`<button>`), then `login_success`, or the error — rethrown, since
 * showing it is `LoginView`'s.
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

export type SignInViewProps = {
  /** Signing in, or creating an account — for a title that follows along. */
  onModeChange?: (mode: LoginViewMode) => void;
  /** Somebody signed in, or made their account. */
  onSuccess?: () => void;
};

export function SignInView({ onModeChange, onSuccess }: SignInViewProps) {
  const { t } = useTranslation();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
  } = useAuth();
  const { resolved } = useTheme();
  return (
    <LoginView
      onEmailSignIn={tracked('email_sign_in', signInWithEmail)}
      onEmailSignUp={tracked('email_sign_up', signUpWithEmail)}
      {...(googleAvailable
        ? { onGoogleSignIn: tracked('google_sign_in', signInWithGoogle) }
        : {})}
      {...(appleAvailable
        ? { onAppleSignIn: tracked('apple_sign_in', signInWithApple) }
        : {})}
      {...(onModeChange ? { onModeChange } : {})}
      {...(onSuccess ? { onSuccess } : {})}
      // Black or white, against what it sits on — the mark's own rule, and
      // the one colour here the theme does decide.
      appleLogoTone={resolved === 'dark' ? 'white' : 'black'}
      text={{
        signIn: t('nav.signIn'),
        signUp: t('auth.createAccount'),
        emailLabel: t('auth.email'),
        passwordLabel: t('auth.passwordLabel'),
        orContinueWith: t('auth.orContinueWith'),
        signInWithGoogle: t('auth.signInWithGoogle'),
        signInWithApple: t('auth.signInWithApple'),
        alreadyHaveAccount: t('auth.haveAccount'),
        dontHaveAccount: t('auth.needAccount'),
        missingFields: t('auth.missingFields'),
      }}
    />
  );
}
