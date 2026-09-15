/**
 * The editor, laid out as the web app lays it out.
 *
 * Title bar, then the score with the inspector beside it, then the transport,
 * the keyboard and the status strip. The web app's `AppLayout` has exactly this
 * order, and matching it is the point: the two are the same product, and
 * somebody who knows where the transport is should not have to look for it.
 *
 * The one deliberate difference is *where the inspector goes*. On the web it is
 * always a right-hand column; here it is a column only when there is room for
 * one, and a strip beneath the score when there is not. A 400pt phone in
 * landscape has no room for a 280pt panel beside a system of music.
 */
import { View } from 'react-native';
import { soundingPitchForDrawn } from '@sudobility/music_lib';
import type { Pitch } from '@sudobility/music_types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  getMusicPosition,
  noteIndexAtOrAfter,
  trackNotesInOrder,
} from '@sudobility/music_types';
import {
  canPasteInto,
  clearSelected,
  deleteSelected,
  selectAll,
  selectionKind,
  selectMeasureRange,
  selectNotes,
  useClipboardPrompts,
  writeNoteAtPoint,
} from '@sudobility/music_editing';
import { ClipboardPromptSheets } from '@/features/score-editor/ClipboardPromptSheets';
import type { LayoutMode } from '@sudobility/music_drawing';
import type { ReplaceScope } from '@sudobility/music_types';
import {
  selectActiveTrackId,
  selectVisibleTrackIds,
} from '@sudobility/music_editing';
import { ScrollingScore } from '@/features/score/ScrollingScore';
import { TransportBar } from '@/features/transport/TransportBar';
import { useTransport } from '@/features/transport/useTransport';
import { KeyboardPanel } from '@/features/piano-keyboard/KeyboardPanel';
import { InspectorPanel } from '@/features/inspector/InspectorPanel';
import { ScoreActionsSheet } from '@/features/score-editor/ScoreActionsSheet';
import type { ScoreAction } from '@/features/score-editor/ScoreActionsSheet';
import { DocumentTabs } from '@/features/documents/DocumentTabs';
import { useScoreSelection } from '@/features/score/useScoreSelection';
import { EditorToolbar } from '@/features/score-editor/EditorToolbar';
import { LyricEntryBar } from '@/features/score-editor/LyricEntryBar';
import { TitleBar } from './TitleBar';
import { StatusBar } from './StatusBar';
import { useContainerSize } from '@/features/layout/useContainerSize';
import type { MeasureHit } from '@sudobility/music_drawing';
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
  onMeasureTap: (hit: MeasureHit, tick: number) => void;
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
  /*
    Through `selectActiveTrackId`, never the raw field: the field is empty until
    somebody picks a track, and the selector's rule — the first visible track
    when none is chosen, or when the chosen one is gone — is what makes one track
    always active. Reading the field left a freshly opened score with no active
    track, so every stave drew in the same ink and no note lit during playback.
    The web editor reads the same selector.
  */
  const activeTrackId = useStore(document.store, selectActiveTrackId);
  // Memoized in music_editing, so this is reference-stable between renders
  // that did not change the score or the hidden set.
  const visibleTrackIds = useStore(document.store, selectVisibleTrackIds);
  const zoom = useStore(document.store, s => s.zoom);
  const pitchDisplay = useStore(document.store, s => s.pitchDisplay);
  /*
    Note input is a mode: with it on a tap on a stave writes a note there, and
    with it off the tap aims the caret. Clicking to place a note and clicking to
    aim are both needed, and the caret is what selection, insertion and "play
    from here" are aimed with, so it stays the default.
  */
  const noteInput = useStore(document.store, s => s.noteInput);
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
  const scoreSelection = useScoreSelection(document);
  /*
    The bar a measure-range selection extends from.

    A ref, not state: it is read inside the tap handler and must never cause a
    render — the same reason the web app keeps it in one.
  */
  const measureAnchor = useRef<number | null>(null);
  const selection = useStore(document.store, s => s.selection);
  const clipboard = useStore(document.store, s => s.clipboard);
  const contextKind = selectionKind(selection);
  const contextCount =
    contextKind === 'measures'
      ? selection.measureIds.length
      : selection.eventIds.length;
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
      else if (action === 'clear') clearSelected(store);
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
              trackIds={visibleTrackIds}
              selection={scoreSelection}
              /*
                Tapping a note selects it — the whole chord — and aims the caret
                at it. `selectNotes` is music_editing's, so this and the web app
                agree about what tapping a note means rather than each deciding.
              */
              onNoteTap={ids => selectNotes(document.store, ids)}
              /*
                A tap on a track's name makes it active — not a position in
                time, so the caret stays where it is. `selectTrack` alongside,
                because the property sheet follows the selection.
              */
              onTrackTap={trackId => {
                document.store.getState().setActiveTrack(trackId);
                document.store.getState().selectTrack(trackId);
              }}
              /*
                A tap on the measure-number band selects that bar — the gesture
                Replace Measures and regeneration are aimed with, and the one
                thing that still selects measures now that a tap on the stave
                moves the caret. `selectMeasureRange` is the shared rule; the
                anchor lives in a ref because extending must not re-render.
              */
              /*
                Note input on: a tap writes a note rather than aiming the caret.
                The pitch arrives as drawn, so the display lenses come off here
                — `soundingPitchForDrawn` — before it is stored; `pitchDisplay`
                is the reader's own written/concert setting.
              */
              {...(noteInput
                ? {
                    onWriteNote: (at: {
                      tick: number;
                      trackId: string;
                      drawnPitch: Pitch;
                    }) => {
                      const current = document.store.getState().score;
                      if (!current) return;
                      writeNoteAtPoint(document.store, {
                        tick: at.tick,
                        trackId: at.trackId,
                        pitch: soundingPitchForDrawn(
                          current,
                          at.trackId,
                          at.tick,
                          at.drawnPitch,
                          pitchDisplay,
                        ),
                      });
                    },
                  }
                : {})}
              onMeasureSelect={index => {
                measureAnchor.current = selectMeasureRange(document.store, {
                  index,
                  anchor: measureAnchor.current,
                  extend: false,
                  allTracks: false,
                });
              }}
              zoom={zoom}
              layoutMode={layoutMode}
              pitchDisplay={pitchDisplay}
              onMeasureTap={onMeasureTap}
              onMeasureLongPress={(hit, tick) => {
                // The press aims the caret first, so the menu acts where the
                // reader pressed rather than wherever the caret happened to be.
                onMeasureTap(hit, tick);
                setActionsOpen(true);
              }}
              /*
                A hold on a track's name or a bar number opens the menu too, on
                that object — the view has already selected it by the time this
                fires, exactly as the web's right-click does. Without this the
                menu could only ever be opened over a note or a stave, which is
                two of the three things it is about.
              */
              onContextGesture={() => setActionsOpen(true)}
            />
          </View>
          {inspectorVisible ? (
            <View
              className={
                sideBySide
                  ? /*
                    `w-80` (320px), not `w-72` (288). The tab strip is a real
                    `UISegmentedControl` on iPad, which divides its width
                    equally and elides a label that does not fit — at 288 the
                    four tabs left ~66px each and "Measure" rendered as
                    "Measu…", which reads as a bug rather than as a long word.
                    320 is also the ordinary width of a property sheet, and the
                    score area beside it has the room. Side-by-side only: on a
                    phone this panel is a full-width sheet along the bottom.
                  */
                    'border-border w-80 border-l'
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
        Above both bars: while writing words, the field is what the software
        keyboard must not cover.
      */}
      {lyricStart !== null ? (
        <LyricEntryBar
          store={document.store}
          notes={lyricNotes}
          startIndex={lyricStart}
          onClose={() => setLyricStart(null)}
        />
      ) : null}

      {/*
        Transport above the keyboard, matching the web app.

        The keyboard is the one panel here that changes height — it collapses,
        and it is optional — so with it in between, opening or closing it moved
        the transport, which is the row a thumb goes to without looking. Fixed
        rows first, the variable one last.
      */}
      <TransportBar
        score={score}
        transport={transport}
        store={document.store}
        keyboardCollapsed={keyboardCollapsed}
        onToggleKeyboard={() => setKeyboardCollapsed(value => !value)}
      />
      <KeyboardPanel document={document} collapsed={keyboardCollapsed} />
      <StatusBar document={document} />
      <ScoreActionsSheet
        open={actionsOpen}
        kind={contextKind}
        count={contextCount}
        canPaste={canPasteInto(selection, clipboard)}
        canEdit={!isPlaying}
        onAction={runScoreAction}
        onClose={() => setActionsOpen(false)}
      />
      <ClipboardPromptSheets clipboard={clipboardPrompts} />
      {exportSheet}
    </SafeAreaView>
  );
}
