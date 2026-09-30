/**
 * Whether the app is arranged under a tab bar on this platform, and how to
 * reach a tab from outside it.
 *
 * Every platform is: Projects, Community, Docs, Resources and Settings are
 * tabs (`MainTabs`), and the editor is pushed above them so that an open
 * project has the whole window. On iOS and Android the bar is the system's;
 * on macOS and Windows it is drawn across the top of the one window the app
 * has (`MainTabs.desktop.tsx`), with each tab's own split view beneath it —
 * the tablet's arrangement, in a window. The menu bar carries the same
 * destinations there, and its commands land on these tabs.
 *
 * What differs is reaching a tab from above or beside the tabs — the editor,
 * the menu commands — where the tab navigator has to be named first.
 * `goToTab` is that one difference, stated once.
 */
import { Platform } from 'react-native';
import { StackActions } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import type { MainTabParamList } from './Navigation';

const TAB_BAR_PLATFORMS = new Set(['ios', 'android', 'macos', 'windows']);

export function hasTabBar(): boolean {
  return TAB_BAR_PLATFORMS.has(Platform.OS);
}

/**
 * Whether the tab bar floats across the top of the screen rather than
 * sitting along the bottom: an iPad, from iPadOS 18.
 *
 * It matters to whatever draws in that row. The bar is centred and takes the
 * middle of it, so a title at the leading edge shows beside the bar and one
 * further in is drawn underneath it.
 *
 * Not a desktop window, although its bar is along the top too: that one is a
 * row of its own above the screen, and floats over nothing.
 */
export function hasTopTabBar(): boolean {
  return (
    Platform.OS === 'ios' &&
    Platform.isPad &&
    Number.parseInt(String(Platform.Version), 10) >= 18
  );
}

export type MainTab = keyof MainTabParamList;

/** The least of a navigator that `goToTab` needs, so a ref and a prop both fit. */
type Navigates = {
  navigate: (...args: never[]) => void;
  dispatch: (action: NavigationAction) => void;
};

export function goToTab<Tab extends MainTab>(
  navigation: Navigates,
  tab: Tab,
  params?: MainTabParamList[Tab],
): void {
  if (hasTabBar()) {
    /*
      `popTo`, never `navigate`: the tabs are already in the stack, beneath
      whatever is asking, and `navigate` would push a second copy of them on
      top — a second tab bar over a second set of screens, with the first
      still underneath and the editor between the two.
    */
    navigation.dispatch(StackActions.popTo('Main', { screen: tab, params }));
    return;
  }
  const navigate = navigation.navigate as (
    name: string,
    params?: unknown,
  ) => void;
  navigate(tab, params);
}
