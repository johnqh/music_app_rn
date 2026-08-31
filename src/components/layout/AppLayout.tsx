/**
 * The editor, laid out as the web app lays it out.
 *
 * Title bar, then the score with the inspector beside it, then the keyboard,
 * the transport and the status strip. The web app's `AppLayout` has exactly
 * this order, and matching it is the point: the two are the same product, and
 * somebody who knows where the transport is should not have to look for it.
 *
 * The one deliberate difference is *where the inspector goes*. On the web it is
 * always a right-hand column; here it is a column only when there is room for
 * one, and a strip beneath the score when there is not. A 400pt phone in
 * landscape has no room for a 280pt panel beside a system of music.
 */
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import {
  getMusicPosition,
  noteIndexAtOrAfter,
  trackNotesInOrder,
} from '@sudobility/music_types';
import {
  deleteSelected,
  selectAll,
  useClipboardPrompts,
} from '@sudobility/music_editing';
import { ClipboardPromptSheets } from '@/features/score-editor/ClipboardPromptSheets';
import type { LayoutMode } from '@sudobility/music_drawing';
import type { ReplaceScope } from '@sudobility/music_types';
import { ScrollingScore } from '@/features/score/ScrollingScore';
import { TransportBar } from '@/features/transport/TransportBar';
import { useTransport } from '@/features/transport/useTransport';
import { KeyboardPanel } from '@/features/piano-keyboard/KeyboardPanel';
import { InspectorPanel } from '@/features/inspector/InspectorPanel';
import { ScoreActionsSheet } from '@/features/score-editor/ScoreActionsSheet';
import type { ScoreAction } from '@/features/score-editor/ScoreActionsSheet';
import { DocumentTabs } from '@/features/documents/DocumentTabs';
import { EditorToolbar } from '@/features/score-editor/EditorToolbar';
import { LyricEntryBar } from '@/features/score-editor/LyricEntryBar';
import { TitleBar } from './TitleBar';
import { StatusBar } from './StatusBar';
import { useContainerSize } from '@/features/layout/useContainerSize';
import type { MeasureHit } from '@/features/score/hit-test';
import type { ReactNode } from 'react';
import type { MusicDocument } from '@/documents/document';

/**
 * Below this the inspector moves under the score.
 *
 * Chosen from the content, not from a device class: the inspector wants ~280pt
 * and a system of music is unreadable under about 480pt, so a column costs more
 * than it gives before ~760pt.
 */
const INSPECTOR_COLUMN_MIN_WIDTH = 760;

export type AppLayoutProps = {
  document: MusicDocument;
  onSave: () => void;
  onExport: () => void;
  onMeasureTap: (hit: MeasureHit) => void;
  saving?: boolean;
  /**
   * The export sheet, mounted here rather than built here.
   *
   * Which formats exist and how one is written is the editor screen's business
   * — it owns the services. What this layout owns is *where* a sheet is
   * mounted: inside the safe area, above everything, so it is not clipped by
   * the scrolling toolbar that opens it.
   */
  exportSheet?: ReactNode;
  /**
   * Anything that covers the score — a generation in progress, most of all.
   *
   * Mounted over the notation and under nothing, because what it is covering is
   * exactly what must not be touched while it is there.
   */
  overlay?: ReactNode;
  /**
   * Asks the server for music. Absent for a document that is not a project:
   * there is no row for a job to write back to, and offering it would be
   * offering something that cannot work.
   */
  onGenerate?: () => void;
  /** Opens the snapshot history. Absent for a document with no project. */
  onSnapshots?: () => void;
  /**
   * Asks the server to rewrite part of the score.
   *
   * Passed through to the toolbar rather than the title bar: replacing is
   * something you do *to a selection*, so it belongs beside the other things
   * that act on one.
   */
  onReplace?: (scope: ReplaceScope) => void;
  /** Asks the server for one more track, matched to this score. */
  onGenerateTrack?: () => void;
  /** Prints. Absent on a build with no print service to talk to. */
  onPrint?: () => void;
  /** True while the pages are being rendered, which is not instant. */
  printing?: boolean;
};

