/**
 * Published scores, browsable without an account.
 *
 * One of the two screens the web app renders **signed out** — somebody deciding
 * whether to sign up has to be able to see what other people made. It needs a
 * server but not a session, which is why it checks those two separately.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Spinner, Text } from '@sudobility/components-rn';
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

  const load = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      // No token: `music_api` mounts the public routes outside its auth
      // middleware precisely so this screen works signed out.
      setItems(await client.listCommunity());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      data={items}
      keyExtractor={(item: CommunityItem) => item.publicId}
      ListEmptyComponent={
        <Text className="text-muted-foreground py-8 text-center">
          {error ?? t('community.empty')}
        </Text>
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
            <Text className="text-muted-foreground text-xs">
              {item.publisherName}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}
