/**
 * The tab bar: Projects, Community, Docs, Resources and Settings.
 *
 * iOS and Android only (`hasTabBar`). Every destination that is not a
 * document is one press away and stays where it was left; the editor is not
 * among them — it is pushed above this navigator (`Navigation.tsx`), so an
 * open project covers the tab bar and has the whole screen.
 *
 * **The bar is the system's, not a drawing of one.** The native navigator
 * hands the tabs to a `UITabBarController` on iOS and a Material bottom
 * navigation bar on Android, so an iPad gets the bar iPadOS draws for an
 * iPad — where it puts it, how it looks and how it moves are the platform's
 * and change with it. The JS navigator (`createBottomTabNavigator`) draws a
 * bar of its own along the bottom on every device, which is what made an
 * iPad look like a large phone. The cost is the icon: a system bar takes a
 * platform image rather than a React view, so each tab names an SF Symbol
 * for iOS and an image for Android (`assets/tab-icons/`, rendered from
 * `android/app/src/main/res/drawable/ic_tab_*.xml`, the heroicon outlines
 * the rest of the app draws).
 *
 * The route names are the desktop stack's own, `Dashboard` for Projects
 * included, so a screen that navigates to a sibling does it the same way
 * under either arrangement.
 */
import type { ReactElement } from 'react';
import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { SafeAreaView as TabSafeAreaView } from 'react-native-screens/experimental';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { NativeBottomTabIcon } from '@react-navigation/bottom-tabs/unstable';
import { useTranslation } from 'react-i18next';
import { UnsavedQuitGuard } from '@/features/documents/UnsavedQuitGuard';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { CommunityScreen } from '@/screens/CommunityScreen';
import { DocsScreen } from '@/screens/DocsScreen';
import { ResourcesScreen } from '@/screens/ResourcesScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { hasTopTabBar } from './tab-bar';
import type { MainTab } from './tab-bar';
import type { MainTabParamList } from './Navigation';

const Tab = createNativeBottomTabNavigator<MainTabParamList>();

type SymbolName = Extract<NativeBottomTabIcon, { type: 'sfSymbol' }>['name'];

/**
 * Each tab's glyph, per platform. A record over the tabs, so one added
 * without an icon fails to compile rather than showing a blank item.
 *
 * `filled` is the chosen tab's symbol on iOS, which says "selected" in shape
 * as well as in colour; Android tints the one image.
 *
 * Android's is a PNG, not the vector drawable it is drawn from: the bar
 * takes its icon through React Native's image loader, which reads bitmaps.
 * Handed a vector's name it drew nothing, and four tabs of five were
 * invisible. `scripts/make-tab-icons.mjs` renders them.
 */
const ICONS: Record<
  MainTab,
  { symbol: SymbolName; filled: SymbolName; image: ImageSourcePropType }
> = {
  Dashboard: {
    symbol: 'square.stack',
    filled: 'square.stack.fill',
    image: require('../../assets/tab-icons/projects.png'),
  },
  Community: {
    symbol: 'person.3',
    filled: 'person.3.fill',
    image: require('../../assets/tab-icons/community.png'),
  },
  Docs: {
    symbol: 'book',
    filled: 'book.fill',
    image: require('../../assets/tab-icons/docs.png'),
  },
  Resources: {
    symbol: 'link',
    filled: 'link',
    image: require('../../assets/tab-icons/resources.png'),
  },
  Settings: {
    symbol: 'gearshape',
    filled: 'gearshape.fill',
    image: require('../../assets/tab-icons/settings.png'),
  },
};

function tabIcon(tab: MainTab) {
  const { symbol, filled, image } = ICONS[tab];
  return ({ focused }: { focused: boolean }): NativeBottomTabIcon =>
    Platform.OS === 'ios'
      ? { type: 'sfSymbol', name: focused ? filled : symbol }
      : { type: 'image', source: image };
}

/**
 * Keeps a tab's screen above the tab bar.
 *
 * The bar is drawn over the bottom of the screen, not beneath it: a screen
 * is as tall as the window, and the last of whatever it shows was drawn
 * behind the bar. On Android that was the bottom row of Resources, with
 * nowhere further to scroll. On an iPhone the bar floats, and under it went
 * the end of every list and the Create button that New Project pins to the
 * bottom of its pane — a scroll view can be inset to clear the bar, and a
 * button that does not scroll cannot.
 *
 * This is react-native-screens' own safe area, which knows the bar is there;
 * `react-native-safe-area-context` reads the window's and does not. Where
 * the bar is across the top, as on an iPad, what it clears at the bottom is
 * the home indicator alone.
 */
const BOTTOM_EDGE = { bottom: true } as const;

function aboveTabBar({ children }: { children: ReactElement }) {
  return <TabSafeAreaView edges={BOTTOM_EDGE}>{children}</TabSafeAreaView>;
}

export function MainTabs() {
  const { t } = useTranslation();
  return (
    <>
      <Tab.Navigator
        /*
          Back on any tab leaves the app, rather than stepping to the first
          tab and leaving from there: `UnsavedQuitGuard` below answers Back
          for this whole navigator, and a Back that sometimes asked about
          quitting and sometimes changed tabs would be two meanings for one
          button.
        */
        backBehavior="none"
        screenLayout={aboveTabBar}
        screenOptions={{
          /*
            Where the tab bar is along the top (an iPad, from iPadOS 18) the
            native bar stays and its title goes: the tab bar floats across
            that row, and the bar is what the content stops under. The tab
            bar names the screen, so nothing else does. Where the tab bar is
            along the bottom there is no native bar at all — it drew a blank
            strip on Android — and each screen draws a titled bar of its own
            (`SplitPanel`, `TitledScreen`). `title` is still given to each
            tab: it is what the tab itself is labelled with.
          */
          headerShown: hasTopTabBar(),
          headerTitle: '',
          // Android hides the label of every tab but the chosen one once
          // there are more than three. Five destinations named by a glyph
          // alone are five guesses.
          tabBarLabelVisibilityMode: 'labeled',
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={ProjectsScreen}
          options={{
            title: t('nav.projects'),
            tabBarIcon: tabIcon('Dashboard'),
          }}
        />
        <Tab.Screen
          name="Community"
          component={CommunityScreen}
          options={{
            title: t('nav.community'),
            tabBarIcon: tabIcon('Community'),
          }}
        />
        <Tab.Screen
          name="Docs"
          component={DocsScreen}
          options={{
            // The tab says Docs; the screen it opens has room for the word.
            title: t('docs.title'),
            tabBarLabel: t('nav.docs'),
            tabBarIcon: tabIcon('Docs'),
          }}
        />
        <Tab.Screen
          name="Resources"
          component={ResourcesScreen}
          options={{
            title: t('nav.resources'),
            tabBarIcon: tabIcon('Resources'),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: t('nav.settings'),
            tabBarIcon: tabIcon('Settings'),
          }}
        />
      </Tab.Navigator>
      {/*
        Android's Back, guarded, where Back finishes the activity. The
        documents opened in the editor stay open behind the tabs, so leaving
        from here can still throw work away.
      */}
      <UnsavedQuitGuard />
    </>
  );
}
