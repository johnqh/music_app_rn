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
import { View } from 'react-native';
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
  NO_MARK,
  REPLACE_PRESET_KEYS,
  buildReplaceSubmission,
  complexityLabelKey,
  defaultReplaceSubmission,
  labelledOptions,
  moodLabelKey,
  optionalFromPicker,
  optionalToPicker,
  replacePresetLabelKey,
  styleLabelKey,
} from '@sudobility/music_lib';
import type {
  GenerateScoreComplexity,
  ReplaceDraft,
} from '@sudobility/music_lib';
import type { ReplaceSubmission } from '@sudobility/music_editing';
import type { ReplaceScope } from '@sudobility/music_types';

export type ReplaceMusicSheetProps = {
  open: boolean;
  scope: ReplaceScope;
  /** False when there is nothing selected to replace; disables submission. */
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: (submission: ReplaceSubmission) => void;
  /** The bars the region touches times its tracks: what the server bills. */
  estimatedCredits?: number;
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
  estimatedCredits = 0,
}: ReplaceMusicSheetProps) {
  const { t, i18n } = useTranslation();
  /*
    The form, and what it opens with, are music_lib's: the web's defaults —
    nothing preserved, `moderate` complexity, the default backend — so the same
    instruction over the same bars sends the same request from either device.
    This sheet used to open on "keep complexity" with boundary notes preserved,
    and offered half the preset list.
  */
  const [draft, setDraft] = useState<ReplaceDraft>(defaultReplaceSubmission);
  const patch = (next: Partial<ReplaceDraft>): void =>
    setDraft(current => ({ ...current, ...next }));
  const setConstraint = (
    key: keyof ReplaceDraft['constraints'],
    value: boolean,
  ): void =>
    setDraft(current => ({
      ...current,
      constraints: { ...current.constraints, [key]: value },
    }));

  useEffect(() => {
    if (!open) return;
    // Reset per opening, and per scope: "simplify this passage" carried over
    // from a Replace Notes into a Replace Track is a different request than it
    // looks like.
    setDraft(defaultReplaceSubmission());
  }, [open, scope]);

  /*
    Null while the instruction is blank — which is also the rule for disabling
    Replace, so the button and the submission cannot disagree.
  */
  const submission = buildReplaceSubmission(draft);

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
          disabled: !canSubmit || submission === null,
          onPress: () => {
            if (canSubmit && submission) onSubmit(submission);
          },
        },
      ]}
    >
      <>
        {estimatedCredits > 0 ? (
          <Text className="text-muted-foreground pb-3 text-sm">
            {t('generate.estimate', { count: estimatedCredits })}
          </Text>
        ) : null}
        <Field label={t('generate.prompt')}>
          <Input
            value={draft.instruction}
            onChangeText={instruction => patch({ instruction })}
            multiline
            numberOfLines={3}
            accessibilityLabel={t('generate.prompt')}
          />
        </Field>

        {/*
          Choosing a preset fills the instruction with its text in the reader's
          language, which is then what the model is asked. Keys from music_lib,
          words from this app's locale — the same model New Project's briefs
          use. They were English literals, so a Chinese reader prompted in a
          language the rest of the form was not in.
        */}
        <Field label={t('replace.presetInstructions')}>
          <Select
            value={NO_MARK}
            accessibilityLabel={t('replace.presetInstructions')}
            options={[
              { value: NO_MARK, label: t('replace.presetInstructions') },
              ...REPLACE_PRESET_KEYS.map(key => ({
                value: key,
                label: t(replacePresetLabelKey(key)),
              })),
            ]}
            onValueChange={value => {
              const key = REPLACE_PRESET_KEYS.find(k => k === value);
              if (key) patch({ instruction: t(replacePresetLabelKey(key)) });
            }}
          />
        </Field>

        {/* Translated and sorted, with "none" pinned above — the raw values
            (`electroSwing`) were what this picker used to show. */}
        <Field label={t('generateScore.style')}>
          <Select
            value={optionalToPicker(draft.style)}
            accessibilityLabel={t('generateScore.style')}
            options={labelledOptions(
              GENERATE_SCORE_STYLE_OPTIONS,
              value => t(styleLabelKey(value)),
              i18n.language,
              t('generateScore.noStyle'),
            )}
            onValueChange={value => patch({ style: optionalFromPicker(value) })}
          />
        </Field>

        <Field label={t('generateScore.mood')}>
          <Select
            value={optionalToPicker(draft.mood)}
            accessibilityLabel={t('generateScore.mood')}
            options={labelledOptions(
              GENERATE_SCORE_MOOD_OPTIONS,
              value => t(moodLabelKey(value)),
              i18n.language,
              t('generateScore.noMood'),
            )}
            onValueChange={value => patch({ mood: optionalFromPicker(value) })}
          />
        </Field>

        <Field label={t('generateScore.complexity')}>
          <Select
            value={draft.complexity}
            accessibilityLabel={t('generateScore.complexity')}
            options={GENERATE_SCORE_COMPLEXITY_OPTIONS.map(value => ({
              value,
              label: t(complexityLabelKey(value)),
            }))}
            onValueChange={value =>
              patch({ complexity: value as GenerateScoreComplexity })
            }
          />
        </Field>

        {/*
          All four start off, boundary notes included: each constraint removes
          a dimension the model was asked to work in, and a reader opting in is
          clearer than discovering one was on.
        */}
        <Toggle
          label={t('replace.preserveBoundary')}
          checked={draft.constraints.preserveBoundaryNotes}
          onChange={value => setConstraint('preserveBoundaryNotes', value)}
        />
        <Toggle
          label={t('replace.preserveHarmony')}
          checked={draft.constraints.preserveHarmony}
          onChange={value => setConstraint('preserveHarmony', value)}
        />
        <Toggle
          label={t('replace.preserveRhythm')}
          checked={draft.constraints.preserveRhythm}
          onChange={value => setConstraint('preserveRhythm', value)}
        />
        <Toggle
          label={t('replace.preserveMelody')}
          checked={draft.constraints.preserveMelody}
          onChange={value => setConstraint('preserveMelody', value)}
        />

        {!canSubmit ? (
          <Text className="text-muted-foreground pt-2 text-sm">
            {t('replace.nothingSelected')}
          </Text>
        ) : null}
      </>
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
