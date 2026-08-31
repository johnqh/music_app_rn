/**
 * The editing bar, mirroring the web app's — control for control.
 *
 * Same groups in the same order, divided the same way: tracks, then note value
 * with its dotted/triplet modifiers, then accidentals, then articulation and
 * ornament with the tie beside them, then the marks and modes that act on a
 * selection, then the clipboard, then quantize, then voice, then the rare
 * actions behind a menu. Zoom, layout, pitch display and the inspector toggle
 * sit **outside the scroller**, pinned to the right, for the reason the web
 * pins them: they change how you look at the score rather than the score
 * itself, and they were the first things to disappear behind the horizontal
 * scroll.
 *
 * **Several choices are a picker, not a row of chips**, and that is the single
 * biggest difference from what this file used to be. Six note values, five
 * accidentals, five articulations, five ornaments and four quantize grids came
 * to twenty-five chips — a bar three screens wide, where the web's is one. Each
 * of those is a `ToolbarSelect` with one glyph on the trigger and the words in
 * the sheet, exactly as the web draws its `Select`s, and for the same reason:
 * five near-identical marks are unreadable as a row of 18px glyphs.
 *
 * **Every action is `music_editing`'s.** `chooseDuration`, `changeAccidental`,
 * `toggleTie` and the rest each enforce rules about a score — a hairpin needs
 * two notes, a fermata reads whether the whole selection already has one — and
 * those rules belong in the library, not in a toolbar. This file decides only
 * what is offered, in what order, and when it is available.
 *
 * **Availability is copied from the web too.** Eleven controls act on the
 * selection and quietly return when it is empty; leaving them live is how the
 * bar came to invite a tap and do nothing. `canEdit` is "there is a score and
 * the transport is not playing"; the marks that span a run need two notes; the
 * ones that sit on a note need one; Paste follows the clipboard; Copy stays
 * live while playing because it only reads.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import {
  addBlankTrack,
  addMeasure,
  canStackOnActiveTrack,
  caretToBar,
  changeAccidental,
  changeArticulation,
  changeBeam,
  changeOrnament,
  chooseDuration,
  chooseEditMode,
  defaultInsertPitch,
  deleteMeasureAtCaret,
  deleteSelected,
  insertNoteAtCaret,
  insertRestAtSelection,
  quantizeSelection,
  selectAll,
  selectSelectedNotes,
  selectSelectedTrack,
  toggleArpeggiate,
  toggleFermata,
  toggleGlissando,
  toggleHairpin,
  toggleSlur,
  toggleTie,
  useClipboardPrompts,
  zoomIn,
  zoomOut,
  QUANTIZE_GRIDS,
  QUANTIZE_GRID_SHORT,
} from '@sudobility/music_editing';
import {
  ACCIDENTAL_OPTIONS,
  ARTICULATION_OPTIONS,
  NO_MARK,
  ORNAMENT_OPTIONS,
  durationDisplay,
  durationParts,
  ticksFor,
  withBase,
  withModifier,
} from '@sudobility/music_types';
import type {
  Accidental,
  Articulation,
  BaseDuration,
  NotationIconName,
  Ornament,
} from '@sudobility/music_types';
import type { EditMode, QuantizeGrid } from '@sudobility/music_editing';
import type { LayoutMode } from '@sudobility/music_drawing';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClipboardIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PencilIcon,
  PlusIcon,
  ScissorsIcon,
  TrashIcon,
} from 'react-native-heroicons/solid';
import { NotationIcon } from '@/components/icons/NotationIcon';
import { useNotationInk } from '@/components/icons/notation-ink';
import { IconButton } from '@/components/layout/IconButton';
import { ToolbarSelect } from '@/components/controls/ToolbarSelect';
import type { ToolbarOption } from '@/components/controls/ToolbarSelect';
import { TrackVisibilitySelect } from './TrackVisibilitySelect';
import { ClipboardPromptSheets } from './ClipboardPromptSheets';
import { ChoiceSheet } from './ChoiceSheet';
import { GoToBarSheet } from './GoToBarSheet';
import type { ReactNode } from 'react';
import type { MusicDocument } from '@/documents/document';

const ICON_SIZE = 18;

/** One row of controls, matching the web bar's `h-8` plus its padding. */
const TOOLBAR_HEIGHT = 44;

