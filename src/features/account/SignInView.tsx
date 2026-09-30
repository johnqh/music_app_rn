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
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/config/ThemeContext';

export type SignInViewProps = {
  /** Signing in, or creating an account — for a title that follows along. */
  onModeChange?: (mode: LoginViewMode) => void;
  /** Somebody signed in, or made their account. */
  onSuccess?: () => void;
};

export function SignInView({ onModeChange, onSuccess }: SignInViewProps) {
  const { t } = useTranslation();
  const {
    signIn,
    signUp,
    signInGoogle,
    googleAvailable,
    signInApple,
    appleAvailable,
  } = useAuth();
  const { resolved } = useTheme();
  return (
    <LoginView
      onEmailSignIn={signIn}
      onEmailSignUp={signUp}
      {...(googleAvailable ? { onGoogleSignIn: signInGoogle } : {})}
      {...(appleAvailable ? { onAppleSignIn: signInApple } : {})}
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
