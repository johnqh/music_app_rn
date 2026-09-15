/**
 * The File menu's Import items, wired to the same runner as the dashboard.
 *
 * Mounted once, above the navigator, because an import makes a *new* document
 * rather than editing the open one — so it must work from any screen, and it
 * has nowhere sensible to live inside one. Renders only the feedback dialogs
 * and the audio sheet; there is no visible control here.
 *
 * Export is deliberately *not* here: it acts on the document in front of you,
 * so it belongs to the editor and is handled there.
 *
 * **Audio is not a `run(format)` import.** It uploads to the server and gets a
 * project back rather than decoding anything locally, so it opens a sheet of
 * its own — and the result is *opened as a document* rather than navigated to,
 * because this sits above the navigator and opening a document activates it,
 * which is the whole of what navigating there would have achieved.
 */
import { useCallback, useState } from 'react';
import type { ImportFormat } from '@/documents/import';
import { useMenuCommand } from '@/app/menu-commands';
import type { MenuCommand } from '@/app/menu-commands';
import type { NativeUploadFile } from '@sudobility/music_client';
import { useAuth } from '@/auth/AuthContext';
import { getMusicClient } from '@/config/server';
import { openProjectInto } from '@/documents/document';
import {
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';
import { ImportFeedback, useImport } from './useImport';
import { useOpenLink } from '@/app/useOpenLink';
import { AudioImportSheet } from './AudioImportSheet';

const IMPORT_FOR: Partial<Record<MenuCommand, ImportFormat>> = {
  'import.midi': 'midi',
  'import.musicxml': 'musicxml',
  'import.tracker': 'tracker',
};

export function MenuImportCommands() {
  const importer = useImport();
  const { run, importFile } = importer;
  const list = useDocumentList();
  const services = useDocumentServices();
  const { getToken } = useAuth();
  const [audioOpen, setAudioOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * Uploads a recording and opens the project it becomes.
   *
   * The score does not exist yet when this returns: the project is created in a
   * `transcribing` state and fills itself in when the job lands, which is the
   * same shape as a generation, and the editor already knows how to show one
   * running.
   */
  const transcribeAudio = useCallback(
    async (file: NativeUploadFile) => {
      const client = getMusicClient();
      const token = await getToken();
      // The sheet says why it cannot run when there is no server or account;
      // this is the same check a moment later, since a token can expire.
      if (!client || !token) return;
      const saved = await client.transcribeAudio(file, file.name, token);
      await openProjectInto(list, services, saved.id);
    },
    [getToken, list, services],
  );

  useMenuCommand(
    useCallback(
      (command: MenuCommand) => {
        if (command === 'import.audio') {
          setAudioOpen(true);
          return;
        }
        const format = IMPORT_FOR[command];
        // Export and File commands reach this listener too — they are handled
        // in the editor and in `MenuFileCommands`, and ignoring them here is
        // what keeps two handlers from both acting on one menu item.
        if (format) void run(format);
      },
      [run],
    ),
  );

  /*
    A `moosiac://open` link or a Finder open naming a file the importers read
    runs the same import this menu does. Documents are `MenuFileCommands`'.
  */
  useOpenLink('imports', link => {
    if (link.kind === 'import') void importFile(link.format, link.path);
  });

  return (
    <>
      <AudioImportSheet
        open={audioOpen}
        busy={uploading}
        available
        onClose={() => setAudioOpen(false)}
        onUpload={async file => {
          setUploading(true);
          try {
            await transcribeAudio(file);
            setAudioOpen(false);
          } finally {
            setUploading(false);
          }
        }}
      />
      <ImportFeedback state={importer} />
    </>
  );
}
