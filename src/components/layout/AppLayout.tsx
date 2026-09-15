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
import type { NoteEvent } from '@sudobility/music_types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  beginLyricEntry as beginLyricEntryAt,
  routeScorePress,
  runScoreContextAction,
  scoreContextMenuModel,
  selectForContextMenu,
  useClipboardPrompts,
} from '@sudobility/music_editing';
import type { ScoreCanvasHit } from '@sudobility/music_drawing';
import { ClipboardPromptSheets } from '@/features/score-editor/ClipboardPromptSheets';
import type { LayoutMode } from '@sudobility/music_drawing';
import type { ReplaceScope } from '@sudobility/music_types';
import {
  selectActiveTrackId,
  selectVisibleTrackIds,
} from '@sudobility/music_editing';
import { ScrollingScore } from '@/features/score/ScrollingScore';
import { TransportBar } from '@/features/transport/TransportBar';
import { usePlayerBinding } from '@/features/transport/usePlayerBinding';
import { KeyboardPanel } from '@/features/piano-keyboard/KeyboardPanel';
import { InspectorPanel } from '@/features/inspector/InspectorPanel';
import { ScoreActionsSheet } from '@/features/score-editor/ScoreActionsSheet';
import { DocumentTabs } from '@/features/documents/DocumentTabs';
import { useScoreSelection } from '@/features/score/useScoreSelection';
import { EditorToolbar } from '@/features/score-editor/EditorToolbar';
import { LyricEntryBar } from '@/features/score-editor/LyricEntryBar';
import { TitleBar } from './TitleBar';
import { devicePrefs, useDevicePrefs } from '@/config/useDevicePrefs';
import type { GenerationChoicesProps } from '@/features/generation/GenerationChoices';
import { StatusBar } from './StatusBar';
import { useContainerSize } from '@/features/layout/useContainerSize';
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
   * Generate Again, for a project whose score came from a generation: shown on
   * the property sheet's Score tab, where the web shows it. Absent otherwise.
   */
  generation?: GenerationChoicesProps;
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
  exportSheet,
  overlay,
  generation,
  onSnapshots,
  onReplace,
  onGenerateTrack,
  onPrint,
  printing,
}: AppLayoutProps) {
  const { size, onLayout } = useContainerSize();
  /*
    A device pref, expanded by default and remembered, as on the web. It was a
    `useState(true)` here: collapsed on every launch and forgotten on every tab,
    so a reader who played from the keyboard reopened it every time.
  */
  const keyboardCollapsed = useDevicePrefs(s => s.keyboardCollapsed);
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
    music_editing's `bindPlayer`, bound to this document's store: loading each
    score, mirroring the transport into the store, looping the selection and
    reporting failures as toasts — the web adapter's rules, not a copy of them.
  */
  const transport = usePlayerBinding(document.store);

  /**
   * Lyric entry in progress: the *active track's* notes in tick order, as they
   * were when entry began, and the note at or after the caret to start on — so
   * "start writing words here" means what it looks like. `beginLyricEntry`
   * (music_editing, the web editor's call) decides both, and answers null with
   * nothing to write under or while the transport plays — this layout used to
   * work the notes out itself and would open the bar mid-playback, where the
   * store refused every syllable typed into it.
   */
  const [lyricEntry, setLyricEntry] = useState<{
    notes: NoteEvent[];
    startIndex: number;
  } | null>(null);
  const beginLyricEntry = useCallback(() => {
    const entry = beginLyricEntryAt(document.store);
    if (entry)
      setLyricEntry({ notes: entry.notes, startIndex: entry.startIndex });
  }, [document]);

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
    render — the same reason the web app keeps it in one. The rule for using it
    is `routeScorePress`'s; this only holds it.
  */
  const measureAnchor = useRef<number | null>(null);
  const selection = useStore(document.store, s => s.selection);
  const clipboard = useStore(document.store, s => s.clipboard);
  const isPlaying = useStore(document.store, s => s.state) === 'playing';
  const clipboardPrompts = useClipboardPrompts(document.store);

  /*
    A tap on the score, whatever it landed on. music_editing's `routeScorePress`
    is the web's click handler — the gutter makes a track active, the bar band
    selects a bar, a note selects its chord, a stave aims the caret or, with
    note input on, writes the pressed pitch after taking the display lenses off.
    This used to be five callbacks here, each choosing a store action, and the
    native answers had drifted from the web's.

    Touch has no Shift or Cmd, so both are false; a hardware keyboard's
    modifiers are not reported to a touch on React Native.
  */
  const onScorePress = useCallback(
    (hit: ScoreCanvasHit | null, pointTick: number | null) => {
      const store = document.store;
      measureAnchor.current = routeScorePress(store, hit, {
        shift: false,
        mod: false,
        noteInput: store.getState().noteInput,
        pitchDisplay: store.getState().pitchDisplay,
        anchor: measureAnchor.current,
        pointTick,
      });
    },
    [document],
  );

  /*
    A long press selects what it landed on and opens the menu on that —
    `selectForContextMenu`, the web's right-click. **A press inside the existing
    selection keeps it**, and a press on a bare stave selects nothing and moves
    nothing: this used to aim the caret first, which cleared the very selection
    the menu was then opened to act on.
  */
  const onScoreLongPress = useCallback(
    (hit: ScoreCanvasHit | null) => {
      measureAnchor.current = selectForContextMenu(
        document.store,
        hit,
        measureAnchor.current,
      );
      setActionsOpen(true);
    },
    [document],
  );

  if (!score) return null;
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <TitleBar
        document={document}
        onSave={onSave}
        onExport={onExport}
        {...(onSnapshots ? { onSnapshots } : {})}
        {...(onPrint ? { onPrint } : {})}
        {...(printing === undefined ? {} : { printing })}
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
              zoom={zoom}
              layoutMode={layoutMode}
              pitchDisplay={pitchDisplay}
              onPress={onScorePress}
              onLongPress={onScoreLongPress}
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
                {...(generation ? { generation } : {})}
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
      {lyricEntry !== null ? (
        <LyricEntryBar
          store={document.store}
          notes={lyricEntry.notes}
          startIndex={lyricEntry.startIndex}
          onClose={() => setLyricEntry(null)}
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
        onToggleKeyboard={() =>
          devicePrefs.getState().setKeyboardCollapsed(!keyboardCollapsed)
        }
      />
      <KeyboardPanel document={document} collapsed={keyboardCollapsed} />
      <StatusBar document={document} />
      <ScoreActionsSheet
        open={actionsOpen}
        /*
          music_editing's model — entries, enabled rules and the subject, bars
          counted across tracks — the same one the web's right-click menu draws.
        */
        model={scoreContextMenuModel({
          selection,
          clipboard,
          playing: isPlaying,
          score,
        })}
        /*
          Re-checked against the store as it is now, so an entry chosen after
          the transport started is refused rather than trusted to the flag. Cut
          and paste ask the same insert-or-replace question the shortcuts do.
        */
        onAction={action => {
          runScoreContextAction(document.store, action, {
            requestCut: clipboardPrompts.requestCut,
            requestPaste: clipboardPrompts.requestPaste,
          });
        }}
        onClose={() => setActionsOpen(false)}
      />
      <ClipboardPromptSheets clipboard={clipboardPrompts} />
      {exportSheet}
    </SafeAreaView>
  );
}
