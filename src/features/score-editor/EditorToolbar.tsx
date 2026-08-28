/**
 * The editing bar, mirroring the web app's.
 *
 * Same groups in the same order, separated the same way: tracks, then note
 * value with its dotted/triplet modifiers, then accidentals, then articulation
 * and ornament with the tie beside them, then the marks that span a selection
 * (slur, hairpins, arpeggio, beaming, fermata), then insert, then the
 * clipboard, then delete.
 *
 * **Every action is `music_editing`'s.** `chooseDuration`, `changeAccidental`,
 * `toggleTie` and the rest each enforce rules about a score — a hairpin needs
 * two notes, a fermata reads whether the whole selection already has one — and
 * those rules belong in the library, not in a toolbar. This file decides only
 * what is offered and in what order.
 *
 * It scrolls horizontally. The web bar does too, and on a phone it must: there
 * are more controls here than fit any width worth designing for.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import {
  addBlankTrack,
  addMeasure,
  changeAccidental,
  changeArticulation,
  changeBeam,
  chooseDuration,
  deleteSelected,
  insertRestAtSelection,
  toggleArpeggiate,
  toggleFermata,
  toggleHairpin,
  changeOrnament,
  caretToBar,
  chooseEditMode,
  defaultInsertPitch,
  deleteMeasureAtCaret,
  insertNoteAtCaret,
  quantizeSelection,
  selectAll,
  toggleGlissando,
  toggleSlur,
  toggleTie,
  useClipboardPrompts,
  zoomIn,
  zoomOut,
  QUANTIZE_GRIDS,
  QUANTIZE_GRID_SHORT,
} from '@sudobility/music_editing';
import { durationParts, ticksFor, withModifier } from '@sudobility/music_types';
import type {
  Accidental,
  Articulation,
  DurationName,
  Ornament,
} from '@sudobility/music_types';
import type { EditMode, QuantizeGrid } from '@sudobility/music_editing';
import type { LayoutMode } from '@sudobility/music_drawing';
import type { ReplaceScope } from '@sudobility/music_types';
import {
  ClipboardIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PencilIcon,
  PlusIcon,
  ScissorsIcon,
  TrashIcon,
} from 'react-native-heroicons/outline';
import { NotationIcon } from '@/components/icons/NotationIcon';
import type { NotationIconName } from '@sudobility/music_types';
import { IconButton } from '@/components/layout/IconButton';
import { TrackVisibilitySelect } from './TrackVisibilitySelect';
import { ClipboardPromptSheets } from './ClipboardPromptSheets';
import { ChoiceSheet } from './ChoiceSheet';
import { GoToBarSheet } from './GoToBarSheet';
import type { ReactNode } from 'react';
import type { MusicDocument } from '@/documents/document';

const ICON_SIZE = 18;

/** One row of controls, matching the web bar's `h-8` plus its padding. */
const TOOLBAR_HEIGHT = 44;

/*
  Glyph ink. `currentColor` is not resolved by react-native-svg, so the colour
  is handed to each glyph — these match the theme's foreground and its inverse
  on a selected chip.
*/
const DEFAULT_INK = '#18181b';
const SELECTED_INK = '#ffffff';

/**
 * Note values, drawn with the web toolbar's own glyphs.
 *
 * `NOTATION_ICONS` in music_types holds the shapes; both toolbars replay them,
 * so a semiquaver here is the same drawing as a semiquaver there rather than a
 * lookalike. Unicode was the shortcut, and it does not work: the multi-codepoint
 * musical characters have no coverage in the system font and draw as `?`.
 */
const DURATIONS: readonly { name: DurationName; icon: NotationIconName }[] = [
  { name: 'whole', icon: 'WholeNoteIcon' },
  { name: 'half', icon: 'HalfNoteIcon' },
  { name: 'quarter', icon: 'QuarterNoteIcon' },
  { name: 'eighth', icon: 'EighthNoteIcon' },
  { name: 'sixteenth', icon: 'SixteenthNoteIcon' },
  { name: 'thirtysecond', icon: 'ThirtySecondNoteIcon' },
];

const ACCIDENTALS: readonly { value: Accidental; icon: NotationIconName }[] = [
  { value: -2, icon: 'DoubleFlatIcon' },
  { value: -1, icon: 'FlatIcon' },
  { value: 0, icon: 'NaturalIcon' },
  { value: 1, icon: 'SharpIcon' },
  { value: 2, icon: 'DoubleSharpIcon' },
];

/**
 * Articulations.
 *
 * The web draws one `ArticulationIcon` on a select trigger and names the
 * members in its menu, because five near-identical marks are unreadable as a
 * row of glyphs at 18px. The same reasoning holds here, so these stay
 * text-labelled and it is not a shortcut — it is what the web does.
 */
