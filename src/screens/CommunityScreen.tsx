/**
 * Published scores, browsable without an account.
 *
 * One of the two screens the web app renders **signed out** — somebody deciding
 * whether to sign up has to be able to see what other people made. It needs a
 * server but not a session, which is why it checks those two separately.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Button, SearchInput, Spinner, Text } from '@sudobility/components-rn';
import { filterCommunity } from '@sudobility/music_types';
import { getMusicClient } from '@/config/server';
import type { RootStackParamList } from '@/app/Navigation';
import type { CommunityItem } from '@sudobility/music_types';
import { ScreenScaffold, ServerUnavailable } from './ScreenScaffold';

export function CommunityScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const client = getMusicClient();
  const [items, setItems] = useState<CommunityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /*
    Filtered on the client, over the list already fetched — honest at this size,
    where the screen shows what one request returned. The predicate is
    music_types', shared with the web page, so the same search finds the same
    music in both apps.
  */
  const visible = useMemo(
    () => filterCommunity(items ?? [], query),
    [items, query],
  );

  const load = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      // No token: `music_api` mounts the public routes outside its auth
      // middleware precisely so this screen works signed out.
      setItems(await client.listCommunity());
    } catch {
      // A message about *this list*, not a raw network string: "fetch failed"
      // tells a reader nothing they can act on.
      setError(t('community.loadFailed'));
      setItems([]);
    }
  }, [client, t]);

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
  if (items === null) {
    return (
      <ScreenScaffold>
        <View className="items-center py-8">
          <Spinner />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <FlatList<CommunityItem>
      className="bg-background flex-1"
      contentContainerClassName="p-4 gap-2"
      data={visible}
      keyExtractor={(item: CommunityItem) => item.publicId}
      ListHeaderComponent={
        <View className="gap-2 pb-2">
          <Text className="text-muted-foreground text-sm">
            {t('community.intro')}
          </Text>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('community.searchPlaceholder')}
            accessibilityLabel={t('community.searchLabel')}
          />
        </View>
      }
      ListEmptyComponent={
        <View className="items-center gap-3 py-8">
          {/*
            Three different empty states, because they mean different things: a
            failed load, a community with nothing in it, and a search that
            matched nothing. Collapsing them would tell a reader who mistyped
            that nobody has published anything.
          */}
          <Text className="text-muted-foreground text-center">
            {error ??
              (query.trim()
                ? t('community.noMatch', { query })
                : t('community.empty'))}
          </Text>
          {!error && !query.trim() ? (
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Resources')}
            >
              {t('community.browseResources')}
            </Button>
          ) : null}
        </View>
      }
      renderItem={({ item }: { item: CommunityItem }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.publicName || item.name}
          onPress={() =>
            navigation.navigate('Published', { publicId: item.publicId })
          }
          className="border-border bg-card rounded-lg border p-3"
        >
          <Text className="text-foreground font-medium">
            {item.publicName || item.name}
          </Text>
          {item.publisherName ? (
            // "Shared by X", not a bare name: on its own a name under a title
            // reads as a composer, which is a different person.
            <Text className="text-muted-foreground text-xs">
              {t('community.sharedBy', { name: item.publisherName })}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}
