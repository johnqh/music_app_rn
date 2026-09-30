/**
 * The split view, for Projects, Docs and Settings: a list, and what was
 * chosen from it.
 *
 * A fixed-width primary panel on the left holding a list, a hairline divider,
 * and a secondary panel taking the rest.
 *
 * **Under the system's tab bar each panel keeps a navigation bar; in a
 * desktop window neither has one.** On iOS and Android the bar is what the
 * content scrolls beneath and stops under — and on an iPad it is the row the
 * tab bar floats across, so without it the content ran up under the tabs. A
 * desktop window draws its tab bar as a row of its own, above the screen,
 * and needs no second row under it.
 *
 * **The list's bar is untitled.** It used to say what it was a list of —
 * "Projects" over the Projects list, under a tab bar that already said
 * Projects. The tab bar is the main navigation and names the screen. What
 * was chosen is still named: in the detail's bar on a phone or a tablet, and
 * as a heading at the top of the detail in a desktop window, which is where
 * the web's master/detail layout names it.
 *
 * There is no width test: this app is landscape-only on every device and
 * must never size from `useWindowDimensions()` (on macOS it reports the
 * display, not the window).
 */
import type { ReactNode } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { hasTopTabBar } from '@/app/tab-bar';
import { useNavigationTheme } from '@/app/useNavigationTheme';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import {
  Heading,
  MIN_TOUCH_TARGET,
  Text,
  useFormFactor,
} from '@sudobility/components-rn';
import { useNotationInk } from '@/components/icons/notation-ink';
import { SafeAreaView, useSafeAreaInsets } from '@/platform/SafeArea';
import {
  DETAIL_MAX_WIDTH,
  DETAIL_PADDING,
  EmbeddedScreen,
} from './EmbeddedScreen';

/** The primary panel's width, in points — `sudojo_app_rn`'s. */
export const PRIMARY_PANEL_WIDTH = 320;

/**
 * The same, on a phone. A phone in landscape is some 750 points across once
 * its cutout is cleared, and a 320-point list took over two fifths of that
 * to show names a line long; this leaves the detail the rest.
 */
export const PHONE_PRIMARY_PANEL_WIDTH = 240;

/**
 * How wide the list is here. By the device, not the window: a phone is a
 * phone however it is held, and this app never sizes from the window.
 */
export function usePrimaryPanelWidth(): number {
  return useFormFactor() === 'phone'
    ? PHONE_PRIMARY_PANEL_WIDTH
    : PRIMARY_PANEL_WIDTH;
}

/**
 * Clears whatever sits over the top of the screen, once, for whatever is
 * inside — and only the status bar.
 *
 * The native view rather than the hook: the hook answers with the window's
 * inset, which on an iPad reaches below the floating tab bar, while the
 * view knows the tabs' own bar has that row.
 */
function TopClearance({ children }: { children: ReactNode }) {
  // A phone's status bar is hidden (`ThemedStatusBar`), and Android goes on
  // reporting the room it took as inset: the bars start at the edge.
  const phone = useFormFactor() === 'phone';
  return (
    <SafeAreaView edges={phone ? [] : ['top']} className="bg-background flex-1">
      {children}
    </SafeAreaView>
  );
}

/**
 * A screen that is not a split view, under a bar that names it: Community,
 * Resources. The same bar a split view's panels have, so every screen under
 * the tab bar is titled the same way. A desktop draws no bars, and the
 * screen is what it holds.
 */
export function TitledScreen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  if (!hasPanelBar()) return <>{children}</>;
  return (
    <TopClearance>
      <PanelBar title={title}>{children}</PanelBar>
    </TopClearance>
  );
}

