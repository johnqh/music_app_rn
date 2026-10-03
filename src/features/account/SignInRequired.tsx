/**
 * The signed-out state of a screen that needs an account: what is missing,
 * and the way in — opened over the screen as `SignInModal`, not by sending
 * the reader to a sign-in route. Signing in closes the modal, and the screen
 * that asked re-renders with what it is for, because it reads `useAuth`.
 *
 * Its own module, not `ScreenScaffold`'s: the modal reaches `useAuth` and
 * through it Firebase, which every screen that only wants a scrolling body
 * has no reason to load.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@sudobility/components-rn';
import { SignInModal } from './SignInModal';

export function SignInRequired() {
  const { t } = useTranslation();
  const [signingIn, setSigningIn] = useState(false);
  return (
    <View className="items-center gap-3 py-8">
      <Text className="text-muted-foreground text-center">
        {t('library.authRequired')}
      </Text>
      <Button
        variant="link"
        textClassName="text-base"
        onPress={() => setSigningIn(true)}
      >
        {t('nav.signIn')}
      </Button>
      <SignInModal visible={signingIn} onClose={() => setSigningIn(false)} />
    </View>
  );
}
