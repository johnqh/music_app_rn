/**
 * The selected note's properties — the web inspector's Note tab, control for
 * control.
 *
 * **It says note values, bar numbers and pitch names, never ticks.**
 * `Duration 480` states the storage format; the reader is looking at a quarter
 * note. The conversions are music_types' `music-vocabulary` — music theory, not
 * panel code — and `durationNameForTicks` answers `null` for a length no single
 * notehead spells, which shows as Custom rather than being relabelled as the
 * nearest name.
 *
 * **Pitch is edited through the display lens, never round-tripped.** The step,
 * accidental and octave a reader sees on a transposing instrument or inside an
 * `8va` are not what is stored, so a patch is applied to what is *shown* and
 * converted once by `setNotePitch`. Feeding the stored pitch back through the
 * lens would move it by the transposition every time the panel was touched.
 *
 * **Every field answers for the whole selection.** Where the selected notes
 * agree the value is shown; where they do not it reads "Mixed" and setting it
 * applies to all of them — the same `commonValue` rule the web panel uses. A
 * panel that showed only the first note's value would silently misreport what a
 * change was about to do.
 *
 * **What a field offers and commits is shared.** `durationFieldState` tells a
 * custom length from a disagreeing selection, `noteTextFieldsVisible` decides
 * when the free-text fields appear, `changeVelocity` rounds and clamps, and the
 * number fields go through `parseNumericDraft` on blur (`NumberDraftInput`) —
 * the same functions the web's Note tab calls. **The whole tab locks while the
 * transport plays** (`selectEditLocked`, decision 4 of the parity plan): every
 * field on it writes notes.
 */
import { useCallback, useEffect, useState } from 'react';
import { OTTAVAS } from '@sudobility/music_types';
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Switch, Text } from '@sudobility/components-rn';
import {
  changeAccidental,
  changeArticulation,
  changeDuration,
  changeVelocity,
  clearGraceNotes,
  moveNoteToTick,
  displayedPitchForNote,
  noteTextFieldsVisible,
  selectEditLocked,
  selectSelectedNotes,
  setChordSymbol,
  setDynamic,
  setFingering,
  setNotePitch,
  setVoice,
  toGraceNote,
  toggleGlissando,
  toggleOttava,
  toggleTie,
} from '@sudobility/music_editing';
import {
  ACCIDENTAL_OPTIONS,
  ARTICULATION_OPTIONS,
  DURATION_NAMES,
  DYNAMIC_OPTIONS,
  MAX_OCTAVE,
  MIN_OCTAVE,
  NO_MARK,
  PITCH_STEPS,
  barBeatCommitTick,
  barBeatForTick,
  commonValue,
  durationFieldState,
  findEvent,
  findTrack,
  formatBeatForField,
  voiceNumberOf,
} from '@sudobility/music_types';
import type {
  Accidental,
  Articulation,
  Dynamic,
  DurationName,
  NoteEvent,
  Pitch,
  PitchStep,
  Score,
} from '@sudobility/music_types';
import { DraftInput, NumberDraftInput } from './DraftInput';
import { EmptyTab, Field } from './Field';
import { ReplaceButton } from './ReplaceButton';
import type { ReplaceScope } from '@sudobility/music_types';
import type { MusicDocument } from '@/documents/document';

