/**
 * The shell every non-editor screen shares.
 *
 * Scrolling body, consistent padding, the way back out, and one place for the
 * "this needs a server" state — which several screens have and which must read
 * the same way in each, or it looks like a different failure every time.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heading, Text, touchSlop } from '@sudobility/components-rn';
import { useSafeAreaInsets } from '@/platform/SafeArea';
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
  // The navigator owns the top inset. Only the content clears side cutouts;
  // the background and bottom still extend to the screen edges.
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{
        gap: PADDING,
        paddingTop: PADDING,
        paddingBottom: PADDING,
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
