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
import { ScreenScaffold, ServerUnavailable } from './ScreenScaffold';

export function PublishedScreen() {
  const { t } = useTranslation();
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

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 py-2">
        <Text className="text-foreground font-medium">
          {snapshot.publicName || snapshot.name}
        </Text>
        <Text className="text-muted-foreground text-xs">
          {t('published.by', { name: snapshot.publisherName })}
        </Text>
      </View>
      {/* No `onMeasureTap`: there is no caret to aim on a page you cannot edit. */}
      <ScrollingScore score={snapshot.score} />
    </View>
  );
}
