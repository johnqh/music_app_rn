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
 * than half-offered. What is shown is the balance, the rate and the coupon
 * form, which is the one way to add credits from here — and the
 * balance really is shown now: this screen claimed it in its own doc while
 * rendering only the rate, so the one number somebody opens it for was the one
 * thing missing.
 *
 * The balance comes from `ConsumablesApiClient`, which needs no purchase SDK —
 * see `useCreditBalance`.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { Text } from '@sudobility/components-rn';
import { useCreditBalance } from '@/features/credits/useCreditBalance';
import { RedeemCouponForm } from './settings/RedeemCouponForm';
import { useAuth } from '@/auth/AuthContext';
import { getMusicClient } from '@/config/server';
import type { RootStackParamList } from '@/app/Navigation';
import {
  ScreenScaffold,
  ServerUnavailable,
  SignInRequired,
} from './ScreenScaffold';
import { trackScreenView } from '@/analytics';

export function CreditsScreen({
  onSignIn,
}: {
  /**
   * Where signing in happens, for a holder that has somewhere of its own —
   * Settings shows its account pane. Otherwise the sign-in screen is pushed.
   */
  onSignIn?: () => void;
} = {}) {
  useEffect(() => {
    trackScreenView('CreditsScreen');
  }, []);

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
        <SignInRequired
          onSignIn={onSignIn ?? (() => navigation.navigate('SignIn'))}
        />
      </ScreenScaffold>
    );
  }

  return <CreditsBody />;
}

function CreditsBody() {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const { balance, loading, refresh } = useCreditBalance(
    getToken,
    user !== null,
  );

  return (
    <ScreenScaffold>
      {/*
        Unknown is not zero. A failed read shows as a dash rather than an empty
        wallet — reporting one as the other is what would make the app refuse
        work the server would have accepted.
      */}
      <View className="gap-1">
        <Text className="text-muted-foreground text-sm">
          {t('credits.balance')}
        </Text>
        <Text className="text-foreground text-2xl tabular-nums">
          {loading && balance === null ? '…' : balance ?? '—'}
        </Text>
      </View>
      <Text className="text-foreground">{t('credits.rate')}</Text>
      <Text className="text-muted-foreground text-base">
        {t('credits.purchaseElsewhere')}
      </Text>
      {/* The way to get more that this app does have, under the number it
          changes — which is asked for again once a coupon has been spent. */}
      <RedeemCouponForm onRedeemed={refresh} />
    </ScreenScaffold>
  );
}
