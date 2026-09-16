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
import {
  Button,
  MIN_TOUCH_TARGET,
  SearchInput,
  Spinner,
  Text,
} from '@sudobility/components-rn';
import {
  communityItemTitle,
  communityListState,
} from '@sudobility/music_types';
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
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  /*
    Which state the list is in, and the rows it shows, are music_types'
    `communityListState` — the web page's own call. Filtered on the client,
    over the list already fetched, which is honest at this size.
  */
  const list = useMemo(
    () => communityListState(items, query, failed),
    [items, query, failed],
  );

  const load = useCallback(async () => {
    if (!client) return;
    setFailed(false);
    try {
      // No token: `music_api` mounts the public routes outside its auth
      // middleware precisely so this screen works signed out.
      setItems(await client.listCommunity());
    } catch {
      // A message about *this list*, not a raw network string: "fetch failed"
      // tells a reader nothing they can act on.
      setFailed(true);
      setItems([]);
    }
  }, [client]);

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
  if (list.kind === 'loading') {
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
      data={[...list.visible]}
      keyExtractor={(item: CommunityItem) => item.publicId}
      ListHeaderComponent={
        <View className="gap-2 pb-2">
          <Text className="text-muted-foreground text-base">
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
            {list.kind === 'failed'
              ? t('community.loadFailed')
              : list.kind === 'noMatch'
              ? t('community.noMatch', { query })
              : t('community.empty')}
          </Text>
          {list.kind === 'empty' ? (
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Resources')}
            >
              {t('community.browseResources')}
            </Button>
          ) : null}
        </View>
      }
      renderItem={({ item }: { item: CommunityItem }) => {
        const activate = () =>
          navigation.navigate('Published', { publicId: item.publicId });
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={communityItemTitle(item)}
            onPress={activate}
            // macOS has no synthesized-touch fallback for an assistive press, so
            // a VoiceOver activation reaches a Pressable only through
            // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
            onAccessibilityTap={activate}
            className="border-border bg-card rounded-lg border p-3"
            style={{ minHeight: MIN_TOUCH_TARGET }}
          >
            {/*
            `communityItemTitle`, not `publicName || name`: a public title of
            spaces is truthy and printed an empty row.
          */}
            <Text className="text-foreground font-medium">
              {communityItemTitle(item)}
            </Text>
            {item.publisherName ? (
              // "Shared by X", not a bare name: on its own a name under a title
              // reads as a composer, which is a different person.
              <Text className="text-muted-foreground text-sm">
                {t('community.sharedBy', { name: item.publisherName })}
              </Text>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}
