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
 */
import { useCallback } from 'react';
import { OTTAVAS } from '@sudobility/music_types';
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import {
  Button,
  NumberInput,
  Select,
  Switch,
  Text,
} from '@sudobility/components-rn';
import {
  changeAccidental,
  changeArticulation,
  changeDuration,
  changeVelocity,
  clearGraceNotes,
  displayedPitchForNote,
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
  NO_MARK,
  PITCH_STEPS,
  barBeatForTick,
  commonValue,
  durationNameForTicks,
  findTrack,
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
} from '@sudobility/music_types';
import { DraftInput } from './DraftInput';
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
  // Content is immutable while the transport plays; these write notes.
  const playing = useStore(store, s => s.state) === 'playing';

  const shown = useCallback(
    (note: NoteEvent): Pitch =>
      score ? displayedPitchForNote(score, note, pitchDisplay) : note.pitch,
    [score, pitchDisplay],
  );

  const applyPitchPatch = useCallback(
    (patch: Partial<Pitch>): void => {
      if (!score) return;
      for (const note of notes) {
        // The patch is against what the reader is *seeing*, so apply it there
        // and convert once. Never a round trip: the stored pitch is replaced
        // outright rather than fed back through the lens.
        setNotePitch(
          store,
          note.id,
          { ...shown(note), ...patch },
          pitchDisplay,
        );
      }
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
  const durationName = commonValue(
    notes.map(n => durationNameForTicks(n.durationTicks, score.ppq)),
  );
  /*
    `durationNameForTicks` answers null for a length no single notehead spells,
    and `commonValue` answers null when the selection disagrees — so the name
    alone cannot tell "custom" from "mixed", and this field reported every
    tie-joined or imported note as Mixed. The ticks separate them: agreed ticks
    with no name is one custom length, which is what the web app names.
  */
  const durationTicks = commonValue(notes.map(n => n.durationTicks));
  const velocity = commonValue(notes.map(n => n.velocity));
  const articulation = commonValue(notes.map(n => n.articulation ?? NO_MARK));
  const dynamic = commonValue(notes.map(n => n.dynamic ?? NO_MARK));
  const trackName = commonValue(
    notes.map(n => findTrack(score, n.trackId)?.name ?? '?'),
  );
  const voice = commonValue(notes.map(n => voiceNumberOf(score, n)));
  const tieStart = commonValue(notes.map(n => n.tieStart === true));
  const tieStop = commonValue(notes.map(n => n.tieStop === true));
  const at = barBeatForTick(score, first.startTick);
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
              disabled={playing}
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
              disabled={playing}
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
            {/* The name sits on a wrapper: `NumberInput` takes no
                accessibility props of its own. */}
            <View accessibilityLabel={t('inspector.octave')}>
              <NumberInput
                value={octave ?? 4}
                min={-1}
                max={9}
                disabled={playing}
                onChange={(value: number) => applyPitchPatch({ octave: value })}
              />
            </View>
          </Field>
        </View>
      </View>

      <Field label={t('inspector.duration')}>
        <Select
          value={durationName ?? ''}
          accessibilityLabel={t('inspector.duration')}
          disabled={playing}
          placeholder={
            durationName !== null
              ? undefined
              : durationTicks === null
              ? mixed
              : t('inspector.customDuration', { ticks: durationTicks })
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
        <View accessibilityLabel={t('inspector.velocity')}>
          <NumberInput
            value={velocity ?? 0}
            min={0}
            max={127}
            disabled={playing}
            onChange={(value: number) => changeVelocity(store, value)}
          />
        </View>
      </Field>

      <Field label={t('inspector.articulation')}>
        <Select
          value={articulation ?? ''}
          accessibilityLabel={t('inspector.articulation')}
          disabled={playing}
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
          disabled={playing}
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

      <Field label={t('inspector.chordSymbol')}>
        {/*
          Stored as typed. `C-7`, `Cmin7` and `Cm7` are one chord written three
          ways, and only the root is ever parsed.
        */}
        <DraftInput
          value={first.chordSymbol ?? ''}
          placeholder={t('inspector.chordSymbolPlaceholder')}
          editable={!playing}
          onCommit={text => setChordSymbol(store, first.id, text)}
          accessibilityLabel={t('inspector.chordSymbol')}
        />
      </Field>

      <Field label={t('inspector.fingering')}>
        {/*
          A string, not a number: piano uses 1-5, guitar adds `T`, and editions
          write `1-2` for a substitution.
        */}
        <DraftInput
          value={first.fingering ?? ''}
          editable={!playing}
          onCommit={text => setFingering(store, text || undefined)}
          accessibilityLabel={t('inspector.fingering')}
        />
      </Field>

      {/* Where this note is, in the numbers a player reads off the page —
          `barBeatForTick` skips pickups, so this is the bar they would count. */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field label={t('inspector.bar')}>
            <Text className="text-foreground text-base tabular-nums">
              {at ? at.bar : '—'}
            </Text>
          </Field>
        </View>
        <View className="flex-1">
          <Field label={t('inspector.beat')}>
            <Text className="text-foreground text-base tabular-nums">
              {at ? Math.floor(at.beat) : '—'}
            </Text>
          </Field>
        </View>
      </View>

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
            <View accessibilityLabel={t('inspector.voice')}>
              <NumberInput
                value={voice ?? 1}
                min={1}
                disabled={playing}
                onChange={(value: number) =>
                  setVoice(
                    store,
                    notes.map(n => n.id),
                    Math.round(value) - 1,
                  )
                }
              />
            </View>
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
          disabled={playing}
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
          disabled={playing}
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
            disabled={playing || notes.length < 2}
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
              disabled={playing || notes.length < 2}
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
      <Field label={t('inspector.ornaments')}>
        <View className="gap-2">
          <Button
            variant="secondary"
            disabled={playing || notes.length !== 1}
            onPress={() => toGraceNote(store, first.id)}
            accessibilityLabel={t('inspector.makeGraceNote')}
          >
            {t('inspector.makeGraceNote')}
          </Button>
          {graceCount > 0 ? (
            <Button
              variant="ghost"
              disabled={playing}
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

      {onReplace ? (
        <ReplaceButton
          scope="notes"
          label={t('inspector.replaceNotes')}
          disabled={playing}
          onReplace={onReplace}
        />
      ) : null}
    </View>
  );
}
