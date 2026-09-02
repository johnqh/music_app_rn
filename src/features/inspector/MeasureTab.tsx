/**
 * The selected bar's properties — the web inspector's Measure tab.
 *
 * **Bar numbers, not indices.** `barNumberAt` skips pickups and answers `null`
 * for one, because a pickup has no number; nothing here computes `index + 1`.
 * That is what makes the number shown, the number a player reads and the bar
 * "go to bar 33" lands on all the same 33.
 *
 * `Tempo here` shows the tempo **in force** — inherited from an earlier bar
 * when this one sets none — so it is never blank and never lies.
 */
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { NumberInput, Select, Switch, Text } from '@sudobility/components-rn';
import { DraftInput } from './DraftInput';
import {
  removeTempoAt,
  selectSelectedMeasures,
  setBarline,
  setKeySignature,
  setMeasureClef,
  setNavigation,
  setPickup,
  setRepeats,
  setTempoAt,
  setTimeSignature,
} from '@sudobility/music_editing';
import {
  CLEFS,
  REPEAT_JUMPS,
  REPEAT_JUMP_LABEL,
  barNumberAt,
  effectiveClef,
  keySignatureOptions,
} from '@sudobility/music_types';
import type {
  BarlineStyle,
  Clef,
  KeySignature,
  RepeatJump,
} from '@sudobility/music_types';
import { Button } from '@sudobility/components-rn';
import { useEffect, useState } from 'react';
import { EmptyTab, Field } from './Field';
import { ReplaceButton } from './ReplaceButton';
import type { ReplaceScope } from '@sudobility/music_types';
import type { MusicDocument } from '@/documents/document';

/**
 * "Carry on with whatever clef is in force", as a value a picker can hold.
 *
 * A select needs a value for absence, and `undefined` is not one. Local to the
 * UI rather than shared with the model, because the *model* stores absence as a
 * missing field — which is the whole point of storing only the changes.
 */
const INHERIT_CLEF = 'inherit';

/** The same, for "this bar carries no jump". */
const NO_JUMP = 'none';

