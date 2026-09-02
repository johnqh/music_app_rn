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
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveDocument } from '@/documents/DocumentsContext';
import { DeveloperSettingsSheet } from '@/features/editor/DeveloperSettingsSheet';
import { useTheme } from '@/config/ThemeContext';
import { THEME_MODES } from '@sudobility/music_editing';
import type { ThemeMode } from '@sudobility/music_editing';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type { RootStackParamList } from '@/app/Navigation';
import { ScreenScaffold } from './ScreenScaffold';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const document = useActiveDocument();
  const [devOpen, setDevOpen] = useState(false);

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
          onValueChange={(value: string) => void i18n.changeLanguage(value)}
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
          options={THEME_MODES.map(value => ({
            value,
            label: t(`settings.theme_${value}`),
          }))}
          onValueChange={(value: string) => setMode(value as ThemeMode)}
        />
      </Row>

      {/*
        The developer toggles, behind their own sheet: they change how the app
        is *inspected* rather than what the score is, so they belong in
        settings and not beside the editing tools.
      */}
      <Row label={t('devSettings.title')}>
        <Button
          variant="secondary"
          disabled={!document}
          onPress={() => setDevOpen(true)}
        >
          {t('common.open')}
        </Button>
      </Row>
      {document ? (
        <DeveloperSettingsSheet
          open={devOpen}
          document={document}
          onClose={() => setDevOpen(false)}
        />
      ) : null}

      <Row label={t('settings.account')}>
        {user ? (
          <View className="items-end gap-2">
            <Text className="text-foreground text-base">
              {user.email ?? user.uid}
            </Text>
            <Button size="sm" onPress={() => void signOut()}>
              {t('auth.signOut')}
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
