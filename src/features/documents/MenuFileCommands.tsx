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
 * **Open, Save and Save As speak the app's own `.moosiac` document**, which
 * `parseDocument` validates on the way in — a file on disk is exactly as
 * untrusted as a network response.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { useMenuCommand } from '@/app/menu-commands';
import type { MenuCommand } from '@/app/menu-commands';
import {
  newDocument,
  openDocument,
  saveDocument,
  saveDocumentAs,
} from '@/documents/document-storage';
import {
  documentFilename,
  DOCUMENT_EXTENSION,
} from '@/documents/document-file';
import { createFilePicker } from '@/documents/file-picker';
import { createFileStorage } from '@/documents/rn-storage';
import { createKeyValueStore } from '@/documents/rn-key-value';
import { useRecentTracking } from '@/documents/useRecentTracking';
import {
  useActiveDocument,
  useDocumentChanged,
  useDocumentList,
} from '@/documents/DocumentsContext';
import { NewProjectSheet } from '@/features/projects/NewProjectSheet';

const storage = createFileStorage();
const keyValue = createKeyValueStore();

export function MenuFileCommands() {
  const { t } = useTranslation();
  const list = useDocumentList();
  const document = useActiveDocument();
  const onChanged = useDocumentChanged();
  const recordRecent = useRecentTracking(keyValue);
  const [newOpen, setNewOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Writes the document somewhere the user picks.
   *
   * Also what Save falls back to for a document that has never been written:
   * `saveDocument`'s own fallback puts it in a default directory without
   * asking, which is right for autosave and wrong for a menu command, where a
   * person is present to be asked.
   */
  const saveAs = useCallback(async (): Promise<void> => {
    if (!document) return;
    const picker = createFilePicker();
    if (!picker.isSupported()) {
      setFailure(t('import.unsupported'));
      return;
    }
    const uri = await picker.pickSaveLocation(documentFilename(document.title));
    // Cancelling is an ordinary outcome, not a failure to report.
    if (!uri) return;
    await saveDocumentAs(document, storage, uri, recordRecent);
  }, [document, recordRecent, t]);

  const run = useCallback(
    (command: MenuCommand): void => {
      void (async () => {
        try {
          if (command === 'file.new') {
            setNewOpen(true);
          } else if (command === 'file.open') {
            const picker = createFilePicker();
            if (!picker.isSupported()) {
              setFailure(t('import.unsupported'));
              return;
            }
            const uri = await picker.pickFile([DOCUMENT_EXTENSION]);
            if (!uri) return;
            await openDocument(list, storage, uri, onChanged, recordRecent);
          } else if (command === 'file.saveAs') {
            await saveAs();
          } else if (command === 'file.save') {
            if (!document) return;
            // A document that already has a file goes back to it; one that does
            // not has to be asked about, which is Save As.
            if (document.origin.kind === 'file') {
              await saveDocument(document, storage, recordRecent);
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
    [document, list, onChanged, recordRecent, saveAs, t],
  );

  useMenuCommand(run);

  return (
    <>
      <NewProjectSheet
        open={newOpen}
        generationAvailable={false}
        onClose={() => setNewOpen(false)}
        onSubmit={submission => {
          setNewOpen(false);
          // `generationAvailable={false}` means the sheet cannot produce a
          // generate submission; the guard is here so a later change to that
          // prop cannot silently drop one on the floor.
          if (submission.kind !== 'blank') return;
          newDocument(list, submission.score, submission.title, onChanged);
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
