/**
 * Sign in or create an account over whatever screen needed it —
 * components-rn's `LoginModal`, the web `LoginModal`'s counterpart.
 *
 * Use it where signing in interrupts something else: a screen whose job is
 * not signing in (the project list, the credit balance) but which has nothing
 * to show without an account. Signing in closes it, and the screen beneath
 * then shows what it is for — nobody is sent to another route and left to
 * find their way back. Where somebody goes *in order to* sign in, the form is
 * `SignInPage` instead.
 */
import { useTranslation } from 'react-i18next';
import { LoginModal } from '@sudobility/components-rn';
import { useSignInForm } from './useSignInForm';

export type SignInModalProps = {
  visible: boolean;
  /** The close button, the backdrop, Back — and a successful sign-in. */
  onClose: () => void;
  /** Somebody signed in, or made their account; told before `onClose`. */
  onSuccess?: () => void;
};

export function SignInModal({ visible, onClose, onSuccess }: SignInModalProps) {
  const { t } = useTranslation();
  const form = useSignInForm();
  return (
    <LoginModal
      visible={visible}
      onClose={onClose}
      {...(onSuccess ? { onSuccess } : {})}
      onEmailSignIn={form.onEmailSignIn}
      onEmailSignUp={form.onEmailSignUp}
      onPasswordReset={form.onPasswordReset}
      // The modal draws a provider's button whenever its handler is given, so
      // availability is decided here, as `LoginPage`'s `show…` flags do.
      {...(form.showGoogleSignIn
        ? { onGoogleSignIn: form.onGoogleSignIn }
        : {})}
      {...(form.showAppleSignIn ? { onAppleSignIn: form.onAppleSignIn } : {})}
      appleLogoTone={form.appleLogoTone}
      text={form.text}
      modalText={{
        signInTitle: t('nav.signIn'),
        signUpTitle: t('auth.createAccount'),
        resetPasswordTitle: t('auth.resetPassword'),
        close: t('common.close'),
      }}
    />
  );
}