export function MeasureTab({
  document,
  onReplace,
}: {
  document: MusicDocument;
  onReplace?: (scope: ReplaceScope) => void;
}) {
  const { t } = useTranslation();
  const store = document.store;
  const measures = useStore(store, selectSelectedMeasures);
  const score = useStore(store, s => s.score);
  const playing = useStore(store, s => s.state) === 'playing';
  const [endingDraft, setEndingDraft] = useState('');
  const firstMeasure = measures[0];

  useEffect(() => {
    setEndingDraft((firstMeasure?.endingNumbers ?? []).join(', '));
  }, [firstMeasure?.id, firstMeasure?.endingNumbers]);

  if (measures.length === 0 || !score) {
    return <EmptyTab message={t('inspector.selectMeasure')} />;
  }
  const first = measures[0];
  if (!first) return <EmptyTab message={t('inspector.selectMeasure')} />;

  const measureIds = measures.map(m => m.id);
  const applyTimeSignature = (timeSignature: {
    numerator: number;
    denominator: number;
  }): void => {
    setTimeSignature(store, measureIds, timeSignature);
  };
  const applyKeySignature = (keySignature: KeySignature): void => {
    setKeySignature(store, measureIds, keySignature);
  };
  const keySig: KeySignature = first.keySignature ?? {
    fifths: 0,
    mode: 'major',
  };

  const index =
    score.tracks[0]?.measures.findIndex(m => m.id === first.id) ?? -1;
  const grid = score.tracks[0]?.measures ?? [];
  const number = index >= 0 ? barNumberAt(grid, index) : null;
  // The last tempo event at or before this bar — what a player would be at.
  const tempoInForce =
    [...score.tempoMap]
      .filter(e => e.tick <= first.startTick)
      .sort((a, b) => a.tick - b.tick)
      .at(-1)?.bpm ?? 120;
  /*
    The event this bar sets, as opposed to one it inherits. Only the former can
    be removed — see the Remove control below.
  */
  const ownTempoEvent =
    score.tempoMap.find(e => e.tick === first.startTick) ?? null;
  /*
    The clef is resolved through `effectiveClef`, never read off the measure:
    absent means "carry on", so reading `measure.clef` directly answers nothing
    for the great majority of bars.
  */
  const activeTrack =
    score.tracks.find(tr => tr.id === store.getState().activeTrackId) ??
    score.tracks[0]!;
  const inForceClef = effectiveClef(activeTrack, Math.max(0, index));

  return (
    <View className="gap-3">
      <Field label={t('inspector.bar')}>
        <Text className="text-foreground text-base">
          {/* Null for a pickup: it has no number, and 0 would be a lie. */}
          {number ?? t('inspector.pickup')}
        </Text>
      </Field>

      {/*
        Editable, not a readout. The web panel has always let a bar's meter be
        changed here and this one only printed it, so a score imported in 4/4
        could not be put into 3/4 anywhere in the app.
      */}
      <Field label={t('inspector.timeSignature')}>
        <View className="flex-row items-center gap-2">
          <View
            className="flex-1"
            accessibilityLabel={t('inspector.timeSigNumerator')}
          >
            <NumberInput
              value={first.timeSignature.numerator}
              min={1}
              max={32}
              disabled={playing}
              onChange={(value: number) =>
                applyTimeSignature({
                  numerator: Math.max(1, Math.round(value)),
                  denominator: first.timeSignature.denominator,
                })
              }
            />
          </View>
          <Text className="text-muted-foreground text-base">/</Text>
          <View
            className="flex-1"
            accessibilityLabel={t('inspector.timeSigDenominator')}
          >
            <NumberInput
              value={first.timeSignature.denominator}
              min={1}
              max={64}
              disabled={playing}
              onChange={(value: number) =>
                applyTimeSignature({
                  numerator: first.timeSignature.numerator,
                  denominator: Math.max(1, Math.round(value)),
                })
              }
            />
          </View>
        </View>
      </Field>

      {/*
        A key, named. "Key (fifths) 2" is the storage format; the reader is
        looking at D major. The options follow the chosen mode, because two
        sharps is D major or B minor depending on it — which is why the mode
        picker sits beside the key rather than under it.
      */}
      <Field label={t('inspector.key')}>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Select
              value={String(keySig.fifths)}
              accessibilityLabel={t('inspector.key')}
              disabled={playing}
              options={keySignatureOptions(keySig.mode).map(option => ({
                value: String(option.fifths),
                label: option.label,
              }))}
              onValueChange={(value: string) =>
                applyKeySignature({
                  fifths: Number(value),
                  mode: keySig.mode,
                })
              }
            />
          </View>
          <View className="flex-1">
            <Select
              value={keySig.mode}
              accessibilityLabel={t('inspector.keyMode')}
              disabled={playing}
              options={[
                { value: 'major', label: t('inspector.major') },
                { value: 'minor', label: t('inspector.minor') },
              ]}
              onValueChange={(value: string) =>
                applyKeySignature({
                  fifths: keySig.fifths,
                  mode: value as KeySignature['mode'],
                })
              }
            />
          </View>
        </View>
      </Field>

      <Field label={t('inspector.barline')}>
        {/*
          Only `double` and `final`; absent is the ordinary single line, which
          is almost every bar. The repeat barlines are two independent flags and
          deliberately live elsewhere.
        */}
        <Select
          value={first.barline ?? 'single'}
          accessibilityLabel={t('inspector.barline')}
          options={[
            { value: 'single', label: t('inspector.barlineSingle') },
            { value: 'double', label: t('inspector.barlineDouble') },
            { value: 'final', label: t('inspector.barlineFinal') },
          ]}
          onValueChange={(value: string) =>
            setBarline(
              store,
              index,
              value === 'single' ? undefined : (value as BarlineStyle),
            )
          }
        />
      </Field>

      {index === 0 ? (
        <View className="flex-row items-center justify-between">
          {/*
            Offered on bar 1 alone: a pickup is the bar before bar 1, and one in
            the middle of a score is an irregular bar, which is a different
            thing that keeps its number.
          */}
          <Text className="text-foreground text-base">
            {t('inspector.pickup')}
          </Text>
          <Switch
            checked={first.pickup === true}
            onCheckedChange={(checked: boolean) =>
              setPickup(store, checked ? 1 : null)
            }
            accessibilityLabel={t('inspector.pickup')}
          />
        </View>
      ) : null}

      {/*
        A clef change is stored on the bar it happens at; absent means "carry on
        with what is in force". Bar 1 is not a change — it is where the clef is
        *established* — so it offers no Inherit and writes to the track instead,
        which `setMeasureClef` routes for us.
      */}
      <Field label={t('inspector.measureClef')}>
        <Select
          value={first.clef ?? (index === 0 ? inForceClef : INHERIT_CLEF)}
          accessibilityLabel={t('inspector.measureClef')}
          disabled={playing}
          options={[
            ...(index === 0
              ? []
              : [
                  {
                    value: INHERIT_CLEF,
                    label: t('inspector.clefInherit', { clef: inForceClef }),
                  },
                ]),
            ...CLEFS.map(c => ({ value: c as string, label: c })),
          ]}
          onValueChange={(value: string) =>
            setMeasureClef(
              store,
              activeTrack.id,
              index,
              value === INHERIT_CLEF ? undefined : (value as Clef),
            )
          }
        />
      </Field>

      {/*
        Two independent flags, not one span: a `:|` with no matching `|:`
        repeats from the start of the piece, which is a real marking rather
        than an error to prevent.
      */}
      <Text className="text-muted-foreground text-sm">
        {t('editor.repeats')}
      </Text>
      <Toggle
        label={t('editor.repeatStart')}
        checked={first.repeatStart === true}
        disabled={playing}
        onChange={checked =>
          setRepeats(store, first.id, { repeatStart: checked })
        }
      />
      <Toggle
        label={t('editor.repeatEnd')}
        checked={first.repeatEnd === true}
        disabled={playing}
        onChange={checked =>
          setRepeats(store, first.id, { repeatEnd: checked })
        }
      />
      <Field label={t('editor.ending')}>
        <DraftInput
          value={endingDraft}
          placeholder={t('editor.endingPlaceholder')}
          accessibilityLabel={t('editor.ending')}
          onCommit={text => {
            /*
              "1, 2" is a bar played on both passes. Anything unparseable
              clears, rather than storing a bracket nobody asked for.
            */
            const numbers = text
              .split(',')
              .map(part => Number(part.trim()))
              .filter(n => Number.isInteger(n) && n > 0);
            setRepeats(store, first.id, { endingNumbers: numbers });
          }}
        />
      </Field>
      <Text className="text-muted-foreground text-sm">
        {t('editor.repeatsPlaybackNote')}
      </Text>

      {/*
        The places are flags and the instruction is an enum. `toCoda` and `coda`
        are separate on purpose: the bar you *leave* from is not the bar the
        coda begins at, and a bar can carry the coda sign and a `Fine` at once.
      */}
      <Text className="text-muted-foreground text-sm">
        {t('inspector.navigation')}
      </Text>
      <Toggle
        label={t('inspector.segno')}
        checked={first.segno === true}
        disabled={playing}
        onChange={checked => setNavigation(store, index, { segno: checked })}
      />
      <Toggle
        label={t('inspector.coda')}
        checked={first.coda === true}
        disabled={playing}
        onChange={checked => setNavigation(store, index, { coda: checked })}
      />
      <Toggle
        label={t('inspector.toCoda')}
        checked={first.toCoda === true}
        disabled={playing}
        onChange={checked => setNavigation(store, index, { toCoda: checked })}
      />
      <Toggle
        label={t('inspector.fine')}
        checked={first.fine === true}
        disabled={playing}
        onChange={checked => setNavigation(store, index, { fine: checked })}
      />
      <Field label={t('inspector.jump')}>
        <Select
          value={first.jump ?? NO_JUMP}
          accessibilityLabel={t('inspector.jump')}
          disabled={playing}
          options={[
            { value: NO_JUMP, label: t('inspector.jumpNone') },
            ...REPEAT_JUMPS.map(value => ({
              value,
              label: REPEAT_JUMP_LABEL[value],
            })),
          ]}
          onValueChange={(value: string) =>
            setNavigation(store, index, {
              jump: value === NO_JUMP ? undefined : (value as RepeatJump),
            })
          }
        />
      </Field>

      <Field label={t('inspector.tempoHere')} hint={t('inspector.tempoHint')}>
        {/*
          Shows the tempo *in force* — inherited from an earlier bar when this
          one sets none — so it is never blank and never lies.
        */}
        <DraftInput
          value={String(Math.round(tempoInForce))}
          onCommit={text => {
            const bpm = Number(text);
            if (Number.isFinite(bpm) && bpm > 0) {
              setTempoAt(store, { tick: first.startTick, bpm });
            }
          }}
          accessibilityLabel={t('inspector.tempoHere')}
        />
      </Field>
      {/*
        Offered only when the event is this bar's own: the starting tempo is not
        a change, and removing it would leave the score with no tempo at all.
      */}
      {ownTempoEvent ? (
        <Button
          variant="ghost"
          disabled={playing}
          onPress={() => removeTempoAt(store, ownTempoEvent.id)}
        >
          {t('editor.removeTempoChange')}
        </Button>
      ) : null}

      {onReplace ? (
        <ReplaceButton
          scope="measures"
          label={t('inspector.replaceMeasures')}
          disabled={playing}
          onReplace={onReplace}
        />
      ) : null}
    </View>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-foreground text-base">{label}</Text>
      <Switch
        checked={checked}
        disabled={disabled ?? false}
        onCheckedChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}
