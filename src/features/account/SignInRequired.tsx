/**
 * The signed-out state of a screen that needs an account: what is missing,
 * and the way in — opened over the screen as `SignInModal`, not by sending
 * the reader to a sign-in route. Signing in closes the modal, and the screen
 * that asked re-renders with what it is for, because it reads `useAuth`.
 *
 * The modal opens by itself once, on arrival, as the family's other apps do:
 * somebody who came to a screen that has nothing to show without an account
 * came to sign in. Closing it leaves the prompt and its button in place, so
 * backing out is not a dead end and the way in stays one tap away.
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
  // Open on arrival — once: state set at mount, not an effect that reopens it.
  const [signingIn, setSigningIn] = useState(true);
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