/**
 * Ornaments.
 *
 * `ORNAMENT_CODE` in the renderer crosses `mordent`/`inverted-mordent` over,
 * because VexFlow's two codes are the reverse of the words a musician uses.
 * Nothing about that belongs here — this offers the words.
 */
const ORNAMENTS: readonly { value: Ornament | undefined; labelKey: string }[] =
  [
    { value: undefined, labelKey: 'none' },
    { value: 'trill', labelKey: 'trill' },
    { value: 'mordent', labelKey: 'mordent' },
    { value: 'inverted-mordent', labelKey: 'invertedMordent' },
    { value: 'turn', labelKey: 'turn' },
  ];

/** What a click on a stave does to music already there. */
const EDIT_MODES: readonly { value: EditMode; icon: NotationIconName }[] = [
  { value: 'insert', icon: 'InsertModeIcon' },
  { value: 'replace', icon: 'ReplaceModeIcon' },
  { value: 'stack', icon: 'ChordIcon' },
];

const ARTICULATIONS: readonly {
  value: Articulation | undefined;
  labelKey: string;
}[] = [
  { value: undefined, labelKey: 'none' },
  { value: 'staccato', labelKey: 'staccato' },
  { value: 'accent', labelKey: 'accent' },
  { value: 'tenuto', labelKey: 'tenuto' },
  { value: 'marcato', labelKey: 'marcato' },
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
   * Asks the server to rewrite part of the score.
   *
   * Absent when there is no project behind the document — a local file has no
   * row for a job to write back to. The three scopes differ only in the region
   * they overwrite, which `prepareReplacement` works out from the selection.
   */
  onReplace?: (scope: ReplaceScope) => void;
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
  onReplace,
  onGenerateTrack,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const store = document.store;
  const playing = useStore(store, s => s.state) === 'playing';
  const duration = useStore(store, s => s.snapGrid);
  const editMode = useStore(store, s => s.editMode);
  const score = useStore(store, s => s.score);
  const zoom = useStore(store, s => s.zoom);
  const noteInput = useStore(store, s => s.noteInput);
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

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-border bg-card border-b"
      /*
        A horizontal ScrollView in a column has no intrinsic height and will
        take whatever it is offered, which puts an empty band above and below
        the controls. `flexGrow: 0` makes it size to its content, and the fixed
        height keeps every control on one row rather than letting a tall one
        stretch the bar.
      */
      style={{ flexGrow: 0, flexShrink: 0, height: TOOLBAR_HEIGHT }}
      contentContainerClassName="items-center gap-1 px-2"
    >
      <Group label={t('editor.tracks')}>
        <TrackVisibilitySelect document={document} />
        {/*
          One control that asks, rather than two that act — the same two
          answers the web app's Add Track menu offers, in the same order. It
          used to be a bare icon that added a blank track on the spot, sharing
          its glyph with Add Bar two groups along, so there was no way to tell
          the two apart and nowhere for "Generate Track" to live.
        */}
        <IconButton
          label={t('editor.addTrack')}
          disabled={playing}
          onPress={() => setAddTrackOpen(true)}
        >
          <PlusIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>
      </Group>

      <Divider />

      <Group label={t('editor.noteValue')}>
        {DURATIONS.map(d => (
          <GlyphChip
            key={d.name}
            icon={d.icon}
            label={t(`duration.${d.name}`)}
            selected={durationParts(duration).base === d.name}
            disabled={playing}
            onPress={act(() => chooseDuration(store, d.name))}
          />
        ))}

        {/* Duration modifiers, which apply to whatever value is chosen. */}
        <GlyphChip
          icon="DottedIcon"
          label={t('editor.dotted')}
          hint={t('editor.dottedHint')}
          disabled={playing}
          selected={durationParts(duration).modifier === 'dotted'}
          onPress={act(() =>
            chooseDuration(store, withModifier(duration, 'dotted')),
          )}
        />
        <GlyphChip
          icon="TripletIcon"
          label={t('editor.triplet')}
          hint={t('editor.tripletHint')}
          disabled={playing}
          selected={durationParts(duration).modifier === 'triplet'}
          onPress={act(() =>
            chooseDuration(store, withModifier(duration, 'triplet')),
          )}
        />
      </Group>

      <Divider />

      <Group label={t('editor.accidental')}>
        {ACCIDENTALS.map(a => (
          <GlyphChip
            key={a.value}
            icon={a.icon}
            label={t(`accidental.${a.value}`)}
            disabled={playing}
            onPress={act(() => changeAccidental(store, a.value))}
          />
        ))}
      </Group>

      <Divider />

      <Group label={t('editor.articulation')}>
        {ARTICULATIONS.map(a => (
          <TextChip
            key={a.labelKey}
            label={t(`articulation.${a.labelKey}`)}
            disabled={playing}
            onPress={act(() => changeArticulation(store, a.value))}
          />
        ))}
      </Group>

      <Divider />

      <Group label={t('editor.ornament')}>
        {ORNAMENTS.map(o => (
          <TextChip
            key={o.labelKey}
            label={t(`ornament.${o.labelKey}`)}
            disabled={playing}
            onPress={act(() => changeOrnament(store, o.value))}
          />
        ))}
      </Group>

      <Divider />

      <Group label={t('editor.editMode')}>
        {/*
          Note input is a mode, because a tap cannot mean two things: with it on
          a tap on a stave writes a note at that pitch, with it off the tap aims
          the caret. The caret is what selection ranges, insertion and "play
          from here" are all aimed with, so it stays the default.
        */}
        <GlyphChip
          icon="InsertNoteIcon"
          label={t('editor.noteInput')}
          hint={t('editor.noteInputHint')}
          selected={noteInput}
          disabled={playing}
          onPress={act(() => store.getState().setNoteInput(!noteInput))}
        />
        {EDIT_MODES.map(m => (
          <GlyphChip
            key={m.value}
            icon={m.icon}
            label={t(`editor.${m.value}Mode`)}
            selected={editMode === m.value}
            disabled={playing}
            onPress={act(() => chooseEditMode(store, m.value))}
          />
        ))}
      </Group>

      <Divider />

      <Group label={t('editor.marks')}>
        <GlyphChip
          icon="TieIcon"
          label={t('editor.toggleTie')}
          hint={t('editor.toggleTie')}
          disabled={playing}
          onPress={act(() => toggleTie(store, 'tieStart'))}
        />
        <GlyphChip
          icon="SlurIcon"
          label={t('editor.slur')}
          hint={t('editor.slurHint')}
          disabled={playing}
          onPress={act(() => toggleSlur(store))}
        />
        <GlyphChip
          icon="CrescendoIcon"
          label={t('editor.crescendo')}
          hint={t('editor.crescendoHint')}
          disabled={playing}
          onPress={act(() => toggleHairpin(store, 'crescendo'))}
        />
        <GlyphChip
          icon="DiminuendoIcon"
          label={t('editor.diminuendo')}
          hint={t('editor.diminuendoHint')}
          disabled={playing}
          onPress={act(() => toggleHairpin(store, 'diminuendo'))}
        />
        <GlyphChip
          icon="ArpeggioIcon"
          label={t('editor.arpeggiate')}
          hint={t('editor.arpeggiateHint')}
          disabled={playing}
          onPress={act(() => toggleArpeggiate(store))}
        />
        <GlyphChip
          icon="FermataIcon"
          label={t('editor.fermata')}
          hint={t('editor.fermataHint')}
          disabled={playing}
          onPress={act(() => toggleFermata(store))}
        />
        <GlyphChip
          icon="BeamBreakIcon"
          label={t('editor.beamBreak')}
          hint={t('editor.beamBreakHint')}
          disabled={playing}
          onPress={act(() => changeBeam(store, 'break'))}
        />
        <GlyphChip
          icon="BeamNoneIcon"
          label={t('editor.beamNone')}
          hint={t('editor.beamNoneHint')}
          disabled={playing}
          onPress={act(() => changeBeam(store, 'none'))}
        />
        <TextChip
          label={t('editor.glissando')}
          hint={t('editor.glissandoHint')}
          disabled={playing}
          onPress={act(() => toggleGlissando(store))}
        />
      </Group>

      <Divider />

      <Group label={t('editor.insert')}>
        <IconButton
          label={t('editor.insertRest')}
          hint={t('editor.insertRestHint')}
          disabled={playing}
          onPress={act(() => insertRestAtSelection(store))}
        >
          <NotationIcon name="InsertRestIcon" color={DEFAULT_INK} />
        </IconButton>
        <IconButton
          label={t('editor.insertNote')}
          disabled={playing}
          onPress={act(() =>
            insertNoteAtCaret(store, defaultInsertPitch(store), {
              advanceCaret: true,
            }),
          )}
        >
          <NotationIcon name="InsertNoteIcon" color={DEFAULT_INK} />
        </IconButton>
        <IconButton
          label={t('editor.addMeasure')}
          disabled={playing}
          onPress={act(() => addMeasure(store))}
        >
          <NotationIcon name="AddMeasureIcon" color={DEFAULT_INK} />
        </IconButton>
        <IconButton
          label={t('editor.deleteMeasure')}
          disabled={playing}
          onPress={act(() => deleteMeasureAtCaret(store))}
        >
          <NotationIcon name="DeleteMeasureIcon" color={DEFAULT_INK} />
        </IconButton>
        <IconButton
          label={t('editor.selectAll')}
          disabled={playing}
          onPress={act(() => selectAll(store))}
        >
          <NotationIcon name="SelectAllIcon" color={DEFAULT_INK} />
        </IconButton>
      </Group>

      <Divider />

      <Group label={t('editor.clipboard')}>
        <IconButton
          label={t('editor.cut')}
          hint={t('editor.cutHint')}
          disabled={playing}
          onPress={act(clipboard.requestCut)}
        >
          <ScissorsIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>
        {/*
          Copy is `editingCopy`, not `duplicateSelected`. The two are different
          operations that read alike: one fills the clipboard and changes
          nothing, the other writes a second copy into the score straight away.
        */}
        <IconButton
          label={t('editor.copy')}
          hint={t('editor.copyHint')}
          onPress={() => store.getState().copySelection()}
        >
          <DocumentDuplicateIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>
        <IconButton
          label={t('editor.paste')}
          hint={t('editor.pasteHint')}
          disabled={playing || !hasClipboard}
          onPress={act(clipboard.requestPaste)}
        >
          <ClipboardIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>
        <IconButton
          label={t('editor.deleteSelection')}
          hint={t('editor.deleteHint')}
          disabled={playing}
          onPress={act(() => deleteSelected(store))}
        >
          <TrashIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>
      </Group>

      <Divider />

      <Group label={t('editor.quantize')}>
        {QUANTIZE_GRIDS.map(grid => (
          <TextChip
            key={grid}
            label={QUANTIZE_GRID_SHORT[grid]}
            name={t('editor.quantizeGrid', { grid: QUANTIZE_GRID_SHORT[grid] })}
            hint={t('editor.quantizeGridHint')}
            selected={quantizeGrid === grid}
            onPress={() => setQuantizeGrid(grid)}
          />
        ))}
        <IconButton
          label={t('editor.quantize')}
          hint={t('editor.quantizeHint')}
          disabled={playing || !score}
          onPress={act(() => {
            if (!score) return;
            void quantizeSelection(store, {
              grid: ticksFor(quantizeGrid, score.ppq),
              quantizeStarts: true,
              quantizeDurations: true,
            });
          })}
        >
          <NotationIcon name="QuantizeIcon" color={DEFAULT_INK} />
        </IconButton>
      </Group>

      <Divider />

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
        <Text className="text-muted-foreground w-12 text-center text-xs">
          {zoomLabel}
        </Text>
        <IconButton
          label={t('editor.zoomIn')}
          onPress={() => store.getState().setZoom(zoomIn(zoom))}
        >
          <MagnifyingGlassPlusIcon
            size={ICON_SIZE}
            className="text-foreground"
          />
        </IconButton>
      </Group>

      <Divider />

      <Group label={t('editor.moreActions')}>
        <TextChip
          label={t('editor.goToBar')}
          onPress={() => setGoToBarOpen(true)}
        />
        <TextChip
          label={t('editor.enterLyrics')}
          disabled={playing}
          onPress={act(onEnterLyrics)}
        />
        <IconButton
          label={t('editor.toggleInspector')}
          selected={inspectorVisible}
          onPress={onToggleInspector}
        >
          <PencilIcon size={ICON_SIZE} className="text-foreground" />
        </IconButton>
      </Group>

      {onReplace ? (
        <>
          <Divider />
          <Group label={t('replace.action')}>
            <TextChip
              label={t('replace.notesTitle')}
              disabled={playing}
              onPress={act(() => onReplace('notes'))}
            />
            <TextChip
              label={t('replace.measuresTitle')}
              disabled={playing}
              onPress={act(() => onReplace('measures'))}
            />
            <TextChip
              label={t('replace.trackTitle')}
              disabled={playing}
              onPress={act(() => onReplace('track'))}
            />
          </Group>
        </>
      ) : null}

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
    </ScrollView>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel={label}
      className="flex-row items-center gap-1"
    >
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
          would draw black on a selected chip's dark background.
        */}
        <NotationIcon
          name={icon}
          color={selected ? SELECTED_INK : DEFAULT_INK}
        />
      </View>
    </IconButton>
  );
}

/** A toolbar control showing a word — for marks the web also spells out. */
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
  /** Its accessible name, when the drawn word is not one (`1/16`). */
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
            selected ? 'text-xs text-white' : 'text-foreground text-xs'
          }
        >
          {label}
        </Text>
      </View>
    </IconButton>
  );
}