/**
 * Note values, drawn with the web toolbar's own glyphs.
 *
 * `NOTATION_ICONS` in music_types holds the shapes; both toolbars replay them,
 * so a semiquaver here is the same drawing as a semiquaver there rather than a
 * lookalike. Unicode was the shortcut, and it does not work: the multi-codepoint
 * musical characters have no coverage in the system font and draw as `?`.
 */
const DURATIONS: readonly { value: BaseDuration; icon: NotationIconName }[] = [
  { value: 'whole', icon: 'WholeNoteIcon' },
  { value: 'half', icon: 'HalfNoteIcon' },
  { value: 'quarter', icon: 'QuarterNoteIcon' },
  { value: 'eighth', icon: 'EighthNoteIcon' },
  { value: 'sixteenth', icon: 'SixteenthNoteIcon' },
  { value: 'thirtysecond', icon: 'ThirtySecondNoteIcon' },
];

const ACCIDENTALS: readonly { value: Accidental; icon: NotationIconName }[] = [
  { value: -2, icon: 'DoubleFlatIcon' },
  { value: -1, icon: 'FlatIcon' },
  { value: 0, icon: 'NaturalIcon' },
  { value: 1, icon: 'SharpIcon' },
  { value: 2, icon: 'DoubleSharpIcon' },
];

/** What a click on a stave does to music already there. */
const EDIT_MODES: readonly { value: EditMode; icon: NotationIconName }[] = [
  { value: 'insert', icon: 'InsertModeIcon' },
  { value: 'replace', icon: 'ReplaceModeIcon' },
  { value: 'stack', icon: 'ChordIcon' },
];

export type EditorToolbarProps = {
  document: MusicDocument;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  /** Starts lyric entry on the active track. */
  onEnterLyrics: () => void;
  /** Shows or hides the property sheet. */
  onToggleInspector: () => void;
  inspectorVisible: boolean;
  /**
   * Asks the server for one more track.
   *
   * Beside Add Track rather than in the title bar: both add a part, and the
   * only difference is who writes the notes.
   */
  onGenerateTrack?: () => void;
};

