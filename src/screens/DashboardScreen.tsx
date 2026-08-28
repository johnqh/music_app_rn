/**
 * Projects on the server — the web app's dashboard.
 *
 * Every import in the web app ends in `newProject(...)` and a navigation, which
 * is why they live on the dashboard rather than in the editor's own title bar:
 * an Import menu inside a project could only throw you out of the project you
 * had open. The same reasoning holds here.
 *
 * Requires a server *and* an account, and says which is missing rather than
 * showing an empty list either way.
 */
import { useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/Navigation';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, Text } from '@sudobility/components-rn';
import { useProjects } from '@sudobility/music_client';
import type { ProjectSummary } from '@sudobility/music_types';
import { useAuth } from '@/auth/AuthContext';
import { useServerContext } from '@/config/useServerContext';
import { ImportButtons } from '@/features/documents/ImportButtons';
import { SyncToServerButton } from '@/features/documents/SyncToServerButton';
import {
  ScreenScaffold,
  ServerUnavailable,
  SignInRequired,
} from './ScreenScaffold';

export function DashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const context = useServerContext();

  const openProject = useCallback(
    (id: string) => navigation.navigate('Editor', { projectId: id }),
    [navigation],
  );

  if (!context) {
    return (
      <ScreenScaffold title={t('nav.projects')}>
        <ServerUnavailable />
      </ScreenScaffold>
    );
  }
  if (!user) {
    return (
      <ScreenScaffold title={t('nav.projects')}>
        <SignInRequired onSignIn={() => navigation.navigate('SignIn')} />
      </ScreenScaffold>
    );
  }
  return <ProjectList context={context} onOpen={openProject} />;
}

function ProjectList({
  context,
  onOpen,
}: {
  context: NonNullable<ReturnType<typeof useServerContext>>;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useProjects(context);

  if (isLoading) {
    return (
      <ScreenScaffold title={t('nav.projects')}>
        <View className="items-center py-8">
          <Spinner />
        </View>
      </ScreenScaffold>
    );
  }
  if (error) {
    return (
      <ScreenScaffold title={t('nav.projects')}>
        <Text className="text-destructive">{t('errors.loadProjects')}</Text>
        <Button onPress={() => void refetch()}>{t('library.retry')}</Button>
      </ScreenScaffold>
    );
  }

  const projects = data ?? [];
  return (
    <View className="bg-background flex-1">
      <FlatList<ProjectSummary>
        data={projects}
        keyExtractor={(p: ProjectSummary) => p.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={
          <View className="gap-3 pb-2">
            {/*
              Import lives here because every import makes a *new* document:
              an Import control inside a project could only throw you out of
              the project you had open.
            */}
            <ImportButtons />
            <SyncToServerButton />
          </View>
        }
        ListEmptyComponent={
          <Text className="text-muted-foreground py-8 text-center">
            {t('dashboard.empty')}
          </Text>
        }
        renderItem={({ item }: { item: ProjectSummary }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => onOpen(item.id)}
            className="border-border bg-card rounded-lg border p-3"
          >
            <Text className="text-foreground font-medium">{item.name}</Text>
            <Text className="text-muted-foreground text-xs">
              {new Date(item.updatedAt).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
