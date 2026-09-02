/**
 * The snapshots panel, in a sheet.
 *
 * A sheet rather than a screen because it is *about the open project*: routing
 * to it and back would mean deciding what happens to the document on the way,
 * where a sheet simply lies over it. The panel inside is the whole feature;
 * this supplies the sheet, the client and the two callbacks it cannot get for
 * itself — how to flush a pending edit, and how to re-read the project after a
 * snapshot re-parents it.
 */
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { getAppServices } from '@/config/initialize';
import { getMusicClient } from '@/config/server';
import {
  saveProjectDocument,
  reloadProjectDocument,
} from '@/documents/project-sync';
import { SnapshotsPanel } from './SnapshotsPanel';
import type { MusicDocument } from '@/documents/document';

export function SnapshotsSheet({
  open,
  document,
  getToken,
  onClose,
}: {
  open: boolean;
  document: MusicDocument;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const client = getMusicClient();

  return (
    <FormModal
      visible={open}
      title={t('snapshot.openTitle')}
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      // No bottom bar: everything here acts immediately, and a Save button
      // over controls that have already saved is a button that does nothing.
      actions={[]}
    >
      {client ? (
        <SnapshotsPanel
          document={document}
          gateway={client}
          getToken={getToken}
          flush={() => saveProjectDocument(document, client, getToken)}
          reload={() => {
            // Opening a snapshot is a different piece arriving; see
            // `EditorScreen`'s `onApplied` for why the stop is what says so.
            getAppServices().player.stop();
            return reloadProjectDocument(document, client, getToken);
          }}
        />
      ) : (
        <Text className="text-muted-foreground text-base">
          {t('library.serverUnavailable')}
        </Text>
      )}
    </FormModal>
  );
}
