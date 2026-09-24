/**
 * Projects on the server — the web app's dashboard.
 *
 * Every import in the web app ends in `newProject(...)` and a navigation, which
 * is why they live on the dashboard rather than in the editor's own title bar:
 * an Import menu inside a project could only throw you out of the project you
 * had open. The same reasoning holds here.
 *
 * The *project list* requires a server and an account, and says which is
 * missing rather than showing an empty list either way. **Import does not, and
 * used to be gated behind both.** MIDI, MusicXML and a tracker module are
 * decoded on the device by `useImport` and become a local document; nothing
 * about them needs a row on a server. They were inside `ProjectList`, which
 * only renders for a signed-in user with a server configured — and since this
 * app opens straight into a scratch document, the empty state in `EditorScreen`
 * that also carries them is never reached. Measured on Android: a signed-out
 * install could not open a file of any kind, on a build whose whole premise
 * (`App.tsx` has no auth gate) is that a local document needs no account.
 * Audio is the one exception and stays behind the gate, because it is
 * transcribed server-side.
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
import type { NewProjectSubmission } from '@sudobility/music_lib';
import type { ProjectSummary } from '@sudobility/music_types';
import { useAuth } from '@/auth/AuthContext';
import { getMusicClient } from '@/config/server';
import type { NativeUploadFile } from '@sudobility/music_client';
import { useServerContext } from '@/config/useServerContext';
import { ImportButtons } from '@/features/documents/ImportButtons';
import { NewProjectSheet } from '@/features/projects/NewProjectSheet';
import {
  ServerProjectCreationFeedback,
  useServerProjectCreation,
} from '@/features/projects/useServerProjectCreation';
import { SyncToServerButton } from '@/features/documents/SyncToServerButton';
import {
  ScreenScaffold,
  ServerUnavailable,
  SignInRequired,
} from './ScreenScaffold';

export type DashboardScreenProps = {
  /**
   * Overrides how opening a project is handled. Defaults to navigating this
   * screen's own stack to `Editor` — the phone/tablet route, where Dashboard
   * is a screen in the same navigator as the one it opens into.
   *
   * The desktop Projects window (`ProjectsWindow.tsx`) passes one: it has no
   * `Editor` screen of its own — it is a *separate* native window from the
   * one that does — so "opening" a project there means activating it in the
   * document list both windows share and bringing the other window forward,
   * not a navigation this stack could perform.
   */
  onOpenProject?: (id: string) => void;
};

export function DashboardScreen({ onOpenProject }: DashboardScreenProps = {}) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const context = useServerContext();

  const openProject = useCallback(
    (id: string) =>
      onOpenProject
        ? onOpenProject(id)
        : navigation.navigate('Editor', { projectId: id }),
    [navigation, onOpenProject],
  );

  if (!context) {
    return (
      <ScreenScaffold title={t('nav.projects')}>
        {/*
          Above the gate on purpose: a MIDI, MusicXML or module file is decoded
          here and becomes a local document, so it is available with no server
          and no account. `onTranscribeAudio` is left off, which is what makes
          the sheet say a recording cannot be transcribed rather than offering
          a button that fails.
        */}
        <ImportButtons />
        <ServerUnavailable />
      </ScreenScaffold>
    );
  }
  if (!user) {
    return (
      <ScreenScaffold title={t('nav.projects')}>
        <ImportButtons />
        <SignInRequired onSignIn={() => navigation.navigate('SignIn')} />
      </ScreenScaffold>
    );
  }
  return (
    <ProjectList
      context={context}
      onOpen={openProject}
      onOpened={openProject}
      onOpenCredits={() => navigation.navigate('Credits')}
    />
  );
}

function ProjectList({
  context,
  onOpen,
  onOpened,
  onOpenCredits,
}: {
  context: NonNullable<ReturnType<typeof useServerContext>>;
  onOpen: (id: string) => void;
  /** Opens the project a finished upload created. */
  onOpened: (id: string) => void;
  onOpenCredits: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useProjects(context);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  /**
   * Turns what the sheet asked for into a project on the server, then opens it.
   *
   * The same shape as the web dashboard's, including the rule that a refused
   * job **deletes the project it just created** (`createServerProject`), that
   * a 402 opens the paywall rather than failing silently, and that the sheet
   * closes either way (`useServerProjectCreation`).
   */
  const creation = useServerProjectCreation();
  const { create } = creation;
  const createProject = useCallback(
    async (submission: NewProjectSubmission) => {
      const projectId = await create(submission);
      setNewProjectOpen(false);
      if (projectId === null) return;
      await refetch();
      onOpened(projectId);
    },
    [create, refetch, onOpened],
  );

  /**
   * Uploads a recording and lets it transcribe in the background.
   *
   * The score does not exist yet when this returns: the project is created in
   * a `transcribing` state and fills itself in when the job lands. Unlike a
   * generation, this does **not** open the editor straight away — a
   * transcription runs for minutes, not seconds, and a reader dropped into a
   * project with nothing in it yet has no way to tell "still working" from
   * "came back empty". The list shows it as transcribing instead (see
   * `renderItem` below), and opening it is refused until it lands.
   */
  const transcribeAudio = useCallback(
    async (file: NativeUploadFile) => {
      const client = getMusicClient();
      // Read now rather than at render: the button is only offered with a
      // server behind it, but the session can still have ended since.
      const token = await context.getToken?.();
      if (!client || !token) return;
      await client.transcribeAudio(file, file.name, token);
      await refetch();
    },
    [context, refetch],
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
        renderItem={({ item }: { item: ProjectSummary }) => {
          // A `generating` or `transcribing` project has no finished score to
          // open yet — the editor would show whatever is there so far (for
          // transcription, minutes of nothing) with no way to tell "still
          // working" from "came back empty". Refused here instead, at the one
          // place that already knows every project's status without an extra
          // fetch.
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
              // macOS has no synthesized-touch fallback for an assistive press,
              // so a VoiceOver activation reaches a Pressable only through
              // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
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
      <NewProjectSheet
        open={newProjectOpen}
        submitting={creation.creating}
        outOfCredits={creation.outOfCredits}
        onClose={() => setNewProjectOpen(false)}
        onSubmit={submission => void createProject(submission)}
      />
      <ServerProjectCreationFeedback
        creation={creation}
        onOpenCredits={onOpenCredits}
      />
    </View>
  );
}
