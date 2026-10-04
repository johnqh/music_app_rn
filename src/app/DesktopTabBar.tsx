/**
 * The bar itself: the five tabs, across the top of a desktop window.
 *
 * Apart from `MainTabs.desktop.tsx`, which names the screens: a bar that
 * imported the navigator would bring every screen with it, and with them the
 * whole of sign-in, into anything that only wanted to draw five buttons.
 */
import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import {
  BookOpenIcon,
  Cog6ToothIcon,
  LinkIcon,
  RectangleStackIcon,
  UserGroupIcon,
} from 'react-native-heroicons/outline';
import { MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import { useNotationInk } from '@/components/icons/notation-ink';
import type { MainTab } from './tab-bar';

/** Matches the title bar's glyph size. */
const ICON_SIZE = 18;

type Glyph = ComponentType<{ size?: number; color?: string }>;

/**
 * Each tab's glyph and its name. A record over the tabs, so one added
 * without either fails to compile rather than showing a blank item. The
 * heroicon outlines are the ones the Android bar's images are drawn from.
 */
const TABS: Record<MainTab, { icon: Glyph; labelKey: string }> = {
  Dashboard: { icon: RectangleStackIcon, labelKey: 'nav.projects' },
  Community: { icon: UserGroupIcon, labelKey: 'nav.community' },
  Docs: { icon: BookOpenIcon, labelKey: 'nav.docs' },
  Resources: { icon: LinkIcon, labelKey: 'nav.resources' },
  Settings: { icon: Cog6ToothIcon, labelKey: 'nav.settings' },
};

/*
  Whole class strings, never a template with a hole in it: Tailwind extracts
  classes by scanning source text.
*/
const ITEM = 'flex-row items-center gap-2 border-b-2 border-transparent px-4';
const ITEM_SELECTED =
  'border-primary flex-row items-center gap-2 border-b-2 px-4';

/**
 * The bar's height, and so each item's: the least a control may be, which is
 * a toolbar's height rather than a phone tab bar's.
 */
const BAR_HEIGHT = MIN_TOUCH_TARGET;

export function DesktopTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const ink = useNotationInk();
  return (
    <View
      // `tab`/`tablist` map to nothing in AppKit and arrive as `AXUnknown`,
      // which VoiceOver cannot press: each item is a button that says
      // whether it is selected, and the row has no role.
      testID="desktop-tab-bar"
      className="border-border bg-card flex-row justify-center border-b"
      style={{ height: BAR_HEIGHT }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name as MainTab];
        const selected = state.index === index;
        const Icon = tab.icon;
        const choose = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!selected && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={t(tab.labelKey)}
            accessibilityState={{ selected }}
            onPress={choose}
            // macOS has no synthesized-touch fallback for an assistive
            // press, so a VoiceOver press would otherwise do nothing.
            onAccessibilityTap={choose}
            className={selected ? ITEM_SELECTED : ITEM}
            style={({ pressed }) => (pressed ? PRESSED_STYLE : null)}
          >
            <Icon size={ICON_SIZE} color={selected ? ink.primary : ink.muted} />
            <Text
              className={
                selected
                  ? 'text-primary text-base font-medium'
                  : 'text-muted-foreground text-base'
              }
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** While held: the press was noticed. */
const PRESSED_STYLE = { opacity: 0.6 } as const;
