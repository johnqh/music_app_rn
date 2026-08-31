/**
 * One published score, read-only.
 *
 * The other screen the web app renders signed out. It draws with the same
 * `ScrollingScore` the editor uses — read-only is the absence of an editing
 * surface, not a second renderer.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Spinner, Text } from '@sudobility/components-rn';
import type { PublishedSnapshot } from '@sudobility/music_types';
import { getMusicClient } from '@/config/server';
import { ScrollingScore } from '@/features/score/ScrollingScore';
import type { RootStackParamList } from '@/app/Navigation';
import { Share } from 'react-native';
import { PauseIcon, PlayIcon, ShareIcon } from 'react-native-heroicons/solid';
import { IconButton } from '@/components/layout/IconButton';
import { useTransport } from '@/features/transport/useTransport';
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
 * showed the notation with no way to hear it. Its own component because
 * `useTransport` must not be called before the snapshot has arrived: a hook
 * cannot be skipped, and loading a null score into the player is not a state
 * worth modelling.
 *
 * Sharing is the other half: a page whose whole purpose is being passed on
 * should offer the system share sheet rather than making somebody copy a URL
 * out of a browser they are not in.
 */
function PublishedScore({ snapshot }: { snapshot: PublishedSnapshot }) {
  const { t } = useTranslation();
  const transport = useTransport(snapshot.score);
  const playing = transport.state === 'playing';

  return (
    <View className="bg-background flex-1">
      <View className="border-border flex-row items-center gap-2 border-b px-4 py-2">
        <View className="flex-1">
          <Text className="text-foreground font-medium">
            {snapshot.publicName || snapshot.name}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {t('community.sharedBy', { name: snapshot.publisherName })}
          </Text>
        </View>
        <IconButton
          label={playing ? t('transport.pause') : t('transport.play')}
          onPress={() => (playing ? transport.pause() : void transport.play())}
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
            void Share.share({
              title: snapshot.publicName || snapshot.name,
              message: publicUrlFor(snapshot.publicId),
            });
          }}
        >
          <ShareIcon size={18} className="text-foreground" />
        </IconButton>
      </View>
      {/* No `onMeasureTap`: there is no caret to aim on a page you cannot edit. */}
      <ScrollingScore score={snapshot.score} />
    </View>
  );
}

/**
 * The web address this snapshot is published at.
 *
 * Built from the API's own origin, because that is the only host this build
 * knows about — a share that pointed at a hardcoded domain would send people to
 * whichever deployment somebody typed into this file.
 */
function publicUrlFor(publicId: string): string {
  return `${CONSTANTS.API_URL.replace(/\/api\/?$/, '')}/p/${publicId}`;
}
