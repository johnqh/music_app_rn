/**
 * Sign in or create an account.
 *
 * Email and password only — the web app offers the same two fields through
 * `@sudobility/auth-components`; there is no RN port of that package, so this
 * is the same flow built from primitives rather than a different flow.
 */
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  MIN_TOUCH_TARGET,
  Text,
} from '@sudobility/components-rn';
import { useAuth } from '@/auth/AuthContext';
import { ScreenScaffold } from './ScreenScaffold';

export function SignInScreen() {
  const { t } = useTranslation();
  const { signIn, signUp, user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (creating) await signUp(email, password);
      else await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [creating, email, password, signIn, signUp]);

  if (user) {
    return (
      <ScreenScaffold title={t('auth.signedIn')}>
        <Text className="text-foreground">{user.email ?? user.uid}</Text>
        <Button onPress={() => void signOut()}>{t('auth.signOut')}</Button>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title={creating ? t('auth.createAccount') : t('nav.signIn')}
    >
      <View className="gap-3">
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel={t('auth.email')}
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          secureTextEntry
          accessibilityLabel={t('auth.password')}
        />
        {error ? (
          <Text className="text-destructive text-base">{error}</Text>
        ) : null}
        <Button onPress={() => void submit()} disabled={busy}>
          {creating ? t('auth.createAccount') : t('nav.signIn')}
        </Button>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(value => !value)}
          style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' }}
        >
          <Text className="text-primary text-center text-base">
            {creating ? t('auth.haveAccount') : t('auth.needAccount')}
          </Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}
