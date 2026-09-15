/**
 * The snapshots panel, in a sheet, bound to the open document.
 *
 * A sheet rather than a screen because it is *about the open project*: routing
 * to it and back would mean deciding what happens to the document on the way,
 * where a sheet simply lies over it.
 *
 * What this supplies to music_client's `useProjectSnapshots` is the three
 * things only the document can: how to flush (the store's `saveNow`, a no-op
 * when nothing is dirty — not a PUT of its own), how to take an opened
 * snapshot's score in (stop the transport, then adopt it as an ordinary
 * replacement, keeping the history so opening the wrong version is one undo
 * away), and where to record the server's new stamp (`noteServerVersion`).
 */
import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { useProjectSnapshots } from '@sudobility/music_client';
import type { MusicHookContext } from '@sudobility/music_client';
import { adoptOutsideScore } from '@sudobility/music_lib';
import type { Score } from '@sudobility/music_types';
import { getAppServices } from '@/config/initialize';
import { useServerContext } from '@/config/useServerContext';
import { SnapshotsPanel } from './SnapshotsPanel';
import type { MusicDocument } from '@/documents/document';

export function SnapshotsSheet({
  open,
  document,
  onClose,
}: {
  open: boolean;
  document: MusicDocument;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const context = useServerContext();

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
      {context ? (
        <BoundSnapshots document={document} context={context} />
      ) : (
        <Text className="text-muted-foreground text-base">
          {t('library.serverUnavailable')}
        </Text>
      )}
    </FormModal>
  );
}

function BoundSnapshots({
  document,
  context,
}: {
  document: MusicDocument;
  context: MusicHookContext;
}) {
  const { store } = document;
  const origin = useStore(store, s => s.origin);
  const title = useStore(store, s => s.title);
  const projectId = origin.kind === 'project' ? origin.projectId : null;

  const flush = useCallback(() => store.getState().saveNow(), [store]);
  const onAdopt = useCallback(
    (score: Score) => {
      // A different piece arriving: stop first, or the player reads the swap
      // as a mix change and goes on playing the old score out of its queue.
      adoptOutsideScore(store, score, getAppServices().player);
    },
    [store],
  );
  const noteServerVersion = useCallback(
    (updatedAt: string) => store.getState().noteServerVersion(updatedAt),
    [store],
  );
  const callbacks = useMemo(
    () => ({ flush, onAdopt, noteServerVersion }),
    [flush, onAdopt, noteServerVersion],
  );
  const snapshots = useProjectSnapshots(context, projectId, callbacks);

  if (!projectId) return null;
  return <SnapshotsPanel snapshots={snapshots} projectName={title} />;
}
