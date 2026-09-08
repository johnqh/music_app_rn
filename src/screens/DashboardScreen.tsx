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
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/Navigation';
import { useTranslation } from 'react-i18next';
import {
  Button,
  MIN_TOUCH_TARGET,
  Spinner,
  Text,
} from '@sudobility/components-rn';
import { useProjects } from '@sudobility/music_client';
import { emptyScoreForRequest } from '@sudobility/music_lib';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import type { ProjectSummary } from '@sudobility/music_types';
import { useAuth } from '@/auth/AuthContext';
import { getMusicClient } from '@/config/server';
import type { NativeUploadFile } from '@sudobility/music_client';
import { useServerContext } from '@/config/useServerContext';
import { ImportButtons } from '@/features/documents/ImportButtons';
import { NewProjectSheet } from '@/features/projects/NewProjectSheet';
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
  return (
    <ProjectList
      context={context}
      onOpen={openProject}
      onOpened={openProject}
    />
  );
}

function ProjectList({
  context,
  onOpen,
  onOpened,
}: {
  context: NonNullable<ReturnType<typeof useServerContext>>;
  onOpen: (id: string) => void;
  /** Opens the project a finished upload created. */
  onOpened: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useProjects(context);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  /**
   * Turns what the sheet asked for into a project on the server, then opens it.
   *
   * The same shape as the web dashboard's, including the rule that a refused
   * job **deletes the project it just created**: that project exists only to
   * hold the generation, and without this a user with no credits collects an
   * empty "Generated score" row on every attempt.
   */
  const createProject = useCallback(
    async (submission: NewProjectSubmission) => {
      const client = getMusicClient();
      // The sheet is only offered with a server behind it, but the token can
      // still have expired between render and press.
      if (!client || !context.token) return;
      setCreating(true);
      try {
        if (submission.kind === 'blank') {
          const project = await client.createProject(
            { name: submission.title, score: submission.score },
            context.token,
          );
          setNewProjectOpen(false);
          await refetch();
          onOpened(project.id);
          return;
        }
        /*
          Created up front rather than on completion, so it appears in this list
          with its badge from the first second instead of materialising minutes
          later. Not named after the prompt: prompts routinely begin "Create
          a ...", which makes a list of near-identical names.
        */
        const project = await client.createProject(
          {
            name: submission.request.title?.trim() || 'Generated score',
            score: emptyScoreForRequest(submission.request),
          },
          context.token,
        );
        try {
          await client.createJob(
            {
              projectId: project.id,
              kind: 'generate-score',
              request: submission.request,
            },
            context.token,
          );
        } catch (jobError) {
          await client.deleteProject(project.id, context.token).catch(() => {
            // Best effort: the refusal is what the user needs to hear about.
          });
          throw jobError;
        }
        setNewProjectOpen(false);
        await refetch();
        onOpened(project.id);
      } finally {
        setCreating(false);
      }
    },
    [context.token, refetch, onOpened],
  );

  /**
   * Uploads a recording and opens the project it makes.
   *
   * The score does not exist yet when this returns: the project is created in a
   * `transcribing` state and fills itself in when the job lands, which is why
   * the editor is opened straight away rather than waited for — the same shape
   * as a generation, and the editor already knows how to show one running.
   */
  const transcribeAudio = useCallback(
    async (file: NativeUploadFile) => {
      const client = getMusicClient();
      // The button is only offered with a server behind it, but the token can
      // still have expired between render and press.
      if (!client || !context.token) return;
      const saved = await client.transcribeAudio(
        file,
        file.name,
        context.token,
      );
      await refetch();
      onOpened(saved.id);
    },
    [context.token, refetch, onOpened],
  );

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
            <Button onPress={() => setNewProjectOpen(true)}>
              {t('dashboard.newProject')}
            </Button>
            {/*
              Import lives here because every import makes a *new* document:
              an Import control inside a project could only throw you out of
              the project you had open.
            */}
            <ImportButtons onTranscribeAudio={transcribeAudio} />
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
            style={{ minHeight: MIN_TOUCH_TARGET }}
          >
            <Text className="text-foreground font-medium">{item.name}</Text>
            <Text className="text-muted-foreground text-sm">
              {new Date(item.updatedAt).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
      <NewProjectSheet
        open={newProjectOpen}
        submitting={creating}
        onClose={() => setNewProjectOpen(false)}
        onSubmit={submission => void createProject(submission)}
      />
    </View>
  );
}
