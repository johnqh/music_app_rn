/**
 * The shell every non-editor screen shares.
 *
 * Scrolling body, consistent padding, the way back out, and one place for the
 * "this needs a server" state — which several screens have and which must read
 * the same way in each, or it looks like a different failure every time.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Heading, Text, touchSlop } from '@sudobility/components-rn';
import { ScreenBackBar } from '@/components/layout/ScreenBackBar';

/** The scaffold's own padding, in points — `p-4`, stated so a side inset can add to it. */
const PADDING = 16;

export function ScreenScaffold({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  /*
    The side and bottom insets, added to this screen's own padding.

    Phones are landscape-only, so a notched iPhone puts its sensor housing on
    a *side*: measured on an iPhone 16 Pro simulator with the display mask on,
    the Dynamic Island sat across the Docs topic list and covered the whole of
    "USING THE APP" and the row under it. The navigator draws the header and
    insets that itself; the body is this component's, and it had no inset at
    all. The top is still not read here — the header covers it.

    **The bottom is this component's too, and only iOS made that look
    otherwise.** This used to say "the scroll view's own content inset covers
    the bottom", which is true of a UIScrollView inside a navigation
    controller and of nothing on Android: there is no automatic content inset
    there, so the last row of a scrolled screen ended flush against the
    navigation bar. Measured on a Pixel 9 Pro XL (landscape, gesture
    navigation, `navigationBars` 72px tall): Settings scrolled to the end put
    the bottom 24px of the Credits row inside the gesture band, where a press
    is the system's rather than the app's.
  */
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{
        gap: PADDING,
        paddingTop: PADDING,
        paddingBottom: PADDING + insets.bottom,
        paddingLeft: PADDING + insets.left,
        paddingRight: PADDING + insets.right,
      }}
    >
      {/*
        The way back. Nothing on iOS and Android, whose stack draws its own
        header; on macOS that header is not drawn at all, so without this every
        screen the editor pushes is a room with no door.
      */}
      <ScreenBackBar />
      {title ? <Heading className="text-foreground">{title}</Heading> : null}
      {children}
    </ScrollView>
  );
}

/**
 * What a screen shows when this build has no server.
 *
 * Deliberately not an error: a local-only build is a supported state, and the
 * feature is *unavailable*, not broken. The same words everywhere, from the
 * library's own message catalogue.
 */
export function ServerUnavailable() {
  const { t } = useTranslation();
  return (
    <View className="items-center py-8">
      <Text className="text-muted-foreground text-center">
        {t('library.serverUnavailable')}
      </Text>
    </View>
  );
}

/** Signed-out state for a screen that needs an account. */
export function SignInRequired({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-3 py-8">
      <Text className="text-muted-foreground text-center">
        {t('library.authRequired')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onSignIn}
        // macOS has no synthesized-touch fallback for an assistive press, so a
        // VoiceOver activation reaches a Pressable only through
        // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
        onAccessibilityTap={onSignIn}
        hitSlop={touchSlop(0, 0)}
      >
        <Text className="text-primary">{t('nav.signIn')}</Text>
      </Pressable>
    </View>
  );
}
