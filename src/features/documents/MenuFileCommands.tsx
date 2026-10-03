/**
 * The File menu's New, Open, Save and Save As.
 *
 * Mounted once above the navigator, beside `MenuImportCommands` and for the
 * same reason: these act on documents rather than on a screen, and New in
 * particular has to work from wherever you are. A third listener on the same
 * event is what the two existing ones already do — each acts on its own
 * commands and ignores the rest, which is what stops two of them acting on one
 * menu item.
 *
 * **New makes a local document, and generation is not on offer here.** A job
 * writes its result back to a project row on the server, and a local file has
 * none; offering the toggle would be offering something that cannot work. The
 * dashboard is where a generated project is started.
 *
 * **Open, Save and Save As speak the app's own `.moo` document** through the
 * document's store: `openFileDocument` reads it (and the web's JSON export)
 * with music_codecs' `parseProjectFile`, which validates on the way in — a file
 * on disk is exactly as untrusted as a network response — and `saveNow` /
 * `saveAs` write it with the same saver the autosave uses.
 *
 * **`nav.projects` and `nav.settings` live here too**, for the same "works from
 * wherever you are" reason: they are the title bar's Projects and Settings
 * buttons, which a desktop build no longer has (`AppLayout`'s `hasMenuBar()`
 * gate) — the menu is now the only route to either on macOS and Windows.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { useMenuAvailability, useMenuCommand } from '@/app/menu-commands';
import type { MenuCommand } from '@/app/menu-commands';
import {
  DOCUMENT_EXTENSION,
  DOCUMENT_EXTENSIONS,
  exportFilename,
} from '@sudobility/music_lib';
import { newDocument, openFileInto } from '@/documents/document';
import { createFilePicker } from '@/documents/file-picker';
import { createKeyValueStore } from '@/documents/rn-key-value';
import { useRecentTracking } from '@/documents/useRecentTracking';
import { useOpenLink } from '@/app/useOpenLink';
import {
  useActiveDocument,
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';
import { useScreenshotScene } from '@/features/screenshots/screenshot-scene';
import { NewProjectSheet } from '@/features/projects/NewProjectSheet';
import {
  ServerProjectCreationFeedback,
  useServerProjectCreation,
} from '@/features/projects/useServerProjectCreation';
import { navigationRef, showEditor } from '@/app/Navigation';
import { goToTab } from '@/app/tab-bar';
import { useServerContext } from '@/config/useServerContext';

const keyValue = createKeyValueStore();

const MENU_FILE_COMMANDS: readonly MenuCommand[] = [
  'file.new',
  'file.open',
  'file.save',
  'file.saveAs',
  'nav.projects',
  'nav.settings',
  'nav.docs',
];

export function MenuFileCommands() {
  const { t } = useTranslation();
  const list = useDocumentList();
  const document = useActiveDocument();
  const services = useDocumentServices();
  const recordRecent = useRecentTracking(keyValue);
  const [newOpen, setNewOpen] = useState(false);
  // The gate, the 402 paywall and the failure report are the dashboard's too.
  const creation = useServerProjectCreation();
  const serverContext = useServerContext();
  const [failure, setFailure] = useState<string | null>(null);
  /*
    A store screenshot of New Project with Generate on
    (`ScreenshotLinks.tsx`); any other scene closes the sheet. Generate needs
    an account like any other time — a debug build signs in to the `.env`
    test account by itself (`DevAutoSignIn`).
  */
  const [screenshotGenerate, setScreenshotGenerate] = useState(false);
  useScreenshotScene('new-project-sheet', scene => {
    setScreenshotGenerate(scene.screen === 'new-project' && scene.generate);
    setNewOpen(scene.screen === 'new-project');
  });

  /**
   * Writes the document somewhere the user picks.
   *
   * Also what Save falls back to for a document that has never been written:
   * the store never picks a place for one on its own — that is right for
   * autosave and wrong for a menu command, where a person is present to be
   * asked. The recent list hears about it from the store's `onSaved`, after
   * the write succeeds.
   */
  const saveAs = useCallback(async (): Promise<void> => {
    if (!document) return;
    const picker = createFilePicker();
    if (!picker.isSupported()) {
      setFailure(t('import.unsupported'));
      return;
    }
    const state = document.store.getState();
    const uri = await picker.pickSaveLocation(
      exportFilename(state.title, DOCUMENT_EXTENSION),
    );
    // Cancelling is an ordinary outcome, not a failure to report.
    if (!uri) return;
    await state.saveAs(uri);
  }, [document, t]);

  const run = useCallback(
    (command: MenuCommand): void => {
      void (async () => {
        try {
          if (command === 'nav.projects') {
            // The Projects tab of the one window the app has.
            if (navigationRef.isReady()) goToTab(navigationRef, 'Dashboard');
          } else if (command === 'nav.settings') {
            if (navigationRef.isReady()) goToTab(navigationRef, 'Settings');
          } else if (command === 'nav.docs') {
            // Help ▸ Moosiac Help.
            if (navigationRef.isReady()) goToTab(navigationRef, 'Docs');
          } else if (command === 'file.new') {
            setNewOpen(true);
          } else if (command === 'file.open') {
            const picker = createFilePicker();
            if (!picker.isSupported()) {
              setFailure(t('import.unsupported'));
              return;
            }
            const uri = await picker.pickFile(DOCUMENT_EXTENSIONS);
            if (!uri) return;
            const opened = await openFileInto(list, services, uri);
            recordRecent(opened.store.getState());
            showEditor();
          } else if (command === 'file.saveAs') {
            await saveAs();
          } else if (command === 'file.save') {
            if (!document) return;
            // A document that already has a file goes back to it; one that does
            // not has to be asked about, which is Save As.
            if (document.store.getState().origin.kind !== 'unsaved') {
              await document.store.getState().saveNow();
            } else {
              await saveAs();
            }
          }
          // Import and export commands reach this listener too. They are
          // handled above the navigator and in the editor respectively, and
          // ignoring them here is what keeps two handlers off one menu item.
        } catch (error) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      })();
    },
    [document, list, services, recordRecent, saveAs, t],
  );

  useMenuCommand(run);
  /*
    What this listener can answer. New, Open and the three destinations
    always; Save and Save As only with a document to write.
  */
  useMenuAvailability(
    document
      ? MENU_FILE_COMMANDS
      : MENU_FILE_COMMANDS.filter(
          c => c !== 'file.save' && c !== 'file.saveAs',
        ),
  );

  /*
    A `moosiac://open` link, or a `.moo` opened from Finder, opens the document
    exactly as File > Open does. Imports are `MenuImportCommands`'.
  */
  useOpenLink('documents', link => {
    if (link.kind !== 'document') return;
    openFileInto(list, services, link.path)
      .then(opened => {
        recordRecent(opened.store.getState());
        showEditor();
      })
      .catch((error: unknown) =>
        setFailure(error instanceof Error ? error.message : String(error)),
      );
  });

  return (
    <>
      <NewProjectSheet
        open={newOpen}
        // A model writes into a project on the server, so generating needs an
        // account and a server; a blank score stays a local document either
        // way. The rules themselves are music_lib's (`newProjectCreditState`).
        account={{
          ...creation.account,
          serverAvailable: serverContext !== null,
        }}
        onOpenCredits={() => {
          setNewOpen(false);
          if (navigationRef.isReady()) navigationRef.navigate('Credits');
        }}
        generate={screenshotGenerate}
        submitting={creation.creating}
        onClose={() => {
          setNewOpen(false);
          setScreenshotGenerate(false);
        }}
        onSubmit={submission => {
          if (submission.kind === 'blank') {
            setNewOpen(false);
            list.open(
              newDocument(services, {
                score: submission.score,
                title: submission.title,
              }),
            );
            showEditor();
            return;
          }
          void creation.create(submission).then(projectId => {
            setNewOpen(false);
            if (projectId !== null && navigationRef.isReady()) {
              navigationRef.navigate('Editor', { projectId });
            }
          });
        }}
      />
      <ServerProjectCreationFeedback
        creation={creation}
        onOpenCredits={() => {
          if (navigationRef.isReady()) navigationRef.navigate('Credits');
        }}
      />
      {/*
        A save that silently did nothing is how work is lost, so a failure is
        shown rather than swallowed — the same reason `ImportFeedback` exists.
      */}
      <FormModal
        visible={failure !== null}
        title={t('document.saveFailedTitle')}
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
