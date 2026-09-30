/**
 * Projects, as master and detail: a list and whichever pane it has
 * selected — see `paneKey.ts` for the set and `ProjectsSidebar.tsx` for
 * why Connect and My Projects are one slot, not two. The split view is
 * `sudojo_app_rn`'s (`SplitViewContainer`), as its Techniques tab uses it:
 * the list under a navigation bar of its own, and the chosen pane beside it
 * under another.
 *
 * One component in two places. On macOS and Windows it is the content of the
 * separate Projects window (`ProjectsWindow.tsx`); on iOS and Android it is
 * the Projects tab (`ProjectsScreen.tsx`). What differs is what happens once
 * a project is open, so that is the caller's: `onProjectOpened` and
 * `onOpenCredits`.
 *
 * **Left by opening a project, never by anything drawn here.** New,
 * Template, an existing project chosen from My Projects, and every format
 * under Import all funnel through `onProjectOpened` — on a desktop it
 * focuses the main window and dismisses this one, under a tab bar it pushes
 * the editor — so picking a project always lands the reader somewhere they
 * can see it. Signing in is deliberately not on that list: it only swaps
 * which slot the sidebar's first item is.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import type { ProjectTemplate } from '@sudobility/music_lib';
import type { NewProjectSubmission } from '@/features/projects/useNewProjectForm';
import { newDocument, openProjectInto } from '@/documents/document';
import {
  useActiveDocument,
  useDocumentList,
  useDocumentServices,
  useDocuments,
} from '@/documents/DocumentsContext';
import {
  ServerProjectCreationFeedback,
  useServerProjectCreation,
} from '@/features/projects/useServerProjectCreation';
import { useAuth } from '@/auth/AuthContext';
import { useServerContext } from '@/config/useServerContext';
import {
  SplitPanel,
  SplitViewContainer,
} from '@/components/layout/SplitViewContainer';
import { SignInView } from '@/features/account/SignInView';
import { ScreenScaffold } from '@/screens/ScreenScaffold';
import { useSingleDocumentGuard } from '@/features/documents/useSingleDocumentGuard';
import { ProjectsSidebar, paneLabelKey } from './ProjectsSidebar';
import { MyProjectsPane } from './MyProjectsPane';
import { NewPane } from './NewPane';
import { TemplatePane } from './TemplatePane';
import { ImportPane } from './ImportPane';
import { OpenDocumentsPane } from './OpenDocumentsPane';
import type { PaneKey } from './paneKey';

export type ProjectsSplitViewProps = {
  /** A document was opened, and is the active one: show it. */
  onProjectOpened: () => void;
  /** The reader is out of credits and asked where to get more. */
  onOpenCredits: () => void;
  /**
   * A pane asked for from outside — the editor's popup of this sidebar.
   * `at` tells one request from the next: asking for the same pane twice is
   * two requests, and the second must win over a choice made in between.
   */
  requested?: { pane: PaneKey; at: number } | undefined;
  /**
   * Whether one project is open at a time, as under a tab bar. The open one
   * is then offered in the list (`paneKey.ts`), and opening another asks
   * before it closes work that has nowhere to be saved.
   */
  single?: boolean;
};

export function ProjectsSplitView({
  onProjectOpened: projectOpened,
  onOpenCredits,
  requested,
  single = false,
}: ProjectsSplitViewProps) {
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

  const requestedPane = requested?.pane;
  const requestedAt = requested?.at;
  useEffect(() => {
    if (requestedPane !== undefined) setSelected(requestedPane);
  }, [requestedPane, requestedAt]);

  const { documents } = useDocuments();
  const offersOpen = single && documents.length > 0;
  const { guard, prompt } = useSingleDocumentGuard(single);
  // The last open document was closed while its pane was showing.
  useEffect(() => {
    if (!offersOpen && selected === 'open') setSelected('new');
  }, [offersOpen, selected]);

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
    // Paints the root itself (`SplitView`'s `bg-background`): nothing did
    // before, so the native window's own default colour showed everywhere a
    // pane didn't paint its own (only `ScreenScaffold`'s `ScrollView` did,
    // which is why Connect's sign-in box looked like a different colour from
    // the window around it, rather than every pane looking that way equally).
    <>
      <SplitViewContainer
        primaryPanel={
          <SplitPanel title={t('nav.projects')}>
            <ProjectsSidebar
              selected={selected}
              signedIn={signedIn}
              showOpen={offersOpen}
              onSelect={setSelected}
            />
          </SplitPanel>
        }
        secondaryPanel={
          <SplitPanel secondary title={t(paneLabelKey(selected))}>
            {selected === 'connect' ? (
              // The form places itself: no wider than 360 and centred,
              // with nothing painted behind it, so the pane's own background
              // is what shows. The scaffold is the scroller and the padding.
              <ScreenScaffold>
                <SignInView />
              </ScreenScaffold>
            ) : null}
            {selected === 'myProjects' ? (
              <MyProjectsPane onOpen={id => guard(() => openExisting(id))} />
            ) : null}
            {selected === 'new' ? (
              <NewPane
                generationAvailable={canGenerate}
                outOfCredits={creation.outOfCredits}
                submitting={creation.creating}
                onSubmit={submission => guard(() => submitNew(submission))}
              />
            ) : null}
            {selected === 'template' ? (
              <TemplatePane
                onChoose={template => guard(() => chooseTemplate(template))}
              />
            ) : null}
            {selected === 'import' ? (
              <ImportPane onOpened={projectOpened} guard={guard} />
            ) : null}
            {selected === 'open' ? (
              <OpenDocumentsPane
                onOpen={document => {
                  list.activate(document.id);
                  projectOpened();
                }}
              />
            ) : null}
          </SplitPanel>
        }
      />
      {prompt}
      <ServerProjectCreationFeedback
        creation={creation}
        onOpenCredits={onOpenCredits}
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
    </>
  );
}
