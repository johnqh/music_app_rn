/**
 * Where to find music worth importing.
 *
 * The app reads five formats and generates a sixth, but a new install has
 * nothing to open — and on a phone that is more acute than on the web, because
 * there is no folder of scores already sitting on the device. This answers "now
 * what do I import?", and the useful half of that answer is not the link, it is
 * *which importer the file feeds*.
 *
 * So it is grouped by import route rather than by genre or popularity, and each
 * section states its route **once** in the header. The web page carried the
 * route per card when there were five links; at forty-two that is forty-two
 * repetitions of "Opens with Import → MIDI" and a section heading nobody can
 * navigate by.
 *
 * **The list itself is `@sudobility/music_editing`'s**, shared with the web
 * page — forty-two entries transcribed into a second app would be forty-two
 * chances for the two to disagree about what this app can open. The host under
 * each name is derived from the URL and never typed, for the same reason: a
 * page that is nothing but outbound links should say where each one goes, and a
 * hand-written host is the one field free to disagree with the link above it.
 *
 * Icons are deliberately absent here rather than hotlinked. The web page
 * vendors thirty-eight files it fetched once; pointing forty-two `<Image>` tags
 * at forty-two other people's servers would tell each of them who is reading
 * this screen, which is exactly what vendoring avoids. A monogram carries the
 * same tile shape without the tracking.
 */
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import {
  RESOURCE_GROUPS,
  hostOf,
  monogramFor,
} from '@sudobility/music_editing';
import type { Resource } from '@sudobility/music_editing';
import { ScreenScaffold } from './ScreenScaffold';

export function ResourcesScreen() {
  const { t } = useTranslation();

  return (
    <ScreenScaffold title={t('resources.title')}>
      {/* No scroller of its own: `ScreenScaffold` is already one, and a
          ScrollView inside a ScrollView is a scroll that stops halfway. */}
      <View className="gap-6 pb-8">
        <Text className="text-muted-foreground text-base">
          {t('resources.intro', { appName: t('app.name') })}
        </Text>

        {RESOURCE_GROUPS.map(group => (
          <View key={group.key} className="gap-2">
            <Text className="text-foreground text-base font-semibold">
              {t(`resources.group.${group.key}.title`)}
            </Text>
            {/* The route, once per section — the thing a reader navigates by. */}
            <Text className="text-muted-foreground text-sm">
              {t(`resources.group.${group.key}.route`)}
            </Text>
            <View className="gap-2">
              {group.links.map(link => (
                <ResourceRow key={link.key} link={link} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScreenScaffold>
  );
}

function ResourceRow({ link }: { link: Resource }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={link.name}
      accessibilityHint={t(`resources.link.${link.key}`)}
      // Every link leaves the app, which is what `openURL` says out loud: the
      // system decides where it goes, and the app is not left holding a
      // half-rendered other people's page.
      onPress={() => void Linking.openURL(link.url)}
      className="border-border flex-row items-center gap-3 rounded border p-3"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      {/*
        A monogram, not a fetched favicon. One letter rather than an
        abbreviation: "CPDL" shortened to "CP" reads as a broken name, where a
        single initial reads as what it is — a placeholder.
      */}
      <View className="bg-muted h-8 w-8 items-center justify-center rounded">
        <Text className="text-muted-foreground text-base font-semibold">
          {monogramFor(link.name)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-base">{link.name}</Text>
        <Text className="text-muted-foreground text-sm">
          {hostOf(link.url)}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {t(`resources.link.${link.key}`)}
        </Text>
      </View>
    </Pressable>
  );
}
