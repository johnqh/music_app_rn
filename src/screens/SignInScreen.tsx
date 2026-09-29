/**
 * Sign in or create an account.
 *
 * Email and password, and Google where the platform can do it — the web
 * app's own choices, offered through `@sudobility/auth-components` there.
 * There is no RN port of that package, so this is the same flow built from
 * primitives rather than a different flow.
 *
 * Google is a desktop offer for now (see `googleSignInAvailable`). It matters
 * more than a convenience: an account made on the web with Google has no
 * password, so without this the person who made it could not sign in here at
 * all.
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
import { GoogleLogo } from '@/components/icons/BrandLogos';
import { ScreenScaffold } from './ScreenScaffold';

export function SignInScreen() {
  const { t } = useTranslation();
  const { signIn, signUp, signInGoogle, googleAvailable, user, signOut } =
    useAuth();
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

  const withGoogle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signInGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [signInGoogle]);

  const toggleCreating = () => setCreating(value => !value);

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
      title={creating ? t('auth.createAccount') : t('nav.signIn')}
    >
      <View className="gap-3">
        {/*
          `Input`'s own default carries no visible border — measured against
          the web app's, which does (a 1px border in its own `Input`) — so
          without one here, a text field and the plain background behind it
          are the same colour and nothing says "type here". `border-border`
          is the same token every bordered card in this app already uses.
        */}
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel={t('auth.email')}
          className="border-border rounded-md border"
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordLabel')}
          secureTextEntry
          accessibilityLabel={t('auth.passwordLabel')}
          className="border-border rounded-md border"
        />
        {error ? (
          <Text className="text-destructive text-base">{error}</Text>
        ) : null}
        <Button onPress={() => void submit()} disabled={busy}>
          {creating ? t('auth.createAccount') : t('nav.signIn')}
        </Button>
        {googleAvailable ? (
          <Button
            variant="outline"
            accessibilityLabel={t('auth.signInWithGoogle')}
            onPress={() => void withGoogle()}
            disabled={busy}
          >
            {/*
              The mark beside the words, as Google's own guidelines ask and
              as every other app in the family draws it. Children that are
              not a plain string are laid out by the caller, and the button
              no longer has text of its own to read out — hence the label.
            */}
            <View className="flex-row items-center justify-center gap-2">
              <GoogleLogo />
              <Text className="text-foreground text-base font-medium">
                {t('auth.signInWithGoogle')}
              </Text>
            </View>
          </Button>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={toggleCreating}
          // macOS has no synthesized-touch fallback for an assistive press, so
          // a VoiceOver activation reaches a Pressable only through
          // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
          onAccessibilityTap={toggleCreating}
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
