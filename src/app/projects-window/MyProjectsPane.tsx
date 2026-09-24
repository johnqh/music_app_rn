/**
 * The desktop Projects window's My Projects pane — what the sidebar's
 * Connect item turns into once signed in (`ProjectsSidebar.tsx`).
 *
 * A trimmed `DashboardScreen`'s `ProjectList`: the same fetch
 * (`useProjects`) and the same row (name, updated time, a `generating`/
 * `transcribing` project refuses to open, exactly as the phone/tablet
 * dashboard's does), without that screen's own New Project button and
 * Import menu — this window's sidebar is where both of those live now, and
 * offering them a second time here would be the same entry point twice.
 */
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, Spinner, Text } from '@sudobility/components-rn';
import { useProjects } from '@sudobility/music_client';
import type { ProjectSummary } from '@sudobility/music_types';
import { useServerContext } from '@/config/useServerContext';
import { ServerUnavailable } from '@/screens/ScreenScaffold';

export type MyProjectsPaneProps = {
  /** A ready project was chosen. */
  onOpen: (id: string) => void;
};

export function MyProjectsPane({ onOpen }: MyProjectsPaneProps) {
  const context = useServerContext();

  if (!context) {
    return (
      <View className="p-4">
        <ServerUnavailable />
      </View>
    );
  }

  return <ProjectListing context={context} onOpen={onOpen} />;
}

function ProjectListing({
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
      <View className="items-center py-8">
        <Spinner />
      </View>
    );
  }
  if (error) {
    return (
      <View className="items-center gap-2 py-8">
        <Text className="text-destructive">{t('errors.loadProjects')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refetch()}
          onAccessibilityTap={() => void refetch()}
        >
          <Text className="text-primary">{t('library.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const projects = data ?? [];
  return (
    <FlatList
      data={projects}
      keyExtractor={(p: ProjectSummary) => p.id}
      accessibilityLabel={t('dashboard.myProjects')}
      contentContainerClassName="p-4 gap-2"
      ListEmptyComponent={
        <Text className="text-muted-foreground py-8 text-center">
          {t('dashboard.empty')}
        </Text>
      }
      renderItem={({ item }: { item: ProjectSummary }) => {
        // A `generating` or `transcribing` project has no finished score to
        // open yet — the same refusal `DashboardScreen`'s list makes.
        const busy = item.status !== 'ready';
        const activate = () => {
          if (!busy) onOpen(item.id);
        };
        const statusLabel =
          item.status === 'transcribing'
            ? t('dashboard.transcribing')
            : item.status === 'generating'
            ? t('dashboard.generating')
            : null;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ disabled: busy }}
            onPress={activate}
            onAccessibilityTap={activate}
            className="border-border bg-card rounded-lg border p-3"
            style={{ minHeight: MIN_TOUCH_TARGET, opacity: busy ? 0.6 : 1 }}
          >
            <Text className="text-foreground font-medium">{item.name}</Text>
            <Text className="text-muted-foreground text-sm">
              {new Date(item.updatedAt).toLocaleString()}
            </Text>
            {statusLabel ? (
              <Text className="text-info mt-1 text-sm">{statusLabel}</Text>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}