export function SplitViewContainer({
  primaryPanel,
  secondaryPanel,
}: {
  /** The left panel: a `SplitPanel` holding the list. */
  primaryPanel: ReactNode;
  /** The right panel: a `SplitPanel` holding what was chosen. */
  secondaryPanel: ReactNode;
}) {
  // The list is what meets the screen's left edge, so its panel is what
  // widens to clear a cutout there.
  const insets = useSafeAreaInsets();
  const primaryWidth = usePrimaryPanelWidth();
  return (
    <TopClearance>
      <View className="flex-1 flex-row">
        <View style={{ width: primaryWidth + insets.left }}>
          {primaryPanel}
        </View>
        <View className="bg-border" style={styles.divider} />
        <View className="min-w-0 flex-1">
          <EmbeddedScreen>{secondaryPanel}</EmbeddedScreen>
        </View>
      </View>
    </TopClearance>
  );
}

type PanelParamList = { Panel: undefined };
/*
  The plain stack on every platform, not `createAppStackNavigator`'s native
  one. A native bar is laid out against the *window*: under an iPad's tab
  bar, which floats across the top, each panel's bar stretched up beneath it
  to twice its height. A panel is one screen that never pushes, so there is
  no transition for a native stack to have done better.
*/
const PanelStack = createStackNavigator<PanelParamList>();

/**
 * A panel's bar, as tall as the platform's own: Material's top app bar, an
 * iPad's navigation bar, an iPhone's.
 *
 * **Stated, because the navigator's own answer is a guess from the panel's
 * shape.** It draws a short bar for a view wider than it is tall and a
 * taller one otherwise — a rule about a phone turned on its side, asked of
 * a panel. The list on a phone is about as wide as it is tall, so the
 * answer changed with every layout, each answer changing the layout that
 * was measured for the next: the list's bar jumped between the two heights
 * without stopping, and the list under it jumped with it.
 */
function panelBarHeight(formFactor: ReturnType<typeof useFormFactor>): number {
  // Material's top app bar is 64 on a tablet and 48 on a phone held on its
  // side, which is the only way this app holds one. 64 over a phone's row
  // of content was a fifth of the screen.
  if (Platform.OS === 'android') return formFactor === 'phone' ? 48 : 64;
  return (Platform as { isPad?: boolean }).isPad ? 50 : 44;
}

/**
 * Whether a panel draws a navigation bar: where the system's tab bar is
 * along the bottom. Where it is along the top it is overlaid on the tabs'
 * own native bar, which is the one bar that row holds — a bar of ours under
 * it would be a second row. A desktop draws none.
 */
function hasPanelBar(): boolean {
  return (
    (Platform.OS === 'ios' || Platform.OS === 'android') && !hasTopTabBar()
  );
}

/**
 * One column.
 *
 * The detail is held to the web's width (`DetailWidth`) and named by
 * `title`: what was chosen from the list. Where a panel has a bar the title
 * is in it — except under an iPad's tab bar, which floats across the middle
 * of that same row and would be drawn over it — and where it has none the
 * title heads the content. **Both bars are titled, on a phone and a
 * tablet**: the list's with what it lists, the detail's with what was
 * chosen — a bar with nothing in it is a strip of blank. Where the tab bar
 * is along the top there is no bar of ours at all (`hasPanelBar`): the tabs'
 * own bar holds that row, with the tab bar overlaid on it, and the detail
 * is headed in its content instead, as on a desktop. A desktop draws no bars, and its list
 * is headed by nothing — the window's own title names it.
 *
 * **Behind a bar, a panel's content cannot reach the app's navigator with
 * `useNavigation()`**: the bar is a navigator of the panel's own, with one
 * screen. What leaves the split view is handed down from the screen that
 * holds it, as a prop or a callback.
 */
/**
 * A bar with `title` in it, over `children`: the plain stack's header, on a
 * navigator of its own with one screen.
 */
