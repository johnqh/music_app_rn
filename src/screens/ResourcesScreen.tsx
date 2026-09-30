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
 * **The list itself is `@sudobility/music_lib`'s**, shared with the web
 * page — forty-two entries transcribed into a second app would be forty-two
 * chances for the two to disagree about what this app can open. The host under
 * each name is derived from the URL and never typed, for the same reason: a
 * page that is nothing but outbound links should say where each one goes, and a
 * hand-written host is the one field free to disagree with the link above it.
 *
 * **A tile is the web page's tile**: the site's mark in a white chip, its name
 * and host beside it, and what is there underneath, in a grid as many across
 * as the screen has room for. The icons are vendored, as the web's are
 * (`resource-icons.ts`) — bundled files rather than forty-two `<Image>` tags
 * pointed at other people's servers, which would tell each of them who is
 * reading this screen. A site with no icon gets its initial in the same chip.
 */
import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import { ScreenScaffold } from './ScreenScaffold';
import { TitledScreen } from '@/components/layout/SplitViewContainer';
import { RESOURCE_GROUPS, hostOf, monogramFor } from '@sudobility/music_lib';
import type { Resource } from '@sudobility/music_types';
import { TILE_GAP, tileGrid } from '@/features/projects/ProjectTiles';
import { iconFor } from './resource-icons';

/** The chip the mark sits in, and the mark inside it: the web's `h-9` and `h-6`. */
const CHIP_SIZE = 36;
const ICON_SIZE = 24;

export function ResourcesScreen() {
  const { t } = useTranslation();
  /*
    How many across comes from the width this is given, never the window's —
    `tileGrid` is the projects grid's own arithmetic. It allows for a padding
    the grid has and this does not, the scaffold having padded already, so it
    is handed that much more. One column until measured.
  */
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);
  const { columns, tileWidth } = tileGrid(width + 2 * TILE_GAP);

  return (
    <TitledScreen title={t('nav.resources')}>
      <ScreenScaffold>
        {/* No scroller of its own: `ScreenScaffold` is already one, and a
          ScrollView inside a ScrollView is a scroll that stops halfway. */}
        <View className="gap-6 pb-8" onLayout={onLayout}>
          <Text className="text-muted-foreground text-base">
            {t('resources.intro')}
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
              <View
                className="mt-2 flex-row flex-wrap"
                style={{ gap: TILE_GAP }}
              >
                {group.links.map(link => (
                  <View
                    key={link.key}
                    testID="resource-tile"
                    // Every tile the same width, the last row included.
                    style={
                      columns > 1 ? { width: tileWidth } : { width: '100%' }
                    }
                  >
                    <ResourceTile link={link} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScreenScaffold>
    </TitledScreen>
  );
}

function ResourceTile({ link }: { link: Resource }) {
  const { t } = useTranslation();
  const activate = () => void Linking.openURL(link.url);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={link.name}
      accessibilityHint={t(`resources.link.${link.key}`)}
      // Every link leaves the app, which is what `openURL` says out loud: the
      // system decides where it goes, and the app is not left holding a
      // half-rendered other people's page.
      onPress={activate}
      // macOS has no synthesized-touch fallback for an assistive press, so a
      // VoiceOver activation reaches a Pressable only through
      // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
      onAccessibilityTap={activate}
      // As tall as the row it is in, so a short description does not leave a
      // short tile beside a tall one.
      className="border-border bg-card flex-1 rounded-lg border p-4"
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      <View className="flex-row items-start gap-3">
        <ResourceIcon link={link} />
        <View className="min-w-0 flex-1">
          <Text
            className="text-foreground text-base font-semibold"
            numberOfLines={2}
          >
            {link.name}
          </Text>
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {hostOf(link.url)}
          </Text>
        </View>
      </View>
      <Text className="text-muted-foreground mt-3 text-sm">
        {t(`resources.link.${link.key}`)}
      </Text>
    </Pressable>
  );
}

/**
 * The chip, with the site's mark in it or its initial when there is none.
 *
 * White whatever the theme, as on the web: a mark is drawn for a white page,
 * and a dark chip swallows the dark ones. Hidden from a screen reader — the
 * link's name is beside it, and announcing the logo too reads every entry
 * twice.
 */
function ResourceIcon({ link }: { link: Resource }) {
  const icon = iconFor(link.key);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white"
      style={{ width: CHIP_SIZE, height: CHIP_SIZE }}
    >
      {icon ? (
        <Image
          source={icon}
          resizeMode="contain"
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
        />
      ) : (
        // One letter rather than an abbreviation: "CPDL" shortened to "CP"
        // reads as a broken name, where a single initial reads as what it is.
        <Text className="text-sm font-semibold text-neutral-500">
          {monogramFor(link.name)}
        </Text>
      )}
    </View>
  );
}