export function EditorToolbar({
  document,
  layoutMode,
  onLayoutModeChange,
  onEnterLyrics,
  onToggleInspector,
  inspectorVisible,
  onGenerateTrack,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const ink = useNotationInk();
  const store = document.store;
  const score = useStore(store, s => s.score);
  const snapGrid = useStore(store, s => s.snapGrid);
  const editMode = useStore(store, s => s.editMode);
  const zoom = useStore(store, s => s.zoom);
  const noteInput = useStore(store, s => s.noteInput);
  const pitchDisplay = useStore(store, s => s.pitchDisplay);
  const activeVoiceIndex = useStore(store, s => s.activeVoiceIndex);
  const selection = useStore(store, s => s.selection);
  const selectedNotes = useStore(store, selectSelectedNotes);
  const activeTrack = useStore(store, selectSelectedTrack);
  /*
    A boolean, so this re-renders on a transport transition only — not one of
    the high-frequency reads that must stay out of a component's top level.
  */
  const playing = useStore(store, s => s.state) === 'playing';
  /*
    Paste follows the clipboard, the way Copy and Cut follow the selection. It
    used to stay live whether or not anything had been copied, so it was the one
    control on the bar that could look ready and do nothing.
  */
  const hasClipboard = useStore(store, s => s.clipboard !== null);
  const clipboard = useClipboardPrompts(store);

  const [quantizeGrid, setQuantizeGrid] = useState<QuantizeGrid>('sixteenth');
  const [goToBarOpen, setGoToBarOpen] = useState(false);
  const [addTrackOpen, setAddTrackOpen] = useState(false);

  const hasScore = score !== null;
  const canEdit = hasScore && !playing;
  const hasSelection =
    selection.eventIds.length > 0 || selection.measureIds.length > 0;
  const selectedCount = selection.eventIds.length;

  // Asked through the track, because a drum track's program is a kit: Brush
  // sits at 40, the Violin address, which is how the web toolbar came to refuse
  // a three-piece drum hit. The rule lives in music_editing; this only draws it.
  const canStack = canStackOnActiveTrack(store);

  // A mode chosen before the track changed would otherwise refuse every edit,
  // and that refusal only surfaces after you have already played something.
  useEffect(() => {
    if (editMode === 'stack' && !canStack) chooseEditMode(store, 'replace');
  }, [editMode, canStack, store]);

  /**
   * What the one duration control shows: the armed length with nothing
   * selected, the selection's own length when they agree, "…" when they do not.
   */
  const durationShown = useMemo(
    () => durationDisplay(selectedNotes, score?.ppq ?? 480, snapGrid),
    [selectedNotes, score?.ppq, snapGrid],
  );

  const barCount = useMemo(
    () => score?.tracks[0]?.measures.length ?? 0,
    [score],
  );

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  const act = useCallback(
    (run: () => void) => () => {
      // Content edits are refused while the transport plays — the store
      // enforces it, and a dead-looking control is the honest signal.
      if (playing) return;
      run();
    },
    [playing],
  );

  const durationOptions: ToolbarOption[] = DURATIONS.map(d => ({
    value: d.value,
    label: t(`duration.${d.value}`),
    icon: d.icon,
  }));

  /*
    The values and their copy keys come from music_types, so a sixth accidental
    reaches this bar without anybody editing it; only the *glyph* is the app's,
    since a drawing is not something a vocabulary can carry.
  */
  const accidentalOptions: ToolbarOption[] = ACCIDENTAL_OPTIONS.map(option => {
    const glyph = ACCIDENTALS.find(a => a.value === option.value);
    return {
      value: String(option.value),
      label: t(option.labelKey),
      ...(glyph ? { icon: glyph.icon } : {}),
    };
  });

  const articulationOptions: ToolbarOption[] = ARTICULATION_OPTIONS.map(
    option => ({ value: option.value, label: t(option.labelKey) }),
  );

  /*
    `ORNAMENT_CODE` in the renderer crosses `mordent`/`inverted-mordent` over,
    because VexFlow's two codes are the reverse of the words a musician uses.
    Nothing about that belongs here — this offers the words, and even the
    kebab-to-camel spelling of the key is the library's, so this bar and the
    property sheet cannot spell it differently.
  */
  const ornamentOptions: ToolbarOption[] = ORNAMENT_OPTIONS.map(option => ({
    value: option.value,
    label: t(option.labelKey),
  }));

  const quantizeOptions: ToolbarOption[] = QUANTIZE_GRIDS.map(grid => ({
    value: grid,
    label: `${QUANTIZE_GRID_SHORT[grid]} — ${t(`duration.${grid}`)}`,
  }));

  /*
    The rare ones live behind a menu, exactly as the web bar's "More actions"
    does: each is a real action, but none is reached often enough to be worth
    permanent width. Glissando and the three Replace scopes join them here
    rather than getting chips of their own — the web reaches glissando by
    keyboard, which native has no equivalent for, and Replace is a native-only
    entry point that would otherwise be four more chips on the widest bar in
    the app.
  */
  const moreOptions: ToolbarOption[] = [
    { value: 'select-all', label: t('editor.selectAllNotes') },
    { value: 'add-measure', label: t('editor.addMeasure') },
    { value: 'delete-measure', label: t('editor.deleteMeasure') },
    { value: 'go-to-bar', label: t('editor.goToBar') },
    { value: 'enter-lyrics', label: t('editor.enterLyrics') },
    {
      value: 'glissando',
      label: t('editor.glissando'),
      disabled: !canEdit || selectedCount < 2,
    },
  ];

  const handleMoreAction = (value: string): void => {
    if (value === 'select-all') selectAll(store);
    else if (value === 'add-measure') act(() => addMeasure(store))();
    else if (value === 'delete-measure')
      act(() => deleteMeasureAtCaret(store))();
    else if (value === 'go-to-bar') setGoToBarOpen(true);
    else if (value === 'enter-lyrics') act(onEnterLyrics)();
    else if (value === 'glissando') act(() => toggleGlissando(store))();
  };

  return (
    /*
      Two parts on one row: the tools scroll, the view controls do not. They sit
      outside the scrolling region because inside it they are the first thing to
      go past the right edge, reachable only by scrolling the whole bar — which
      is exactly what the web app measured and moved them for.
    */
    <View
      className="border-border bg-card flex-row items-stretch border-b"
      style={{ height: TOOLBAR_HEIGHT }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="toolbar"
        accessibilityLabel={t('editor.toolbar')}
        /*
          The height comes from the row above rather than from a `flexGrow: 0`
          of its own: a horizontal ScrollView has no intrinsic height and takes
          whatever it is offered, which is an empty band above and below the
          controls when nothing bounds it.
        */
        className="flex-1"
        contentContainerClassName="items-center gap-1 px-2"
      >
        {/* Tracks first: which track you are on decides where every other
            control in this bar acts, so it reads left-to-right as "this track,
            then what to do to it". */}
        <Group label={t('editor.tracks')}>
          <TrackVisibilitySelect document={document} />
          {/*
            One control that asks, rather than two that act — the same two
            answers the web app's Add Track menu offers, in the same order.
          */}
          <IconButton
            label={t('editor.addTrack')}
            disabled={!hasScore || playing}
            onPress={() => setAddTrackOpen(true)}
          >
            <PlusIcon size={ICON_SIZE} className="text-foreground" />
          </IconButton>
        </Group>

        <Divider />

        {/*
          One control, not six chips. What it shows depends on the selection —
          see `durationDisplay` — and choosing a value both rewrites every
          selected note and arms the next one, so the control never has to
          explain which of its two jobs it is doing.
        */}
        <ToolbarSelect
          label={t('editor.noteDuration')}
          hint={t('editor.noteDurationHint')}
          options={durationOptions}
          {...(durationShown.kind === 'mixed'
            ? {}
            : { value: durationShown.base })}
          disabled={!hasScore}
          onChange={value =>
            chooseDuration(store, withBase(snapGrid, value as BaseDuration))
          }
        >
          {durationShown.kind === 'mixed' ? (
            // Not the first note's icon and not the armed one: either would
            // claim the selection is something it is not.
            <Text className="text-foreground text-sm">…</Text>
          ) : (
            <NotationIcon
              name={
                DURATIONS.find(d => d.value === durationShown.base)?.icon ??
                'QuarterNoteIcon'
              }
              color={ink.foreground}
            />
          )}
        </ToolbarSelect>

        <Group label={t('editor.durationModifier')}>
          <GlyphChip
            icon="DottedIcon"
            label={t('editor.dotted')}
            hint={t('editor.dottedHint')}
            disabled={!hasScore}
            selected={durationParts(snapGrid).modifier === 'dotted'}
            onPress={() =>
              chooseDuration(store, withModifier(snapGrid, 'dotted'))
            }
          />
          <GlyphChip
            icon="TripletIcon"
            label={t('editor.triplet')}
            hint={t('editor.tripletHint')}
            disabled={!hasScore}
            selected={durationParts(snapGrid).modifier === 'triplet'}
            onPress={() =>
              chooseDuration(store, withModifier(snapGrid, 'triplet'))
            }
          />
        </Group>

        <Divider />

        {/* One picker, not five chips. Accidentals only ever act on a
            selection, so they are not something you reach for constantly while
            entering notes. */}
        <ToolbarSelect
          label={t('editor.accidental')}
          hint={t('editor.accidentalHint')}
          options={accidentalOptions}
          disabled={!canEdit || !hasSelection}
          onChange={value =>
            changeAccidental(store, Number(value) as Accidental)
          }
        >
          <NotationIcon name="SharpIcon" color={ink.foreground} />
        </ToolbarSelect>

        <Divider />

        {/*
          The trigger applies rather than reflects, so no `value` is passed —
          this adds an articulation to the selection, it does not hold one.
        */}
        <ToolbarSelect
          label={t('editor.articulation')}
          hint={t('editor.articulationHint')}
          options={articulationOptions}
          disabled={!canEdit || !hasSelection}
          onChange={value =>
            changeArticulation(
              store,
              value === NO_MARK ? undefined : (value as Articulation),
            )
          }
        >
          <NotationIcon name="ArticulationIcon" color={ink.foreground} />
        </ToolbarSelect>

        <ToolbarSelect
          label={t('editor.ornament')}
          hint={t('editor.ornamentHint')}
          options={ornamentOptions}
          disabled={!canEdit || !hasSelection}
          onChange={value =>
            changeOrnament(
              store,
              value === NO_MARK ? undefined : (value as Ornament),
            )
          }
        >
          <NotationIcon name="OrnamentIcon" color={ink.foreground} />
        </ToolbarSelect>

        <GlyphChip
          icon="TieIcon"
          label={t('editor.toggleTie')}
          hint={t('editor.toggleTie')}
          disabled={!canEdit || !hasSelection}
          onPress={() => toggleTie(store, 'tieStart')}
        />

        <Divider />

        <Group label={t('editor.editMode')}>
          {EDIT_MODES.map(mode => (
            <GlyphChip
              key={mode.value}
              icon={mode.icon}
              label={t(`editor.${mode.value}Mode`)}
              hint={
                mode.value === 'stack' && !canStack
                  ? t('editor.stackModeUnavailable', {
                      instrument:
                        activeTrack?.instrumentName ??
                        t('editor.thisInstrument'),
                    })
                  : t(`editor.${mode.value}ModeHint`)
              }
              selected={editMode === mode.value}
              disabled={!hasScore || (mode.value === 'stack' && !canStack)}
              onPress={() => chooseEditMode(store, mode.value)}
            />
          ))}
        </Group>

        <GlyphChip
          icon="InsertNoteIcon"
          label={t('editor.insertNote')}
          hint={t('editor.insertNoteHint')}
          disabled={!canEdit}
          onPress={() =>
            insertNoteAtCaret(store, defaultInsertPitch(store), {
              advanceCaret: true,
            })
          }
        />

        {/*
          A phrase mark over the selection. Needs two notes — one note cannot
          carry a slur — so it disables rather than doing nothing.
        */}
        <GlyphChip
          icon="SlurIcon"
          label={t('editor.slur')}
          hint={t('editor.slurHint')}
          disabled={!canEdit || selectedCount < 2}
          onPress={() => toggleSlur(store)}
        />
        {/*
          The hairpins. Two chips rather than a menu: crescendo and diminuendo
          are the two things anybody reaches for, and a wedge is faster to
          recognise as a shape than to read as a word. Two notes minimum, like
          the slur — a wedge over one note has nowhere to open.
        */}
        <GlyphChip
          icon="CrescendoIcon"
          label={t('editor.crescendo')}
          hint={t('editor.crescendoHint')}
          disabled={!canEdit || selectedCount < 2}
          onPress={() => toggleHairpin(store, 'crescendo')}
        />
        <GlyphChip
          icon="DiminuendoIcon"
          label={t('editor.diminuendo')}
          hint={t('editor.diminuendoHint')}
          disabled={!canEdit || selectedCount < 2}
          onPress={() => toggleHairpin(store, 'diminuendo')}
        />
        {/* Rolling a chord. One note is enough to select; a lone note simply
            draws nothing. */}
        <GlyphChip
          icon="ArpeggioIcon"
          label={t('editor.arpeggiate')}
          hint={t('editor.arpeggiateHint')}
          disabled={!canEdit || selectedCount === 0}
          onPress={() => toggleArpeggiate(store)}
        />
        {/*
          Beaming overrides. One note is enough for either: a break is a
          property of the note it sits on rather than a span, and so is taking a
          note out of beaming altogether.
        */}
        <GlyphChip
          icon="BeamBreakIcon"
          label={t('editor.beamBreak')}
          hint={t('editor.beamBreakHint')}
          disabled={!canEdit || selectedCount === 0}
          onPress={() => changeBeam(store, 'break')}
        />
        <GlyphChip
          icon="BeamNoneIcon"
          label={t('editor.beamNone')}
          hint={t('editor.beamNoneHint')}
          disabled={!canEdit || selectedCount === 0}
          onPress={() => changeBeam(store, 'none')}
        />
        {/*
          A pause on the selection. One note is enough, unlike the slur beside
          it — a fermata belongs to a single note.
        */}
        <GlyphChip
          icon="FermataIcon"
          label={t('editor.fermata')}
          hint={t('editor.fermataHint')}
          disabled={!canEdit || selectedCount === 0}
          onPress={() => toggleFermata(store)}
        />

        {/*
          Note input is a mode, because a tap cannot mean two things: with it on
          a tap on a stave writes a note at that pitch, with it off the tap aims
          the caret. The caret is what selection ranges, insertion and "play
          from here" are all aimed with, so it stays the default. A pencil, like
          the web's, so the mode is not confused with the Insert Note action
          that shares the notehead glyph.
        */}
        <IconButton
          label={t('editor.noteInput')}
          hint={t('editor.noteInputHint')}
          selected={noteInput}
          disabled={!canEdit}
          onPress={act(() => store.getState().setNoteInput(!noteInput))}
        >
          <PencilIcon
            size={ICON_SIZE}
            className={noteInput ? 'text-primary' : 'text-foreground'}
          />
        </IconButton>

        <GlyphChip
          icon="InsertRestIcon"
          label={t('editor.insertRest')}
          hint={t('editor.insertRestHint')}
          disabled={!canEdit}
          onPress={() => insertRestAtSelection(store)}
        />

        <Group label={t('editor.clipboard')}>
          {/*
            Copy is `copySelection`, not `duplicateSelected`. The two are
            different operations that read alike: one fills the clipboard and
            changes nothing, the other writes a second copy into the score
            straight away. It stays live while the transport plays, because it
            only reads.
          */}
          <IconButton
            label={t('editor.copy')}
            hint={t('editor.copyHint')}
            disabled={!hasScore || !hasSelection}
            onPress={() => store.getState().copySelection()}
          >
            <DocumentDuplicateIcon
              size={ICON_SIZE}
              className="text-foreground"
            />
          </IconButton>
          <IconButton
            label={t('editor.cut')}
            hint={t('editor.cutHint')}
            disabled={!canEdit || !hasSelection}
            onPress={act(clipboard.requestCut)}
          >
            <ScissorsIcon size={ICON_SIZE} className="text-foreground" />
          </IconButton>
          <IconButton
            label={t('editor.paste')}
            hint={t('editor.pasteHint')}
            disabled={!canEdit || !hasClipboard}
            onPress={act(clipboard.requestPaste)}
          >
            <ClipboardIcon size={ICON_SIZE} className="text-foreground" />
          </IconButton>
        </Group>

        <IconButton
          label={t('editor.deleteSelection')}
          hint={t('editor.deleteHint')}
          disabled={!canEdit || !hasSelection}
          onPress={act(() => deleteSelected(store))}
        >
          <TrashIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>

        <Divider />

        <ToolbarSelect
          label={t('editor.quantizeGrid')}
          hint={t('editor.quantizeGridHint')}
          options={quantizeOptions}
          value={quantizeGrid}
          disabled={!hasScore}
          onChange={value => setQuantizeGrid(value as QuantizeGrid)}
        >
          {/* The short form: the trigger is read at a glance, and the full
              words made this the widest control on the web bar. */}
          <Text className="text-foreground text-xs">
            {QUANTIZE_GRID_SHORT[quantizeGrid]}
          </Text>
        </ToolbarSelect>
        <GlyphChip
          icon="QuantizeIcon"
          label={t('editor.quantize')}
          hint={t('editor.quantizeHint')}
          disabled={!canEdit || !hasSelection}
          onPress={() => {
            if (!score) return;
            void quantizeSelection(store, {
              grid: ticksFor(quantizeGrid, score.ppq),
              quantizeStarts: true,
              quantizeDurations: true,
            });
          }}
        />

        <Divider />

        {/* Two voices is where the notation actually needs them — stems up
            against stems down on one stave. More than two is real notation too,
            but nothing else in the editor distinguishes voices yet, so offering
            four would be offering somewhere to lose notes. */}
        <Group label={t('editor.voice')}>
          {[0, 1].map(index => (
            <TextChip
              key={index}
              label={String(index + 1)}
              name={t('editor.voiceNumber', { number: index + 1 })}
              hint={t(`editor.voice${index + 1}Hint`)}
              selected={activeVoiceIndex === index}
              disabled={!hasScore}
              onPress={() => store.getState().setActiveVoice(index)}
            />
          ))}
        </Group>

        <Divider />

        <ToolbarSelect
          label={t('editor.moreActions')}
          options={moreOptions}
          disabled={!hasScore}
          onChange={handleMoreAction}
        >
          <EllipsisHorizontalIcon
            size={ICON_SIZE}
            className="text-foreground"
          />
        </ToolbarSelect>
      </ScrollView>

      {/* Pinned outside the scroller: these change how you look at the score,
          not the score itself. */}
      <View className="border-border flex-row shrink-0 items-center gap-0.5 border-l pl-1">
        {/*
          Zoom is not an edit, so it stays live while the transport plays —
          reading along with the music is exactly when it is wanted.
        */}
        <IconButton
          label={t('editor.zoomOut')}
          onPress={() => store.getState().setZoom(zoomOut(zoom))}
        >
          <MagnifyingGlassMinusIcon
            size={ICON_SIZE}
            className="text-foreground"
          />
        </IconButton>
        {/*
          The name sits on a wrapper: this package's `Text` styles text and
          takes no accessibility props of its own.
        */}
        <View accessibilityLabel={t('editor.currentZoom')} className="w-12">
          <Text className="text-foreground text-center text-xs">
            {zoomLabel}
          </Text>
        </View>
        <IconButton
          label={t('editor.zoomIn')}
          onPress={() => store.getState().setZoom(zoomIn(zoom))}
        >
          <MagnifyingGlassPlusIcon
            size={ICON_SIZE}
            className="text-foreground"
          />
        </IconButton>

        <Group label={t('editor.layoutMode')}>
          <GlyphChip
            icon="PageLayoutIcon"
            label={t('editor.pageLayout')}
            hint={t('editor.pageHint')}
            selected={layoutMode === 'page'}
            onPress={() => onLayoutModeChange('page')}
          />
          <GlyphChip
            icon="ContinuousLayoutIcon"
            label={t('editor.continuousLayout')}
            hint={t('editor.continuousHint')}
            selected={layoutMode === 'continuous'}
            onPress={() => onLayoutModeChange('continuous')}
          />
        </Group>

        {/*
          The label names what tapping *does*, not the current state, which is
          what a button should say — so the two names are two states of one
          control, not two controls.
        */}
        <TextChip
          label={pitchDisplay === 'written' ? 'Wrt' : 'Con'}
          name={
            pitchDisplay === 'written'
              ? t('editor.showConcertPitch')
              : t('editor.showWrittenPitch')
          }
          hint={t('editor.pitchDisplayHint')}
          selected={pitchDisplay === 'written'}
          onPress={() =>
            store
              .getState()
              .setPitchDisplay(
                pitchDisplay === 'written' ? 'concert' : 'written',
              )
          }
        />
      </View>

      {/* Outside the scroller too, so it stays reachable however narrow the
          window gets. It controls the property sheet, not the score. */}
      <View className="flex-row shrink-0 items-center pr-1">
        <IconButton
          label={t('editor.toggleInspector')}
          hint={
            inspectorVisible
              ? t('editor.hideInspector')
              : t('editor.showInspector')
          }
          selected={inspectorVisible}
          onPress={onToggleInspector}
        >
          {inspectorVisible ? (
            <ChevronDoubleRightIcon
              size={ICON_SIZE}
              className="text-foreground"
            />
          ) : (
            <ChevronDoubleLeftIcon
              size={ICON_SIZE}
              className="text-foreground"
            />
          )}
        </IconButton>
      </View>

      <ClipboardPromptSheets clipboard={clipboard} />
      {/*
        Both answers are always listed, and Generate Track is *disabled* rather
        than dropped when the document is not a server project — a menu whose
        entries come and go teaches the reader nothing about where to find
        them, and the detail line can say why it is unavailable where an
        absence cannot.
      */}
      <ChoiceSheet
        open={addTrackOpen}
        title={t('editor.addTrack')}
        message={t('editor.addTrackPrompt')}
        choices={[
          {
            value: 'blank' as const,
            label: t('editor.blankTrack'),
            detail: t('editor.blankTrackHint'),
            primary: true,
          },
          {
            value: 'generate' as const,
            label: t('editor.generateTrack'),
            detail: onGenerateTrack
              ? t('editor.generateTrackHint')
              : t('editor.generateTrackUnavailable'),
            ...(onGenerateTrack ? {} : { disabled: true }),
          },
        ]}
        onChoose={choice => {
          setAddTrackOpen(false);
          // Both answers add content, so both are refused mid-playback — the
          // trigger is already disabled, but the sheet can outlive a play that
          // started under it.
          if (playing) return;
          if (choice === 'blank') addBlankTrack(store);
          else onGenerateTrack?.();
        }}
        onCancel={() => setAddTrackOpen(false)}
      />
      <GoToBarSheet
        open={goToBarOpen}
        barCount={barCount}
        onClose={() => setGoToBarOpen(false)}
        onGo={bar => caretToBar(store, bar)}
      />
    </View>
  );
}

/**
 * Several controls that belong together, under one name.
 *
 * The web writes `role="group"`, which binds them for a screen reader without
 * claiming to be a control itself. React Native has no counterpart, so this is
 * a labelled view: the name is there for anything that walks the tree, and the
 * role is deliberately left off rather than borrowed from something this is
 * not. The toolbar role sits on the scroller, once, as the web puts it on the
 * bar rather than on each group.
 */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessibilityLabel={label} className="flex-row items-center gap-1">
      {children}
    </View>
  );
}

