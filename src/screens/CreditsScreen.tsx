/**
 * Credits — the balance, and what a generation costs.
 *
 * **Quoted, not calculated.** One credit per bar per instrument, which is what
 * the server bills, and the quote says "about": the server charges what the
 * model actually produced, which agrees whenever generation returns the length
 * asked for and is otherwise smaller. A quote that could be exceeded would be
 * worse than none.
 *
 * The web app's store page comes from `@sudobility/consumables_pages`, which
 * has no React Native port; purchasing therefore is not offered here rather
 * than half-offered. What is shown is the balance and the rate.
 */
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@sudobility/components-rn';
import { useAuth } from '@/auth/AuthContext';
import { getMusicClient } from '@/config/server';
import type { RootStackParamList } from '@/app/Navigation';
import {
  ScreenScaffold,
  ServerUnavailable,
  SignInRequired,
} from './ScreenScaffold';

export function CreditsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  if (!getMusicClient()) {
    return (
      <ScreenScaffold>
        <ServerUnavailable />
      </ScreenScaffold>
    );
  }
  if (!user) {
    return (
      <ScreenScaffold>
        <SignInRequired onSignIn={() => navigation.navigate('SignIn')} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <Text className="text-foreground">{t('credits.rate')}</Text>
      <Text className="text-muted-foreground text-sm">
        {t('credits.purchaseElsewhere')}
      </Text>
    </ScreenScaffold>
  );
}
