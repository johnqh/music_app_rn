/**
 * One document, on screen.
 *
 * Wiring only: the arrangement lives in `AppLayout`, which mirrors the web
 * app's. What is here is the handful of actions that need the document, the
 * storage and the transport at once.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import { placeCaret } from '@sudobility/music_editing';
import { AppLayout } from '@/components/layout/AppLayout';
import { saveDocument } from '@/documents/document-storage';
import { createFileStorage } from '@/documents/rn-storage';
import { createKeyValueStore } from '@/documents/rn-key-value';
import { useRecentTracking } from '@/documents/useRecentTracking';
import { RecentDocuments } from '@/features/documents/RecentDocuments';
import { ImportButtons } from '@/features/documents/ImportButtons';
import { exportDocument } from '@/documents/export';
import type { ExportFormat } from '@/documents/export';
import { ExportSheet } from '@/features/documents/ExportSheet';
import { useMenuCommand } from '@/app/menu-commands';
import type { MenuCommand } from '@/app/menu-commands';
import { canPrint, printScore } from '@/features/print/print-service';
import { GenerateScoreSheet } from '@/features/generation/GenerateScoreSheet';
import { ReplaceMusicSheet } from '@/features/generation/ReplaceMusicSheet';
import { GenerateTrackSheet } from '@/features/generation/GenerateTrackSheet';
import { prepareReplacement } from '@sudobility/music_editing';
import type { ReplaceScope } from '@sudobility/music_types';
import { GenerationOverlay } from '@/features/generation/GenerationOverlay';
import { SnapshotsSheet } from '@/features/snapshots/SnapshotsSheet';
import { useDocumentGeneration } from '@/features/generation/useDocumentGeneration';
import { CreditPaywallSheet } from '@/features/credits/CreditPaywallSheet';
import { useCreditBalance } from '@/features/credits/useCreditBalance';
import { ExportScopeSheet } from '@/features/documents/ExportScopeSheet';
import {
  exportScopeNeedsPrompt,
  exportTargetScore,
  hiddenTrackCount,
} from '@sudobility/music_editing';
import type { Score } from '@sudobility/music_types';
import { renderEvents, renderSamples } from '@sudobility/music_player';
import { reportError } from '@sudobility/music_lib';
import { getAppServices } from '@/config/initialize';
import { getMusicClient } from '@/config/server';
import { useAuth } from '@/auth/AuthContext';
import { reloadProjectDocument } from '@/documents/project-sync';
import {
  useActiveDocument,
  useDocumentList,
} from '@/documents/DocumentsContext';
import { openProjectDocument } from '@/documents/project-sync';
import type { RootStackParamList } from '@/app/Navigation';
import { tickAt } from '@/features/score/hit-test';
import type { MeasureHit } from '@/features/score/hit-test';
import type { MusicDocument } from '@/documents/document';

const storage = createFileStorage();
const keyValue = createKeyValueStore();

export function EditorScreen() {
  const { t } = useTranslation();
  const document = useActiveDocument();
  const list = useDocumentList();
  const { getToken } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'Editor'>>();
  const projectParam = route.params?.projectId ?? null;
  const [openError, setOpenError] = useState<string | null>(null);

  /*
    Opening a project the dashboard sent us to.

    Through `openProjectDocument`, which raises the document already open rather
    than fetching a second copy — two documents over one project would diverge
    the moment either was edited, and both would claim to be the project.
  */
  useEffect(() => {
    if (!projectParam) return;
    const client = getMusicClient();
    if (!client) return;
    let cancelled = false;
    void openProjectDocument(list, client, getToken, projectParam).catch(
      error => {
        if (!cancelled) {
          setOpenError(error instanceof Error ? error.message : String(error));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [projectParam, list, getToken]);

  if (openError) return <EmptyState message={openError} />;
  if (!document) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-4">
        <Text className="text-muted-foreground">{t('editor.noScore')}</Text>
        {/*
          Import lives in the empty state and on the dashboard, never on the
          editor's own toolbar: every import makes a *new* document, so an
          Import control inside a score could only throw you out of the score
          you had open.
        */}
        <ImportButtons />
        {/* The way back to something you were working on. */}
        <RecentDocuments storage={storage} keyValue={keyValue} />
      </View>
    );
  }
  // A fresh component per document, so the store a hook reads is never the
  // previous document's.
  return <DocumentEditor key={document.id} document={document} />;
}

function DocumentEditor({ document }: { document: MusicDocument }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const { user, getToken, siteAdmin } = useAuth();
  const score = useStore(document.store, s => s.score);
  const recordRecent = useRecentTracking(keyValue);

  const onSave = useCallback(() => {
    setSaving(true);
    void saveDocument(document, storage, recordRecent).finally(() =>
      setSaving(false),
    );
  }, [document, recordRecent]);

  const [exportOpen, setExportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  /*
    Which Replace is being asked for, or null when none is. One sheet serves all
    three scopes — they differ only in the region they overwrite, and
    `prepareReplacement` is what works that out.
  */
  const [replaceScope, setReplaceScope] = useState<ReplaceScope | null>(null);
  const [generateTrackOpen, setGenerateTrackOpen] = useState(false);
  const selection = useStore(document.store, s => s.selection);
  const hasSelection =
    selection.eventIds.length > 0 || selection.measureIds.length > 0;

  /*
    A document only has a project to generate into when it came from one. A
    local file has no row on the server, so there is nothing for a job to write
    back to — offering Generate there would be offering something that cannot
    work.
  */
  const projectId =
    document.origin.kind === 'project' ? document.origin.projectId : null;

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const generation = useDocumentGeneration(document, projectId, {
    // A 402 is not a network failure and must not read like one: it is the one
    // refusal with an obvious remedy, so it opens the store.
    onInsufficientCredits: () => setPaywallOpen(true),
    // The job reads the *stored* score, so anything still unwritten has to go
    // first — otherwise it is invisible to the job and then overwritten by its
    // result.
    flush: () => saveDocument(document, storage, recordRecent),
    onApplied: async () => {
      const client = getMusicClient();
      if (client) await reloadProjectDocument(document, client, getToken);
    },
  });

  /**
   * Writes the chosen format.
   *
   * Audio takes a renderer because it is the one format this app makes rather
   * than encodes: `renderEvents` decides what sounds (mute, solo, timing, level
   * and pan) and `renderSamples` drives the same soundfont playback uses, so
   * the file is a recording of what was heard. music_io then encodes the PCM —
   * which is what keeps the two platform packages independent of each other.
   */
  const writeExport = useCallback(
    (format: ExportFormat, target?: Score) => {
      void exportDocument(
        document,
        getAppServices().io,
        format,
        async score => {
          const plan = renderEvents(score);
          const audio = await renderSamples(getAppServices().soundfont)(plan);
          return { samples: audio.samples, sampleRate: audio.sampleRate };
        },
        target,
      ).catch(error => reportError(error, { context: 'export' }));
    },
    [document],
  );

  /**
   * The format waiting on an answer about hidden tracks.
   *
   * Asked exactly when the two answers differ: a file that quietly omits parts
   * is hard to notice until it matters, and silently exporting everything would
   * equally surprise somebody who hid tracks precisely to extract a subset.
   */
  const [pendingScope, setPendingScope] = useState<ExportFormat | null>(null);

  /*
    A courtesy gate on Generate, decided here because this screen has the auth
    context and the sheet must not import it.

    A **site administrator is never gated**: `music_api` grants them free
    generation — no quota, no balance check, no charge — so they sit at a
    balance of zero forever, and this would refuse work the server would have
    accepted. Unknown is not zero either, which is why the check is on a real
    number rather than on a falsy one.
  */
  const { balance } = useCreditBalance(getToken, user !== null);
  const outOfCredits = !siteAdmin && balance !== null && balance <= 0;

  const runExport = useCallback(
    (format: ExportFormat) => {
      if (exportScopeNeedsPrompt(document.store)) setPendingScope(format);
      else writeExport(format);
    },
    [document, writeExport],
  );

  const onExport = useCallback(() => setExportOpen(true), []);

  /*
    The File menu's Export items run the export directly rather than opening
    the sheet: the menu item already names the format, and making the reader
    choose it a second time would be asking a question they have answered.
    Import is handled above the navigator instead — it makes a new document
    and so belongs to no screen.
  */
  const MENU_EXPORT: Partial<Record<MenuCommand, ExportFormat>> = useMemo(
    () => ({
      'export.midi': 'midi',
      'export.musicxml': 'musicxml',
      'export.xm': 'xm',
      'export.wav': 'wav',
      'export.mp3': 'mp3',
    }),
    [],
  );
  useMenuCommand(
    useCallback(
      (command: MenuCommand) => {
        const format = MENU_EXPORT[command];
        if (format) runExport(format);
      },
      [MENU_EXPORT, runExport],
    ),
  );

  /**
   * Prints, if this build has a print service.
   *
   * Rendering the pages is synchronous and takes a moment on a long score, so
   * the flag goes up first — otherwise the app looks frozen between the tap
   * and the print dialog appearing.
   */
  const [printing, setPrinting] = useState(false);
  const onPrint = useCallback(() => {
    setPrinting(true);
    void printScore(score!)
      .catch(error => reportError(error, { context: 'print' }))
      .finally(() => setPrinting(false));
  }, [score]);

  /**
   * A tap moves the caret and makes that track active.
   *
   * `placeCaret` does all three writes together — playhead, active track,
   * cleared selection. Doing them separately is how you get two of the three
   * right, which reads as "the caret jumped but the track did not".
   */
  const onMeasureTap = useCallback(
    (hit: MeasureHit) => {
      if (!score) return;
      const track = score.tracks.find(x => x.id === hit.trackId);
      const measure = track?.measures[hit.measureIndex];
      if (!measure) return;
      const tick = tickAt(hit, measure.startTick, measure.durationTicks);
      placeCaret(document.store, { tick, trackId: hit.trackId });
    },
    [document, score],
  );

  if (!score) return <EmptyState message={t('editor.noScore')} />;
  return (
    <AppLayout
      document={document}
      onSave={onSave}
      onExport={onExport}
      {...(canPrint() ? { onPrint, printing } : {})}
      onMeasureTap={onMeasureTap}
      saving={saving}
      onGenerate={projectId ? () => setGenerateOpen(true) : undefined}
      onSnapshots={projectId ? () => setSnapshotsOpen(true) : undefined}
      onReplace={projectId ? setReplaceScope : undefined}
      onGenerateTrack={projectId ? () => setGenerateTrackOpen(true) : undefined}
      overlay={
        <GenerationOverlay
          visible={generation.generating}
          error={generation.error}
          onCancel={() => void generation.cancel()}
        />
      }
      exportSheet={
        <>
          <GenerateScoreSheet
            open={generateOpen}
            outOfCredits={outOfCredits}
            onClose={() => setGenerateOpen(false)}
            onSubmit={request => {
              setGenerateOpen(false);
              void generation.start('generate-score', request);
            }}
          />
          <GenerateTrackSheet
            open={generateTrackOpen}
            score={score}
            onClose={() => setGenerateTrackOpen(false)}
            onSubmit={request => {
              setGenerateTrackOpen(false);
              // The same runner every other generation uses, so adding a track
              // behaves like the rest: the overlay appears, the project locks
              // server-side, and leaving the screen is safe.
              void generation.start('generate-track', request);
            }}
          />
          <ExportScopeSheet
            open={pendingScope !== null}
            hiddenCount={hiddenTrackCount(document.store)}
            onCancel={() => setPendingScope(null)}
            onChoose={scope => {
              const format = pendingScope;
              setPendingScope(null);
              if (!format) return;
              const target = exportTargetScore(document.store, scope);
              writeExport(format, target ?? undefined);
            }}
          />
          <CreditPaywallSheet
            open={paywallOpen}
            onClose={() => setPaywallOpen(false)}
            onOpenCredits={() => navigation.navigate('Credits')}
          />
          <ReplaceMusicSheet
            open={replaceScope !== null}
            scope={replaceScope ?? 'notes'}
            canSubmit={hasSelection}
            onClose={() => setReplaceScope(null)}
            onSubmit={submission => {
              const scope = replaceScope;
              setReplaceScope(null);
              if (!scope) return;
              /*
                `prepareReplacement` turns the settings into the request the
                server needs, and answers null when there is nothing to
                replace — which is the same test the button's `canSubmit`
                uses, checked again here because the selection can change
                while the sheet is open.
              */
              const prepared = prepareReplacement(
                document.store,
                scope,
                submission,
              );
              if (prepared) {
                void generation.start(prepared.kind, prepared.request);
              }
            }}
          />
          <SnapshotsSheet
            open={snapshotsOpen}
            document={document}
            getToken={getToken}
            onClose={() => setSnapshotsOpen(false)}
          />
          <ExportSheet
            open={exportOpen}
            document={document}
            onClose={() => setExportOpen(false)}
            onExport={runExport}
          />
        </>
      }
    />
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="bg-background flex-1 items-center justify-center">
      <Text className="text-muted-foreground">{message}</Text>
    </View>
  );
}
