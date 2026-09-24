/**
 * What this app is — the web's home page, in the form a native app can use.
 *
 * The web opens on a landing page because a visitor arrives at a URL knowing
 * nothing; somebody who installed an app already chose it, and this app opens
 * straight into the editor for that reason. So the *content* of that page is
 * here and its *shape* is not: the strapline and the three things the product
 * does, reachable from Settings, without the "Get started free" a launched app
 * has already answered.
 *
 * The copy is the web's own `home.*` strings, re-keyed under `about.*` — one
 * wording for one claim, so the two apps cannot come to describe the product
 * differently.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppVersion, Text } from '@sudobility/components-rn';
import { version as appVersion } from '../../package.json';
import { CONSTANTS } from '@/config/constants';
import { ScreenScaffold } from './ScreenScaffold';

export function AboutScreen() {
  const { t } = useTranslation();
  const features = [
    {
      key: 'editor',
      title: 'home.featureEditorTitle',
      body: 'home.featureEditorBody',
    },
    { key: 'ai', title: 'home.featureAiTitle', body: 'home.featureAiBody' },
    {
      key: 'formats',
      title: 'home.featureFormatsTitle',
      body: 'home.featureFormatsBody',
    },
  ];

  return (
    <ScreenScaffold title={t('about.title')}>
      <View className="gap-2">
        <Text className="text-foreground text-lg font-semibold">
          {t('home.heroTitle')}
        </Text>
        <Text className="text-muted-foreground text-base">
          {t('home.heroBody')}
        </Text>
      </View>

      <View className="gap-3 pt-2">
        {features.map(feature => (
          <View
            key={feature.key}
            className="border-border gap-1 rounded border p-3"
          >
            <Text className="text-foreground text-base font-medium">
              {t(feature.title)}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {t(feature.body)}
            </Text>
          </View>
        ))}
      </View>

      {/* The build, which a bug report needs and nothing else states. Read
          from `package.json`, which `push_all` bumps and syncs to the native
          platform files — so there is one version, not a second one typed. */}
      <View className="pt-2">
        <AppVersion appName={CONSTANTS.APP_NAME} version={appVersion} />
      </View>
    </ScreenScaffold>
  );
}