function Divider() {
  return <View className="bg-border mx-1 h-6 w-px" />;
}

/** A toolbar control showing one notation glyph. */
function GlyphChip({
  icon,
  label,
  hint,
  selected = false,
  disabled = false,
  onPress,
}: {
  icon: NotationIconName;
  label: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const ink = useNotationInk();
  return (
    <IconButton
      label={label}
      {...(hint ? { hint } : {})}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
    >
      <View className={selected ? 'bg-primary rounded p-0.5' : 'rounded p-0.5'}>
        {/*
          The colour is passed rather than inherited: `currentColor` is an SVG
          idea react-native-svg does not resolve, so a glyph that relied on it
          would draw black on a selected chip's dark background — and would stay
          black in dark mode, which is what `useNotationInk` fixes.
        */}
        <NotationIcon
          name={icon}
          color={selected ? ink.onPrimary : ink.foreground}
        />
      </View>
    </IconButton>
  );
}

/** A toolbar control showing a word — for the two the web also spells out. */
function TextChip({
  label,
  name,
  hint,
  selected = false,
  disabled = false,
  onPress,
}: {
  /** The word drawn on the chip. */
  label: string;
  /** Its accessible name, when the drawn word is not one (`Wrt`). */
  name?: string;
  hint?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <IconButton
      label={name ?? label}
      {...(hint ? { hint } : {})}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
    >
      {/*
        Two complete class strings rather than one with a hole in it: Tailwind
        extracts classes by scanning source text, so an interpolated variant
        never appears whole in the file and is silently never generated.
      */}
      <View className={selected ? 'bg-primary rounded px-1' : 'rounded px-1'}>
        <Text
          className={
            selected
              ? 'text-primary-foreground text-xs'
              : 'text-foreground text-xs'
          }
        >
          {label}
        </Text>
      </View>
    </IconButton>
  );
}
