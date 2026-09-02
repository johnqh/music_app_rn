/**
 * One sheet for all three Replace actions, parameterised by scope.
 *
 * Settings only. Submitting starts a background job and closes — there is no
 * candidate list and no accept step, because the result lands minutes later
 * when the person who asked for it is very likely elsewhere. That follows from
 * the job model rather than being a simplification of it.
 *
 * Absent on purpose: instrumentation, measure count, tempo, key and time
 * signature. All of those are fixed by the region being replaced, and a
 * disabled control that can never apply is worse than no control.
 *
 * The scopes differ in one way worth knowing: **Replace Notes is the region
 * deliberately not snapped to measures**. `prepareReplacement` handles that —
 * nothing here decides what a region is.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FormModal,
  Input,
  Select,
  Switch,
  Text,
} from '@sudobility/components-rn';
import {
  GENERATE_SCORE_COMPLEXITY_OPTIONS,
  GENERATE_SCORE_MOOD_OPTIONS,
  GENERATE_SCORE_STYLE_OPTIONS,
} from '@sudobility/music_lib';
import type { ReplaceSubmission } from '@sudobility/music_editing';
import type { ReplaceScope } from '@sudobility/music_types';

/** A select needs a value for "none"; the submission omits the field instead. */
const NONE = 'none';

/**
 * Preset instructions, as the spec lists them.
 *
 * English on purpose, and this is the one place that is right: they are not
 * labels, they are the **prompt text** sent to the model, which reads English.
 * Translating them would change what is asked for.
 */
const PRESET_INSTRUCTIONS: readonly string[] = [
  'Make this more dramatic',
  'Simplify this passage',
  'Add rhythmic variation',
  'Make the melody more memorable',
  'Create a stronger transition',
  'Add harmonic tension',
  'Resolve the phrase',
];

export type ReplaceMusicSheetProps = {
  open: boolean;
  scope: ReplaceScope;
  /** False when there is nothing selected to replace; disables submission. */
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: (submission: ReplaceSubmission) => void;
};

const TITLE_KEY: Record<ReplaceScope, string> = {
  notes: 'replace.notesTitle',
  measures: 'replace.measuresTitle',
  track: 'replace.trackTitle',
};

export function ReplaceMusicSheet({
  open,
  scope,
  canSubmit,
  onClose,
  onSubmit,
}: ReplaceMusicSheetProps) {
  const { t } = useTranslation();
  const [instruction, setInstruction] = useState('');
  const [style, setStyle] = useState(NONE);
  const [mood, setMood] = useState(NONE);
  const [complexity, setComplexity] = useState(NONE);
  const [preserveBoundaryNotes, setBoundary] = useState(true);
  const [preserveHarmony, setHarmony] = useState(false);
  const [preserveRhythm, setRhythm] = useState(false);
  const [preserveMelody, setMelody] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset per opening, and per scope: "simplify this passage" carried over
    // from a Replace Notes into a Replace Track is a different request than it
    // looks like.
    setInstruction('');
    setStyle(NONE);
    setMood(NONE);
    setComplexity(NONE);
    setBoundary(true);
    setHarmony(false);
    setRhythm(false);
    setMelody(false);
  }, [open, scope]);

  return (
    <FormModal
      visible={open}
      title={t(TITLE_KEY[scope])}
      onClose={onClose}
      size="large"
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('replace.action'),
          disabled: !canSubmit || instruction.trim() === '',
          onPress: () =>
            onSubmit({
              instruction: instruction.trim(),
              ...(style === NONE ? {} : { style }),
              ...(mood === NONE ? {} : { mood }),
              ...(complexity === NONE
                ? {}
                : {
                    complexity: complexity as 'simple' | 'moderate' | 'complex',
                  }),
              constraints: {
                preserveBoundaryNotes,
                preserveHarmony,
                preserveRhythm,
                preserveMelody,
              },
            }),
        },
      ]}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Field label={t('generate.prompt')}>
          <Input
            value={instruction}
            onChangeText={setInstruction}
            multiline
            numberOfLines={3}
            accessibilityLabel={t('generate.prompt')}
          />
        </Field>

        <Field label={t('replace.presetInstructions')}>
          <Select
            value={NONE}
            accessibilityLabel={t('replace.presetInstructions')}
            options={[
              { value: NONE, label: t('replace.presetInstructions') },
              ...PRESET_INSTRUCTIONS.map(value => ({ value, label: value })),
            ]}
            onValueChange={value => {
              if (value !== NONE) setInstruction(value);
            }}
          />
        </Field>

        <Field label={t('generateScore.style')}>
          <Select
            value={style}
            accessibilityLabel={t('generateScore.style')}
            options={[
              { value: NONE, label: t('generateScore.noStyle') },
              ...GENERATE_SCORE_STYLE_OPTIONS.map(v => ({
                value: v,
                label: v,
              })),
            ]}
            onValueChange={setStyle}
          />
        </Field>

        <Field label={t('generateScore.mood')}>
          <Select
            value={mood}
            accessibilityLabel={t('generateScore.mood')}
            options={[
              { value: NONE, label: t('generateScore.noMood') },
              ...GENERATE_SCORE_MOOD_OPTIONS.map(v => ({ value: v, label: v })),
            ]}
            onValueChange={setMood}
          />
        </Field>

        <Field label={t('generateScore.complexity')}>
          <Select
            value={complexity}
            accessibilityLabel={t('generateScore.complexity')}
            options={[
              { value: NONE, label: t('replace.keepComplexity') },
              ...GENERATE_SCORE_COMPLEXITY_OPTIONS.map(v => ({
                value: v,
                label: v,
              })),
            ]}
            onValueChange={setComplexity}
          />
        </Field>

        {/*
          Boundary notes default on and the rest default off: keeping the notes
          at the edges is what makes a replacement join up with the music around
          it, where the others each remove a whole dimension the model was asked
          to work in.
        */}
        <Toggle
          label={t('replace.preserveBoundary')}
          checked={preserveBoundaryNotes}
          onChange={setBoundary}
        />
        <Toggle
          label={t('replace.preserveHarmony')}
          checked={preserveHarmony}
          onChange={setHarmony}
        />
        <Toggle
          label={t('replace.preserveRhythm')}
          checked={preserveRhythm}
          onChange={setRhythm}
        />
        <Toggle
          label={t('replace.preserveMelody')}
          checked={preserveMelody}
          onChange={setMelody}
        />

        {!canSubmit ? (
          <Text className="text-muted-foreground pt-2 text-sm">
            {t('replace.nothingSelected')}
          </Text>
        ) : null}
      </ScrollView>
    </FormModal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1 pb-3">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      {children}
    </View>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-foreground flex-1 text-base">{label}</Text>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        accessibilityLabel={label}
      />
    </View>
  );
}
