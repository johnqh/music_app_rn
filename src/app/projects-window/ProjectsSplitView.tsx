/**
 * The desktop Projects window's content: a sidebar and whichever pane it
 * has selected — see `paneKey.ts` for the set and `ProjectsSidebar.tsx` for
 * why Connect and My Projects are one slot, not two.
 *
 * **Dismissed by opening a project, never by anything drawn here.** New,
 * Template, an existing project chosen from My Projects, and every format
 * under Import all funnel through `projectOpened`, which focuses the main
 * window (`focusMainWindow`) and dismisses this one (`closeProjectsWindow`)
 * — the same two calls, so picking a project always lands the reader
 * somewhere they can see it and never leaves this window stranded open
 * behind it. Signing in is deliberately not on that list: it only swaps
 * which slot the sidebar's first item is.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import type { ProjectTemplate } from '@sudobility/music_lib';
import type { NewProjectSubmission } from '@/features/projects/useNewProjectForm';
import { newDocument, openProjectInto } from '@/documents/document';
import {
  useActiveDocument,
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';
import {
  ServerProjectCreationFeedback,
  useServerProjectCreation,
} from '@/features/projects/useServerProjectCreation';
import { useAuth } from '@/auth/AuthContext';
import { useServerContext } from '@/config/useServerContext';
import { navigationRef } from '@/app/Navigation';
import {
  closeProjectsWindow,
  focusMainWindow,
} from '@/platform/projectsWindow';
import { SignInScreen } from '@/screens/SignInScreen';
import { ProjectsSidebar } from './ProjectsSidebar';
import { MyProjectsPane } from './MyProjectsPane';
import { NewPane } from './NewPane';
import { TemplatePane } from './TemplatePane';
import { ImportPane } from './ImportPane';
import type { PaneKey } from './paneKey';

export function ProjectsSplitView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const serverContext = useServerContext();
  const list = useDocumentList();
  const services = useDocumentServices();
  // Unused directly, but reading it keeps this component subscribed to the
  // same document-list changes `useActiveDocument` consumers elsewhere react
  // to — cheap insurance against a future pane needing "what's open" without
  // remembering to add the subscription back.
  useActiveDocument();
  const creation = useServerProjectCreation();
  const [selected, setSelected] = useState<PaneKey>('new');
  const [failure, setFailure] = useState<string | null>(null);

  const signedIn = user !== null;
  // A model writes into a project on the server, so generating needs an
  // account with a server behind it — the same rule `MenuFileCommands`'s
  // File-menu New uses.
  const canGenerate = signedIn && serverContext !== null;

  /*
    Keeps the sidebar's first slot pointed at whichever half of it is valid
    right now, rather than leaving a reader looking at a Connect pane they
    just used, or a My Projects pane behind a session that just ended.
  */
  useEffect(() => {
    if (signedIn && selected === 'connect') setSelected('myProjects');
    if (!signedIn && selected === 'myProjects') setSelected('connect');
  }, [signedIn, selected]);

  const projectOpened = useCallback(() => {
    focusMainWindow();
    closeProjectsWindow();
  }, []);

  const openExisting = useCallback(
    (id: string) => {
      openProjectInto(list, services, id)
        .then(() => projectOpened())
        .catch((error: unknown) =>
          setFailure(error instanceof Error ? error.message : String(error)),
        );
    },
    [list, services, projectOpened],
  );

  const submitNew = useCallback(
    (submission: NewProjectSubmission) => {
      if (submission.kind === 'blank') {
        list.open(
          newDocument(services, {
            score: submission.score,
            title: submission.title,
          }),
        );
        projectOpened();
        return;
      }
      void creation.create(submission).then(projectId => {
        if (projectId === null) return;
        openProjectInto(list, services, projectId)
          .then(() => projectOpened())
          .catch((error: unknown) =>
            setFailure(error instanceof Error ? error.message : String(error)),
          );
      });
    },
    [list, services, creation, projectOpened],
  );

  const chooseTemplate = useCallback(
    (template: ProjectTemplate) => {
      list.open(
        newDocument(services, {
          score: template.build(),
          title: template.name,
        }),
      );
      projectOpened();
    },
    [list, services, projectOpened],
  );

  return (
    // The window's only background: nothing painted the root before, so the
    // native window's own default colour showed everywhere a pane didn't
    // paint its own (only `ScreenScaffold`'s `ScrollView` did, which is why
    // Connect's sign-in box looked like a different colour from the window
    // around it, rather than every pane looking that way equally).
    <View className="bg-background flex-1 flex-row">
      <ProjectsSidebar
        selected={selected}
        signedIn={signedIn}
        onSelect={setSelected}
      />
      <View className="flex-1">
        {selected === 'connect' ? (
          // `SignInScreen` is shared with phone/tablet, where filling the
          // width is correct — this pane is desktop-wide, and a form that
          // stretches to match just makes the two fields harder to read.
          // Capping and centering it here, rather than inside the shared
          // screen, keeps that phone/tablet layout untouched.
          <View className="flex-1 items-center p-6">
            <View className="w-full max-w-sm flex-1">
              <SignInScreen />
            </View>
          </View>
        ) : null}
        {selected === 'myProjects' ? (
          <MyProjectsPane onOpen={openExisting} />
        ) : null}
        {selected === 'new' ? (
          <NewPane
            generationAvailable={canGenerate}
            outOfCredits={creation.outOfCredits}
            submitting={creation.creating}
            onSubmit={submitNew}
          />
        ) : null}
        {selected === 'template' ? (
          <TemplatePane onChoose={chooseTemplate} />
        ) : null}
        {selected === 'import' ? <ImportPane onOpened={projectOpened} /> : null}
      </View>
      <ServerProjectCreationFeedback
        creation={creation}
        onOpenCredits={() => {
          // Credits lives in the main window's own navigator — there is no
          // Credits pane here — so reaching it is the same two-step handoff
          // every other "a project opened" path uses, minus the close: the
          // reader came here to buy credits, not to finish picking a project.
          focusMainWindow();
          if (navigationRef.isReady()) navigationRef.navigate('Credits');
        }}
      />
      <FormModal
        visible={failure !== null}
        title={t('errors.openProject')}
        onClose={() => setFailure(null)}
        onSave={() => setFailure(null)}
        saveLabel={t('common.ok')}
        closeAriaLabel={t('common.closeDialog')}
      >
        <Text className="text-foreground text-base">{failure}</Text>
      </FormModal>
    </View>
  );
}