export function AppLayout({
  document,
  onSave,
  onExport,
  onMeasureTap,
  saving,
  exportSheet,
  overlay,
  onGenerate,
  onSnapshots,
  onReplace,
  onGenerateTrack,
  onPrint,
  printing,
}: AppLayoutProps) {
  const { size, onLayout } = useContainerSize();
  // Collapsed by default: the transport and the status strip must be reachable
  // before an optional input surface is.
  const [keyboardCollapsed, setKeyboardCollapsed] = useState(true);
  /*
    Page by default, matching the web app. Continuous is one wide system, which
    is the right shape for following a single line and the wrong one for reading
    a full score on a phone.
  */
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('page');
  /*
    The inspector is shown by default only where there is a column for it. On a
    phone it is a strip under the score that costs height the notation needs, so
    it starts hidden and the toolbar's toggle brings it up.
  */
  const sideBySide = size.width >= INSPECTOR_COLUMN_MIN_WIDTH;
  const [inspectorOpen, setInspectorOpen] = useState<boolean | null>(null);
  const inspectorVisible = inspectorOpen ?? sideBySide;
  const score = useStore(document.store, s => s.score);
  const activeTrackId = useStore(document.store, s => s.activeTrackId ?? null);
  const zoom = useStore(document.store, s => s.zoom);
  const pitchDisplay = useStore(document.store, s => s.pitchDisplay);
  const transport = useTransport(score ?? null);

  /**
   * Lyric entry walks the *active track's* notes in tick order, starting at the
   * one nearest the caret — so "start writing words here" means what it looks
   * like.
   */
  const [lyricStart, setLyricStart] = useState<number | null>(null);
  const lyricNotes = useMemo(
    () =>
      score && activeTrackId ? trackNotesInOrder(score, activeTrackId) : [],
    [score, activeTrackId],
  );
  const beginLyricEntry = useCallback(() => {
    if (lyricNotes.length === 0) return;
    /*
      The caret is one shared position rather than a store field, so a tap that
      moves it and a playhead that advances it are the same number — the web
      app reads it the same way, from the same singleton.
    */
    setLyricStart(
      noteIndexAtOrAfter(lyricNotes, getMusicPosition().reportedTick),
    );
  }, [lyricNotes]);

  /*
    The long-press menu. Held here rather than in `ScrollingScore` because the
    actions it offers are the store's, and the score view's job ends at turning
    a touch into a place in the music.
  */
  const [actionsOpen, setActionsOpen] = useState(false);
  const hasSelection = useStore(
    document.store,
    s => s.selection.eventIds.length > 0 || s.selection.measureIds.length > 0,
  );
  const hasClipboard = useStore(document.store, s => s.clipboard !== null);
  const isPlaying = useStore(document.store, s => s.state) === 'playing';
  const clipboardPrompts = useClipboardPrompts(document.store);

  const runScoreAction = useCallback(
    (action: ScoreAction) => {
      const store = document.store;
      if (action === 'selectAll') selectAll(store);
      else if (action === 'copy') store.getState().copySelection();
      else if (isPlaying) return; // content is immutable mid-playback
      else if (action === 'cut') clipboardPrompts.requestCut();
      else if (action === 'paste') clipboardPrompts.requestPaste();
      else if (action === 'delete') deleteSelected(store);
    },
    [document, isPlaying, clipboardPrompts],
  );

  if (!score) return null;
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <TitleBar
        document={document}
        onSave={onSave}
        onExport={onExport}
        {...(onGenerate ? { onGenerate } : {})}
        {...(onSnapshots ? { onSnapshots } : {})}
        {...(onPrint ? { onPrint } : {})}
        {...(printing === undefined ? {} : { printing })}
        {...(saving === undefined ? {} : { saving })}
      />
      <DocumentTabs />
      <EditorToolbar
        document={document}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        onEnterLyrics={beginLyricEntry}
        inspectorVisible={inspectorVisible}
        {...(onGenerateTrack ? { onGenerateTrack } : {})}
        onToggleInspector={() => setInspectorOpen(!inspectorVisible)}
      />

      <View className="min-h-0 flex-1" onLayout={onLayout}>
        {/*
          Two complete class strings, never a template with a hole in it.
          Tailwind extracts classes by scanning source text, so
          `` `flex-1 ${row ? 'flex-row' : ''}` `` yields no `flex-row` utility —
          the class never appears whole in the file. It fails silently: the
          colours still work (those literals are elsewhere), the layout does
          not, and the score renders into a box of zero height.
        */}
        <View
          className={
            sideBySide ? 'min-h-0 flex-1 flex-row' : 'min-h-0 flex-1 flex-col'
          }
        >
          <View className="min-h-0 min-w-0 flex-1">
            {overlay}
            <ScrollingScore
              score={score}
              activeTrackId={activeTrackId}
              zoom={zoom}
              layoutMode={layoutMode}
              pitchDisplay={pitchDisplay}
              onMeasureTap={onMeasureTap}
              onMeasureLongPress={hit => {
                // The press aims the caret first, so the menu acts where the
                // reader pressed rather than wherever the caret happened to be.
                onMeasureTap(hit);
                setActionsOpen(true);
              }}
            />
          </View>
          {inspectorVisible ? (
            <View
              className={
                sideBySide
                  ? 'border-border w-72 border-l'
                  : 'border-border border-t'
              }
            >
              {/*
                Replace goes to the property sheet, not the toolbar: the scope
                is the tab. Replace Notes sits beside the note you selected,
                Replace Measures beside the bars, Replace Track beside the
                part — which is where the web app puts all three.
              */}
              <InspectorPanel
                document={document}
                {...(onReplace ? { onReplace } : {})}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/*
        Stated heights below the score; only the score absorbs what is left.

        There is no letter-key row: the web app has none, and note entry there
        is the piano keyboard plus typing. A second way to write a C — with its
        own duration picker, duplicating the toolbar's — is a different app
        wearing the same name.
      */}
      {/*
        Above the keyboard and the transport: while writing words, the field is
        what the software keyboard must not cover.
      */}
      {lyricStart !== null ? (
        <LyricEntryBar
          store={document.store}
          notes={lyricNotes}
          startIndex={lyricStart}
          onClose={() => setLyricStart(null)}
        />
      ) : null}

      <KeyboardPanel
        document={document}
        collapsed={keyboardCollapsed}
        onToggle={() => setKeyboardCollapsed(value => !value)}
      />
      <TransportBar
        score={score}
        transport={transport}
        store={document.store}
      />
      <StatusBar document={document} />
      <ScoreActionsSheet
        open={actionsOpen}
        hasSelection={hasSelection}
        hasClipboard={hasClipboard}
        canEdit={!isPlaying}
        onAction={runScoreAction}
        onClose={() => setActionsOpen(false)}
      />
      <ClipboardPromptSheets clipboard={clipboardPrompts} />
      {exportSheet}
    </SafeAreaView>
  );
}
