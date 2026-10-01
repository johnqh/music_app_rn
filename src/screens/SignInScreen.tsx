/**
 * Sign in or create an account, as a screen of its own.
 *
 * The form is `SignInView`, the same one the Projects window's Connect pane
 * and Settings' Account section place in themselves; this is the screen the
 * navigator pushes, which adds the scaffold around it and a title that says
 * which of the two is being done.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@sudobility/components-rn';
import type { LoginViewMode } from '@sudobility/components-rn';
import { useAuth } from '@/auth/AuthContext';
import { SignInView } from '@/features/account/SignInView';
import { ScreenScaffold } from './ScreenScaffold';
import { trackScreenView } from '@/analytics';

export function SignInScreen() {
  useEffect(() => {
    trackScreenView('SignInScreen');
  }, []);

  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState<LoginViewMode>('signIn');

  if (user) {
    return (
      <ScreenScaffold title={t('auth.signedIn')}>
        <Text className="text-foreground">{user.email ?? user.uid}</Text>
        <Button onPress={() => void signOut()}>{t('nav.signOut')}</Button>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title={mode === 'signUp' ? t('auth.createAccount') : t('nav.signIn')}
    >
      <SignInView onModeChange={setMode} />
    </ScreenScaffold>
  );
}