function PanelBar({ title, children }: { title: string; children: ReactNode }) {
  const theme = useNavigationTheme();
  const formFactor = useFormFactor();
  return (
    <NavigationIndependentTree>
      <NavigationContainer theme={theme}>
        <PanelStack.Navigator
          screenOptions={{
            headerShown: true,
            // The top of the screen has already been cleared.
            headerStatusBarHeight: 0,
            headerStyle: { height: panelBarHeight(formFactor) },
          }}
        >
          <PanelStack.Screen name="Panel" options={{ title }}>
            {() => children}
          </PanelStack.Screen>
        </PanelStack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

export function SplitPanel({
  title,
  secondary = false,
  children,
}: {
  /** The list's name, or what was chosen from it, naming the detail. */
  title?: string;
  /** The detail, on the right. */
  secondary?: boolean;
  children: ReactNode;
}) {
  if (hasPanelBar()) {
    return (
      <PanelBar title={title ?? ''}>
        {secondary ? <DetailWidth>{children}</DetailWidth> : children}
      </PanelBar>
    );
  }
  if (!secondary) {
    return <View className="bg-background flex-1">{children}</View>;
  }
  return (
    <DetailWidth>
      {title ? (
        <View style={styles.title}>
          <Heading className="text-foreground">{title}</Heading>
        </View>
      ) : null}
      {children}
    </DetailWidth>
  );
}

/**
 * The detail's content, no wider than `DETAIL_MAX_WIDTH` and centred past it
 * — the web's master/detail layout, which caps the detail the same way, so
 * that a line of it never runs the width of a desktop window.
 */
function DetailWidth({ children }: { children: ReactNode }) {
  return (
    <View testID="split-detail" className="bg-background flex-1 items-center">
      <View
        testID="split-detail-content"
        className="w-full flex-1"
        style={styles.detail}
      >
        {children}
      </View>
    </View>
  );
}

export type SplitMenuEntry = {
  id: string;
  label: string;
  /** A heading, not a choice: it names the entries under it. */
  heading?: boolean;
};

/** The primary panel's list, with the chosen entry marked as it is there. */
export function SplitMenuList({
  label,
  entries,
  selected,
  onSelect,
}: {
  /** What the list is a list of, for a screen reader. */
  label: string;
  entries: readonly SplitMenuEntry[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const ink = useNotationInk();
  return (
    <FlatList
      className="bg-background flex-1"
      accessibilityLabel={label}
      contentContainerStyle={{ paddingLeft: insets.left }}
      data={entries}
      // Every entry, from the first frame: the list is a menu of a couple of
      // dozen rows at most, and one drawn a screenful at a time has rows a
      // screen reader cannot reach until somebody scrolls to them.
      initialNumToRender={entries.length}
      keyExtractor={(entry: SplitMenuEntry) => entry.id}
      renderItem={({ item }: { item: SplitMenuEntry }) => {
        if (item.heading) {
          return (
            <Text className="text-muted-foreground px-4 pt-4 pb-1 text-sm font-semibold uppercase">
              {item.label}
            </Text>
          );
        }
        const isSelected = item.id === selected;
        const choose = () => onSelect(item.id);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isSelected }}
            onPress={choose}
            // macOS has no synthesized-touch fallback for an assistive press,
            // so a VoiceOver activation reaches a Pressable only through
            // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
            onAccessibilityTap={choose}
            className={
              isSelected
                ? 'border-border border-l-primary bg-primary/10 flex-row items-center justify-between px-4'
                : 'border-border flex-row items-center justify-between border-l-transparent px-4'
            }
            style={styles.entry}
          >
            <Text className="text-foreground flex-1 text-base">
              {item.label}
            </Text>
            <ChevronRightIcon size={16} color={ink.muted} />
          </Pressable>
        );
      }}
    />
  );
}

/** The secondary panel with nothing chosen. */
export function EmptySecondaryPanel({ message }: { message: string }) {
  return (
    <View className="bg-background flex-1 items-center justify-center p-8">
      <Text className="text-muted-foreground text-center text-base">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { width: StyleSheet.hairlineWidth },
  detail: { maxWidth: DETAIL_MAX_WIDTH },
  /*
    The web's `px-6 pt-6`, over `mb-4`. What follows brings the detail's own
    inset above it, which is 24 where the web leaves 16 under its title, so
    the difference is taken back here.
  */
  title: {
    paddingHorizontal: DETAIL_PADDING,
    paddingTop: DETAIL_PADDING,
    marginBottom: 16 - DETAIL_PADDING,
  },
  // The selection's bar on the left, present and clear when not selected so
  // that choosing an entry does not move its words.
  entry: {
    minHeight: MIN_TOUCH_TARGET,
    borderLeftWidth: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
