/**
 * Settings — theme, language, and who is signed in.
 *
 * The web app's settings live in a title-bar menu and a `GlobalSettingsPage`;
 * on a phone a menu of that size wants a screen, which is the one place this
 * deliberately differs in *form* while keeping the same contents.
 */
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Button, Select, Text } from '@sudobility/components-rn';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/config/ThemeContext';
import { devicePrefs } from '@/config/useDevicePrefs';
import { THEME_MODE_OPTIONS } from '@sudobility/music_types';
import type { ThemeMode } from '@sudobility/music_types';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type { RootStackParamList } from '@/app/Navigation';
import { ScreenScaffold } from './ScreenScaffold';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();
  const { mode, setMode } = useTheme();

  return (
    <ScreenScaffold>
      <Row label={t('settings.language')}>
        <Select
          value={i18n.language.startsWith('zh') ? 'zh' : 'en'}
          // A select's visible label sits outside it, so without this a screen
          // reader announces only the value — "English", with no word for what
          // is English.
          accessibilityLabel={t('settings.language')}
          options={SUPPORTED_LANGUAGES.map(code => ({
            value: code,
            label: t(`settings.language_${code}`),
          }))}
          // A device pref, so the choice survives a relaunch; the composition
          // root keeps i18next on whatever the prefs store says.
          onValueChange={(value: string) =>
            devicePrefs.getState().setLanguage(value)
          }
        />
      </Row>

      {/*
        `system` is offered alongside the two overrides rather than being the
        absence of one: "follow the OS again" is a choice a reader makes, and it
        is remembered like any other.
      */}
      <Row label={t('settings.theme')}>
        <Select
          value={mode}
          accessibilityLabel={t('settings.theme')}
          options={THEME_MODE_OPTIONS.map(option => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          onValueChange={(value: string) => setMode(value as ThemeMode)}
        />
      </Row>

      {/*
        There is deliberately no developer-settings row here any more. It opened
        a sheet of six toggles — `showIds`, `showTicks`,
        `showMeasureBoundaries`, `showPlaybackScheduling`, `enableDiagnostics`
        and `enableValidationWarnings` — that no package in the family read, so
        every one of them did nothing; they are gone from `DevSettings`
        upstream. The one setting left is `generationVariant`, and this app has
        no control for it (the web's developer dialog does), so a sheet here
        would open on nothing at all.
      */}

      <Row label={t('settings.account')}>
        {user ? (
          <View className="items-end gap-2">
            <Text className="text-foreground text-base">
              {user.email ?? user.uid}
            </Text>
            <Button size="sm" onPress={() => void signOut()}>
              {t('nav.signOut')}
            </Button>
          </View>
        ) : (
          <Button size="sm" onPress={() => navigation.navigate('SignIn')}>
            {t('nav.signIn')}
          </Button>
        )}
      </Row>

      <View className="gap-2 pt-4">
        <Button variant="outline" onPress={() => navigation.navigate('Docs')}>
          {t('nav.docs')}
        </Button>
        <Button
          variant="outline"
          onPress={() => navigation.navigate('Shortcuts')}
        >
          {t('editor.keyboardShortcuts')}
        </Button>
        {/*
          Beside Docs rather than under Import: it answers "I have nothing to
          open", which is a question about the app rather than a step in an
          import.
        */}
        <Button
          variant="outline"
          onPress={() => navigation.navigate('Resources')}
        >
          {t('nav.resources')}
        </Button>
        <Button variant="outline" onPress={() => navigation.navigate('About')}>
          {t('about.title')}
        </Button>
        <Button
          variant="outline"
          onPress={() => navigation.navigate('Community')}
        >
          {t('nav.community')}
        </Button>
        <Button
          variant="outline"
          onPress={() => navigation.navigate('Credits')}
        >
          {t('nav.credits')}
        </Button>
      </View>
    </ScreenScaffold>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="border-border flex-row items-center justify-between border-b py-3">
      <Text className="text-foreground">{label}</Text>
      {children}
    </View>
  );
}
