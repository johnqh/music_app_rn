/**
 * Published scores, browsable without an account.
 *
 * One of the two screens the web app renders **signed out** — somebody deciding
 * whether to sign up has to be able to see what other people made. It needs a
 * server but not a session, which is why it checks those two separately.
 *
 * **Tiles in a grid, as My Projects draws its projects** — the same card and
 * the same arithmetic for how many across (`tileGrid`, over the width this is
 * given). What differs is what each is: a shared score has a person behind it,
 * so their picture and nickname head the tile, and it is somebody else's, so
 * it has no Duplicate and no Delete.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Button, SearchInput, Spinner, Text } from '@sudobility/components-rn';
import { PressableCard } from '@/components/controls/PressableCard';
import {
  communityItemTitle,
  communityListState,
} from '@sudobility/music_types';
import { monogramFor } from '@sudobility/music_lib';
import { TILE_GAP, tileGrid } from '@/features/projects/ProjectTiles';
import {
  SCREEN_MAX_WIDTH,
  SCREEN_WIDTH_STYLE,
} from '@/components/layout/EmbeddedScreen';
import { getMusicClient } from '@/config/server';
import type { RootStackParamList } from '@/app/Navigation';
import type { CommunityItem } from '@sudobility/music_types';
import { ScreenScaffold, ServerUnavailable } from './ScreenScaffold';
import { TitledScreen } from '@/components/layout/SplitViewContainer';

/** How wide the publisher's picture is drawn, in points. */
const AVATAR_SIZE = 32;

/**
 * The publisher's picture, in a circle — or their initial, when they have none.
 *
 * Hidden from a screen reader: the name is printed beside it, and the tile's
 * own label already says who shared the score.
 */
function PublisherAvatar({
  name,
  pictureUrl,
}: {
  name: string;
  pictureUrl: string | null;
}) {
  /*
    A picture that will not load falls back to the initial too. The name of a
    picture is replaced whenever its owner changes it, so a list fetched a
    moment before can point at one that is gone.
  */
  const [broken, setBroken] = useState(false);
  const circle = {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  };
  if (pictureUrl && !broken) {
    return (
      <Image
        testID="publisher-picture"
        source={{ uri: pictureUrl }}
        accessibilityElementsHidden
        importantForAccessibility="no"
        onError={() => setBroken(true)}
        style={circle}
      />
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="border-border bg-muted items-center justify-center border"
      style={circle}
    >
      <Text className="text-muted-foreground text-sm font-medium">
        {monogramFor(name)}
      </Text>
    </View>
  );
}

export function CommunityScreen() {
  const { t } = useTranslation();
  return (
    <TitledScreen title={t('nav.community')}>
      <CommunityList />
    </TitledScreen>
  );
}

function CommunityList() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const client = getMusicClient();
  const [items, setItems] = useState<CommunityItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  // The width this is given, never the window's. One column until measured.
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);
  // The grid is no wider than a screen's content is, however wide the window.
  const { columns, tileWidth } = tileGrid(Math.min(width, SCREEN_MAX_WIDTH));

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
    <View
      className="bg-background flex-1"
      onLayout={onLayout}
      testID="community-tiles"
    >
      <FlatList<CommunityItem>
        // A FlatList cannot change how many columns it has; one that can is
        // a different list.
        key={columns}
        // Clears the tab bar; see `ScreenScaffold`.
        contentInsetAdjustmentBehavior="automatic"
        data={[...list.visible]}
        numColumns={columns}
        keyExtractor={(item: CommunityItem) => item.publicId}
        contentContainerStyle={{
          ...SCREEN_WIDTH_STYLE,
          padding: TILE_GAP,
          gap: TILE_GAP,
        }}
        {...(columns > 1 ? { columnWrapperStyle: { gap: TILE_GAP } } : {})}
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
              Three different empty states, because they mean different things:
              a failed load, a community with nothing in it, and a search that
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
          // `communityItemTitle`, not `publicName || name`: a public title of
          // spaces is truthy and printed an empty tile.
          const title = communityItemTitle(item);
          const pictureUrl = item.publisherAvatarId
            ? client.avatarUrl(item.publisherAvatarId)
            : null;
          return (
            <View
              testID="community-tile"
              style={columns > 1 ? { width: tileWidth } : undefined}
            >
              <PressableCard
                // "Title, by Ada": a name under a picture reads as who shared
                // it, but read aloud after a title it could be the composer,
                // which is a different person.
                label={
                  item.publisherName
                    ? `${title}, ${t('community.sharedBy', {
                        name: item.publisherName,
                      })}`
                    : title
                }
                onPress={activate}
              >
                <View className="flex-row items-center gap-2 pb-2">
                  <PublisherAvatar
                    name={item.publisherName}
                    pictureUrl={pictureUrl}
                  />
                  <Text
                    className="text-muted-foreground flex-1 text-sm"
                    numberOfLines={1}
                  >
                    {item.publisherName}
                  </Text>
                </View>
                <Text className="text-foreground font-medium" numberOfLines={2}>
                  {title}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </PressableCard>
            </View>
          );
        }}
      />
    </View>
  );
}
