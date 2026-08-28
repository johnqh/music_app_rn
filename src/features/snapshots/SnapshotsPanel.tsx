/**
 * Snapshots for the open project.
 *
 * **Creating one flushes the live score first.** The server copies the
 * *projects row*, so anything still unwritten would not be in the snapshot —
 * and right after a generation, that row may hold the placeholder score rather
 * than the result. Deleting the flush pins stale music, silently.
 *
 * **There is no edit or delete.** Immutability is enforced by the absence of a
 * route rather than by a check somebody can forget, and this offers only what
 * the server will do: create, list, open, publish.
 *
 * **A published title can still change, and that is not an exception to it.**
 * The *music* never changes; what the public sees it called is metadata about
 * sharing. Re-publishing is the server's own way of setting it, and the route
 * keeps the first `publicId` — so a link already shared stays valid across a
 * rename.
 *
 * **Opening one branches rather than overwriting.** Every snapshot has a
 * `parentId`; opening v1 while v2 exists leaves v2 alone and makes the next
 * snapshot v1's child. The tree is `snapshotTree`'s, shared with the web app.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, Text } from '@sudobility/components-rn';
import { snapshotTree } from '@sudobility/music_types';
import type { SnapshotSummary, TreeNode } from '@sudobility/music_types';
import type { MusicClient } from '@sudobility/music_client';
import { CreateSnapshotSheet, OpenSnapshotSheet } from './SnapshotSheets';
import { DraftInput } from '@/features/inspector/DraftInput';
import type { MusicDocument } from '@/documents/document';

export type SnapshotGateway = Pick<
  MusicClient,
  | 'listSnapshots'
  | 'createSnapshot'
  | 'openSnapshot'
  | 'publishSnapshot'
  | 'unpublishSnapshot'
  | 'getProjectStatus'
>;

export type SnapshotsPanelProps = {
  document: MusicDocument;
  gateway: SnapshotGateway;
  getToken: () => Promise<string | null>;
  /** Writes any pending edit, so the snapshot holds what is on screen. */
  flush: () => Promise<unknown> | unknown;
  /** Re-reads the project after opening a snapshot re-parents it. */
  reload: () => Promise<void>;
};

export function SnapshotsPanel({
  document,
  gateway,
  getToken,
  flush,
  reload,
}: SnapshotsPanelProps) {
  const { t } = useTranslation();
  const projectId =
    document.origin.kind === 'project' ? document.origin.projectId : null;

  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [nodes, setNodes] = useState<readonly TreeNode[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const token = await getToken();
    if (!token) return;
    const [list, status] = await Promise.all([
      gateway.listSnapshots(projectId, token),
      // The live project's parent rides on the status call rather than costing
      // a whole project fetch to read one id.
      gateway.getProjectStatus(projectId, token),
    ]);
    setSnapshots(list);
    setNodes(snapshotTree(list, status.parentSnapshotId ?? null));
  }, [projectId, gateway, getToken]);

  useEffect(() => {
    void refresh().catch(e =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [refresh]);

  const run = (work: () => Promise<void>): void => {
    setBusy(true);
    setError(null);
    void work()
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  /*
    Published-ness is a field on the summary rather than a second request: the
    list already says which snapshots are public, and asking again would be a
    round trip to learn what is in hand.
  */
  const published = (snapshots ?? []).filter(s => s.publicId);

  if (!projectId) return null;

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onPress={() => setCreateOpen(true)}
        >
          {/*
            "New snapshot", not "Create snapshot": the sheet this opens has a
            Create of its own, and two controls with one name are ambiguous
            read aloud and impossible to tell apart in a test.
          */}
          {t('snapshot.newSnapshot')}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || (snapshots?.length ?? 0) === 0}
          onPress={() => setOpenOpen(true)}
        >
          {t('snapshot.history')}
        </Button>
      </View>

      {/*
        What is already public, and a way to take it back.

        Withdrawing matters more than publishing does: somebody who published
        by mistake needs the way out to be obvious, and it is the one action
        here that cannot be reached from the create form.
      */}
      {published.length > 0 ? (
        <View className="gap-1 pt-2">
          <Text className="text-muted-foreground text-xs">
            {t('snapshot.managePublishedTitle')}
          </Text>
          {published.map(snapshot => (
            <View
              key={snapshot.id}
              className="flex-row items-center justify-between gap-2"
            >
              {/*
                A draft committed on blur, not per keystroke: a half-typed
                title must never reach a public page.
              */}
              <View className="flex-1">
                <DraftInput
                  value={snapshot.publicName ?? snapshot.name}
                  accessibilityLabel={t('snapshot.publicNameFor', {
                    name: snapshot.name,
                  })}
                  onCommit={publicName =>
                    run(async () => {
                      const trimmed = publicName.trim();
                      if (trimmed === '') return;
                      const token = await getToken();
                      if (!token) throw new Error(t('library.authRequired'));
                      await gateway.publishSnapshot(
                        snapshot.id,
                        {
                          // Kept as it was: this is a rename of the title, not
                          // a change of who published it.
                          publisherName: snapshot.publisherName ?? '',
                          publicName: trimmed,
                        },
                        token,
                      );
                      await refresh();
                    })
                  }
                />
              </View>
              <Button
                variant="ghost"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    const token = await getToken();
                    if (!token) throw new Error(t('library.authRequired'));
                    await gateway.unpublishSnapshot(snapshot.id, token);
                    await refresh();
                  })
                }
              >
                {t('snapshot.unpublish')}
              </Button>
            </View>
          ))}
        </View>
      ) : null}

      {snapshots === null ? <Spinner /> : null}
      {error ? <Text className="text-destructive text-xs">{error}</Text> : null}

      <CreateSnapshotSheet
        open={createOpen}
        snapshotCount={snapshots?.length ?? 0}
        projectName={document.title}
        onClose={() => setCreateOpen(false)}
        onCreate={(name, publisherName, publicName) =>
          run(async () => {
            setCreateOpen(false);
            /*
              Flush before asking. The server copies the projects row, and
              saving is debounced — without this, a snapshot taken moments
              after an edit pins the score as it was before it.
            */
            await flush();
            const token = await getToken();
            if (!token) throw new Error(t('library.authRequired'));
            const snapshot = await gateway.createSnapshot(
              projectId,
              name,
              token,
            );
            // Published in the same step it is created, because that is how
            // the sheet asks it: publishing is a tick on the create form
            // rather than a second trip through a list.
            if (publisherName && publicName) {
              await gateway.publishSnapshot(
                snapshot.id,
                { publisherName, publicName },
                token,
              );
            }
            // Creating one re-parents the project row, which is a change this
            // client made — so the project has to be re-read rather than left
            // to the poll, which would see it as somebody else's.
            await reload();
            await refresh();
          })
        }
      />

      <OpenSnapshotSheet
        open={openOpen}
        nodes={nodes}
        onClose={() => setOpenOpen(false)}
        onSnapshotFirst={() => {
          // The non-destructive escape: keep the current work, then come back.
          setOpenOpen(false);
          setCreateOpen(true);
        }}
        onOpen={snapshotId =>
          run(async () => {
            setOpenOpen(false);
            const token = await getToken();
            if (!token) throw new Error(t('library.authRequired'));
            await gateway.openSnapshot(snapshotId, token);
            await reload();
            await refresh();
          })
        }
      />
    </View>
  );
}
