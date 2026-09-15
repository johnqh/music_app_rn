/**
 * One published score, read-only.
 *
 * The other screen the web app renders signed out. It draws with the same
 * `ScrollingScore` the editor uses — read-only is the absence of an editing
 * surface, not a second renderer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Spinner, Text } from '@sudobility/components-rn';
import {
  communityItemTitle,
  publishedSnapshotUrl,
} from '@sudobility/music_types';
import type { PublishedSnapshot } from '@sudobility/music_types';
import { getMusicClient } from '@/config/server';
import { ScrollingScore } from '@/features/score/ScrollingScore';
import type { RootStackParamList } from '@/app/Navigation';
import { Share } from 'react-native';
import { PauseIcon, PlayIcon, ShareIcon } from 'react-native-heroicons/solid';
import { IconButton } from '@/components/layout/IconButton';
import { createDocumentStore } from '@sudobility/music_lib';
import { usePlayerBinding } from '@/features/transport/usePlayerBinding';
import { appToasts } from '@/features/toasts/Toasts';
import { CONSTANTS } from '@/config/constants';
import { ScreenScaffold, ServerUnavailable } from './ScreenScaffold';

export function PublishedScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Published'>>();
  const client = getMusicClient();
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setSnapshot(await client.getPublishedSnapshot(route.params.publicId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [client, route.params.publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!client) {
    return (
      <ScreenScaffold>
        <ServerUnavailable />
      </ScreenScaffold>
    );
  }
  if (error) {
    return (
      <ScreenScaffold>
        <Text className="text-destructive">{error}</Text>
      </ScreenScaffold>
    );
  }
  if (!snapshot) {
    return (
      <ScreenScaffold>
        <View className="items-center py-8">
          <Spinner />
        </View>
      </ScreenScaffold>
    );
  }

  return <PublishedScore snapshot={snapshot} />;
}

/**
 * The score, and the two things a visitor can do with it.
 *
 * **Listening is the whole point of a public page** — "anyone can listen, no
 * account needed" is what the community screen promises — and this screen
 * showed the notation with no way to hear it. Its own component because the
 * player must not be bound before the snapshot has arrived: a hook cannot be
 * skipped, and loading a null score into the player is not a state worth
 * modelling.
 *
 * **The page has a store of its own**, an unsaved document over the snapshot's
 * score, because `bindPlayer` binds a store: it is where the transport state and
 * the load progress are mirrored, and where a failed play is reported — to the
 * app's toast queue, like every other store here. The web's published page had
 * the opposite bug, binding the app's singleton store and so playing whatever
 * the editor last had open. Nothing saves it: an unsaved origin has nowhere to
 * write, and nothing on this page edits.
 *
 * Sharing is the other half: a page whose whole purpose is being passed on
 * should offer the system share sheet rather than making somebody copy a URL
 * out of a browser they are not in.
 */
function PublishedScore({ snapshot }: { snapshot: PublishedSnapshot }) {
  const { t, i18n } = useTranslation();
  const store = useMemo(
    () =>
      createDocumentStore({
        title: communityItemTitle(snapshot),
        score: snapshot.score,
        context: { toasts: appToasts },
      }),
    [snapshot],
  );
  useEffect(() => () => store.getState().dispose(), [store]);
  const transport = usePlayerBinding(store);
  const playing = useStore(store, s => s.state) === 'playing';

  return (
    <View className="bg-background flex-1">
      <View className="border-border flex-row items-center gap-2 border-b px-4 py-2">
        <View className="flex-1">
          <Text className="text-foreground font-medium">
            {communityItemTitle(snapshot)}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {t('community.sharedBy', { name: snapshot.publisherName })}
          </Text>
        </View>
        <IconButton
          label={playing ? t('transport.pause') : t('transport.play')}
          onPress={() => void transport.togglePlay()}
        >
          {playing ? (
            <PauseIcon size={18} className="text-foreground" />
          ) : (
            <PlayIcon size={18} className="text-foreground" />
          )}
        </IconButton>
        <IconButton
          label={t('published.share')}
          onPress={() => {
            /*
              The web page's own address, `<web>/<lang>/p/<id>` — the route a
              link opens whichever app copied it. It used to be derived from the
              API's host with no language segment, which matched no web route.
            */
            void Share.share({
              title: communityItemTitle(snapshot),
              message: publishedSnapshotUrl(
                CONSTANTS.WEB_URL,
                i18n.language.startsWith('zh') ? 'zh' : 'en',
                snapshot.publicId,
              ),
            });
          }}
        >
          <ShareIcon size={18} className="text-foreground" />
        </IconButton>
      </View>
      {/* No `onPress`: there is no caret to aim on a page you cannot edit. */}
      <ScrollingScore score={snapshot.score} />
    </View>
  );
}