export function NoteTab({
  document,
  onReplace,
}: {
  document: MusicDocument;
  onReplace?: (scope: ReplaceScope) => void;
}) {
  const { t } = useTranslation();
  const store = document.store;
  const score = useStore(store, s => s.score);
  const pitchDisplay = useStore(store, s => s.pitchDisplay);
  const notes = useStore(store, selectSelectedNotes);
  // Content is immutable while the transport plays; every field here writes
  // notes, so the whole tab locks.
  const locked = useStore(store, selectEditLocked);

  const shown = useCallback(
    (note: NoteEvent): Pitch =>
      score ? displayedPitchForNote(score, note, pitchDisplay) : note.pitch,
    [score, pitchDisplay],
  );

  /**
   * Answers whether any note changed, so a draft the store refused (an octave
   * outside the compass, the playback lock) goes back to what is stored.
   */
  const applyPitchPatch = useCallback(
    (patch: Partial<Pitch>): boolean => {
      if (!score) return false;
      let changed = false;
      for (const note of notes) {
        // The patch is against what the reader is *seeing*, so apply it there
        // and convert once. Never a round trip: the stored pitch is replaced
        // outright rather than fed back through the lens.
        if (
          setNotePitch(
            store,
            note.id,
            { ...shown(note), ...patch },
            pitchDisplay,
          )
        )
          changed = true;
      }
      return changed;
    },
    [store, score, notes, shown, pitchDisplay],
  );

  if (!score) return <EmptyTab message={t('inspector.noScore')} />;
  if (notes.length === 0)
    return <EmptyTab message={t('inspector.selectNote')} />;

  const first = notes[0];
  if (!first) return <EmptyTab message={t('inspector.selectNote')} />;

  const mixed = t('inspector.mixed');
  const step = commonValue(notes.map(n => shown(n).step));
  const accidental = commonValue(notes.map(n => String(shown(n).accidental)));
  const octave = commonValue(notes.map(n => shown(n).octave));
  /*
    Three states, not two: a name, one custom length the selection agrees on
    (a tie join or an import can make a length no notehead spells), or a
    selection that disagrees. This field used to derive them from two
    `commonValue`s and reported every tie-joined note as Mixed until that was
    patched here; `durationFieldState` is the web's answer to the same question.
  */
  const duration = durationFieldState(notes, score.ppq);
  const velocity = commonValue(notes.map(n => n.velocity));
  const articulation = commonValue(notes.map(n => n.articulation ?? NO_MARK));
  const dynamic = commonValue(notes.map(n => n.dynamic ?? NO_MARK));
  const trackName = commonValue(
    notes.map(n => findTrack(score, n.trackId)?.name ?? '?'),
  );
  const voice = commonValue(notes.map(n => voiceNumberOf(score, n)));
  const tieStart = commonValue(notes.map(n => n.tieStart === true));
  const tieStop = commonValue(notes.map(n => n.tieStop === true));
  const graceCount = first.graceNotes?.length ?? 0;

  return (
    <View className="gap-3">
      <Text className="text-foreground text-base font-semibold">
        {notes.length > 1
          ? t('inspector.notesSelected', { count: notes.length })
          : t('inspector.note')}
      </Text>

      {/* Step, accidental and octave on one row, as the web lays them out —
          they are three halves of one answer to "which note is this". */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label={t('inspector.pitch')}>
            <Select
              value={step ?? ''}
              accessibilityLabel={t('inspector.pitch')}
              disabled={locked}
              placeholder={mixed}
              options={PITCH_STEPS.map((s: PitchStep) => ({
                value: s,
                label: s,
              }))}
              onValueChange={(value: string) =>
                applyPitchPatch({ step: value as PitchStep })
              }
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={t('editor.accidental')}>
            <Select
              value={accidental ?? ''}
              accessibilityLabel={t('editor.accidental')}
              disabled={locked}
              placeholder={mixed}
              options={ACCIDENTAL_OPTIONS.map(option => ({
                value: String(option.value),
                label: t(option.labelKey),
              }))}
              /*
                Through `changeAccidental`, not `applyPitchPatch`: an accidental
                is a respelling of the selection, and the command already knows
                how to apply one to every selected note at once.
              */
              onValueChange={(value: string) =>
                changeAccidental(store, Number(value) as Accidental)
              }
            />
          </Field>
        </View>
        <View className="flex-1">
          <Field label={t('inspector.octave')}>
            <NumberDraftInput
              value={octave}
              min={MIN_OCTAVE}
              max={MAX_OCTAVE}
              integer
              editable={!locked}
              mixedPlaceholder={mixed}
              accessibilityLabel={t('inspector.octave')}
              onCommit={value => applyPitchPatch({ octave: value })}
            />
          </Field>
        </View>
      </View>

      <Field label={t('inspector.duration')}>
        <Select
          value={duration?.kind === 'name' ? duration.name : ''}
          accessibilityLabel={t('inspector.duration')}
          disabled={locked}
          placeholder={
            duration?.kind === 'custom'
              ? t('inspector.customDuration', { ticks: duration.ticks })
              : mixed
          }
          options={DURATION_NAMES.map((name: DurationName) => ({
            value: name,
            label: t(`duration.${name}`),
          }))}
          onValueChange={(value: string) =>
            changeDuration(store, value as DurationName)
          }
        />
      </Field>

      {/*
        The note's own velocity, which a dynamic does not overwrite — it is the
        *deviation* from the level in force, so an accent inside a quiet passage
        stays an accent. Overwriting it outright, which most notation software
        does, would make this field silently inert the moment a passage was
        marked.
      */}
      <Field label={t('inspector.velocity')}>
        {/* `changeVelocity` rounds and clamps to 0-127 itself, and answers
            false for a write it refused, which resets the draft. */}
        <NumberDraftInput
          value={velocity}
          min={0}
          max={127}
          integer
          editable={!locked}
          mixedPlaceholder={mixed}
          accessibilityLabel={t('inspector.velocity')}
          onCommit={value => changeVelocity(store, value)}
        />
      </Field>

      <Field label={t('inspector.articulation')}>
        <Select
          value={articulation ?? ''}
          accessibilityLabel={t('inspector.articulation')}
          disabled={locked}
          placeholder={mixed}
          options={ARTICULATION_OPTIONS.map(option => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          onValueChange={(value: string) =>
            changeArticulation(
              store,
              value === NO_MARK ? undefined : (value as Articulation),
            )
          }
        />
      </Field>

      <Field label={t('inspector.dynamic')} hint={t('inspector.dynamicHint')}>
        {/*
          A dynamic marks the note a level *begins* at and is in force until the
          next marking — so setting one here makes a passage loud, and there is
          nothing to apply to the notes between.
        */}
        <Select
          value={dynamic ?? ''}
          accessibilityLabel={t('inspector.dynamic')}
          disabled={locked}
          placeholder={mixed}
          options={DYNAMIC_OPTIONS.map(option => ({
            value: option.value,
            label: option.value === NO_MARK ? t(option.labelKey) : option.value,
          }))}
          onValueChange={(value: string) =>
            setDynamic(
              store,
              notes.map(n => n.id),
              value === NO_MARK ? undefined : (value as Dynamic),
            )
          }
        />
      </Field>

      {/*
        Free text belonging to one notehead each, so shown for exactly one note
        (`noteTextFieldsVisible`): a draft seeded from the first of several
        notes would overwrite the rest with its value on blur.
      */}
      {noteTextFieldsVisible(notes) ? (
        <Field label={t('inspector.chordSymbol')}>
          {/*
          Stored as typed. `C-7`, `Cmin7` and `Cm7` are one chord written three
          ways, and only the root is ever parsed.
        */}
          <DraftInput
            value={first.chordSymbol ?? ''}
            placeholder={t('inspector.chordSymbolPlaceholder')}
            editable={!locked}
            onCommit={text => setChordSymbol(store, first.id, text)}
            accessibilityLabel={t('inspector.chordSymbol')}
          />
        </Field>
      ) : null}

      {noteTextFieldsVisible(notes) ? (
        <Field label={t('inspector.fingering')}>
          {/*
          A string, not a number: piano uses 1-5, guitar adds `T`, and editions
          write `1-2` for a substitution.
        */}
          <DraftInput
            value={first.fingering ?? ''}
            editable={!locked}
            // `setFingering` trims and clears on blank; text that trims to
            // what the note already carries writes nothing and resets.
            onCommit={text => setFingering(store, text)}
            accessibilityLabel={t('inspector.fingering')}
          />
        </Field>
      ) : null}

      {/*
        Where the note sits, counted the way a player counts — `barBeatForTick`
        skips pickups, so this is the bar they would count. Editable, as the
        web's is: typing a bar or a beat moves the note, because stating a
        position exactly is the reason to have this field at all. For one note
        only (the web rule): a position typed over several would stack them.
      */}
      {notes.length === 1 ? (
        <BarBeatFields
          store={store}
          score={score}
          noteId={first.id}
          tick={first.startTick}
          editable={!locked}
          onCommit={tick => moveNoteToTick(store, first.id, tick)}
        />
      ) : null}

      <View className="flex-row gap-2">
        {/* Which part this note is in. Read-only: a note is moved between
            tracks by dragging it, not by retyping the track's name here. */}
        <View className="flex-1">
          <Field label={t('inspector.track')}>
            <Text className="text-foreground text-base">
              {trackName ?? mixed}
            </Text>
          </Field>
        </View>
        <View className="flex-1">
          <Field label={t('inspector.voice')}>
            {/*
              Counted from 1, to match the toolbar's Voice 1 / Voice 2. The
              same note used to read "Voice 1" on the bar and 0 here.

              Editable, as the web's is: moving a note between voices is how a
              second line on one stave is built, and this panel could only
              report which voice a note was in.
            */}
            <NumberDraftInput
              value={voice}
              min={1}
              integer
              editable={!locked}
              mixedPlaceholder={mixed}
              accessibilityLabel={t('inspector.voice')}
              onCommit={value =>
                setVoice(
                  store,
                  notes.map(n => n.id),
                  value - 1,
                )
              }
            />
          </Field>
        </View>
      </View>

      {/*
        A tie joins two notes of the *same pitch* into one sounding note. Kept
        apart from the slur beside it, which groups different pitches as one
        phrase and joins nothing.
      */}
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground text-base">
          {t('inspector.tieStart')}
        </Text>
        <Switch
          checked={tieStart === true}
          disabled={locked}
          onCheckedChange={() => toggleTie(store, 'tieStart')}
          accessibilityLabel={t('inspector.tieStart')}
        />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground text-base">
          {t('inspector.tieStop')}
        </Text>
        <Switch
          checked={tieStop === true}
          disabled={locked}
          onCheckedChange={() => toggleTie(store, 'tieStop')}
          accessibilityLabel={t('inspector.tieStop')}
        />
      </View>

      {/*
        Spans need two notes — a slide from a note to itself is nothing — so
        this disables rather than doing nothing, the way the toolbar's slur and
        hairpins do.
      */}
      <Field label={t('inspector.spans')}>
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={locked || notes.length < 2}
            onPress={() => toggleGlissando(store)}
            accessibilityLabel={t('inspector.glissando')}
          >
            {t('inspector.glissando')}
          </Button>
          {/*
            The octave brackets, which this panel had no way to apply at all.

            A display lens rather than a transposition: the model stores
            *sounding* pitch, and `8va` means "these were written an octave
            lower to keep them on the stave" — `ottavaScore` shifts the
            noteheads the opposite way from the bracket. Two notes minimum, like
            every other span here.
          */}
          {OTTAVAS.map(kind => (
            <Button
              key={kind}
              variant="secondary"
              disabled={locked || notes.length < 2}
              onPress={() => toggleOttava(store, kind)}
              accessibilityLabel={kind}
            >
              {kind}
            </Button>
          ))}
        </View>
      </Field>

      {/*
        A grace note hangs off the note it decorates and takes no time from the
        bar. `toGraceNote` takes the note *out* of the voice and leaves a rest
        of the same length, so the bar still adds up.
      */}
      {notes.length === 1 ? (
        <Field label={t('inspector.ornaments')}>
          <View className="gap-2">
            <Button
              variant="secondary"
              disabled={locked}
              onPress={() => toGraceNote(store, first.id)}
              accessibilityLabel={t('inspector.makeGraceNote')}
            >
              {t('inspector.makeGraceNote')}
            </Button>
            {graceCount > 0 ? (
              <Button
                variant="ghost"
                disabled={locked}
                onPress={() => clearGraceNotes(store, [first.id])}
                accessibilityLabel={t('inspector.clearGraceNotes', {
                  count: graceCount,
                })}
              >
                {t('inspector.clearGraceNotes', { count: graceCount })}
              </Button>
            ) : null}
          </View>
        </Field>
      ) : null}

      {onReplace ? (
        <ReplaceButton
          document={document}
          scope="notes"
          label={t('inspector.replaceNotes')}
          onReplace={onReplace}
        />
      ) : null}
    </View>
  );
}

/**
 * A note's position as a bar and a beat — the web's `BarBeatField`.
 *
 * Two drafts, committed together when either field is left: "bar 12, beat 3"
 * is one position said in two numbers, and committing per keystroke would move
 * the note through every intermediate one. The beat takes a decimal so an
 * off-beat note can be stated exactly (a swung eighth is 2.5), shown to two
 * places by `formatBeatForField`; `barBeatCommitTick` clamps a beat past the end
 * of its bar and answers null for a bar that does not exist. Whatever does not
 * move the note — blank, nonsense, no such bar, the tick it already has, a
 * move the store refused — puts both fields back to where the note is.
 *
 * **A refusal is also said.** Resetting alone is indistinguishable from a typo
 * being snapped back, so a move the store declined raises a toast, which is the
 * queue every other editing refusal on this app reaches — an out-of-range pitch
 * from music_editing, and an instrument too narrow for a part from the Track
 * tab.
 *
 * **Where the note is now is read from the store, not from the `tick` prop**,
 * and that is what keeps the refusal honest. Pressing Return fires
 * `onSubmitEditing` *and* — because a single-line `TextInput` blurs on submit —
 * `onBlur`, both before React has re-rendered, so `commit` runs twice against
 * one stale `tick`. The second run recomputed the same target, `moveNoteToTick`
 * found the note already there and answered false, and the panel announced that
 * a move which had just succeeded could not be made. Against the live tick the
 * second run is `barBeatCommitTick`'s own "the tick it already has is not a
 * move" and does nothing at all.
 */
function BarBeatFields({
  store,
  score,
  noteId,
  tick,
  editable,
  onCommit,
}: {
  store: MusicDocument['store'];
  score: Score;
  /** Whose position this is — used to re-read the live tick when committing. */
  noteId: string;
  tick: number;
  editable: boolean;
  /** Whether the move landed — see music_editing's `moveNoteToTick`. */
  onCommit: (tick: number) => boolean;
}) {
  const { t } = useTranslation();
  const position = barBeatForTick(score, tick);
  // Primitives, so the re-seed below runs when the *values* change: `position`
  // is a fresh object every render.
  const bar = position ? String(position.bar) : '';
  const beat = position ? formatBeatForField(position.beat) : '';
  const [barDraft, setBarDraft] = useState(bar);
  const [beatDraft, setBeatDraft] = useState(beat);
  useEffect(() => {
    setBarDraft(bar);
    setBeatDraft(beat);
  }, [bar, beat]);

  if (!position) return null;

  const commit = () => {
    // Everything about turning two drafts into a tick — a cleared box is "no
    // change" and never bar 0, a bar the score has not got is nothing to
    // commit, the note's own tick is not a move — is music_types', and shared
    // with the web's `BarBeatField`. Asked against the score as it is *now*,
    // so a second call for the same keypress sees the move already made.
    const live = store.getState().score ?? score;
    const event = findEvent(live, noteId);
    const next = barBeatCommitTick(
      live,
      barDraft,
      beatDraft,
      event?.startTick ?? tick,
    );
    if (next !== null && !onCommit(next))
      store.getState().pushToast({
        message: t('inspector.moveRefused'),
        severity: 'warning',
      });
    // Back to where the note is, whatever happened: blank, no such bar, or a
    // move the store refused (which leaves the tick, and so the re-seed
    // above, untouched). A move that landed re-seeds both from the new tick.
    setBarDraft(bar);
    setBeatDraft(beat);
  };

  return (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <Field label={t('inspector.bar')}>
          <Input
            value={barDraft}
            onChangeText={setBarDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="numeric"
            editable={editable}
            accessibilityLabel={t('inspector.bar')}
          />
        </Field>
      </View>
      <View className="flex-1">
        <Field label={t('inspector.beat')}>
          <Input
            value={beatDraft}
            onChangeText={setBeatDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            editable={editable}
            accessibilityLabel={t('inspector.beat')}
          />
        </Field>
      </View>
    </View>
  );
}
