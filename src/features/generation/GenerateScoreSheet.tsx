/**
 * Asking for a whole score.
 *
 * Everything about *what* to ask for lives in `music_lib` — the style and mood
 * vocabularies, the key and time-signature lists, the credit estimate, and
 * `buildGenerateScoreRequest`, which is the single place that decides whether a
 * draft is a valid request. This file collects the answers and shows them.
 *
 * The credit line says "about", and means it: the server charges what the model
 * actually produced, which agrees whenever generation returns the requested
 * length and is otherwise smaller — so the quote is never exceeded. One credit
 * per bar **per instrument**, because a quartet costs about four times a solo
 * of the same length to produce.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Input, Select, Text } from '@sudobility/components-rn';
import {
  GENERATE_SCORE_COMPLEXITY_OPTIONS,
  GENERATE_SCORE_KEY_FIFTHS_OPTIONS,
  GENERATE_SCORE_MOOD_OPTIONS,
  GENERATE_SCORE_STYLE_OPTIONS,
  GENERATE_SCORE_TIME_SIGNATURE_OPTIONS,
  FAMILY_GROUPS,
  KIT_OPTIONS,
  buildGenerateScoreRequest,
  estimateGenerateScoreCredits,
} from '@sudobility/music_lib';
import type { GenerateScoreComplexity } from '@sudobility/music_lib';
import type { GenerateScoreRequest } from '@sudobility/music_types';

/**
 * Every instrument, flattened.
 *
 * The web app's picker keeps the family groups because its `Select` renders
 * them; this one is a flat list with the family in the label, since the native
 * picker has no group heading. Built from the same two exports, so a catalogue
 * change moves both — the kits come first for the same reason they do there:
 * a drum kit is not program 40, and putting them among the melodic programs is
 * how the two come to be confused.
 */
const INSTRUMENT_OPTIONS: readonly { value: string; label: string }[] = [
  ...KIT_OPTIONS.map(kit => ({ value: kit.value, label: kit.label })),
  ...FAMILY_GROUPS.flatMap(group =>
    group.instruments.map(instrument => ({
      value: String(instrument.program),
      label: `${group.label} · ${instrument.name}`,
    })),
  ),
];

/**
 * A select needs a value for "none", and `undefined` is not one.
 *
 * Local to the picker rather than shared with the model: the *request* omits
 * the field entirely, which is what "no particular style" means on the wire.
 */
const NONE = 'none';

export type GenerateScoreSheetProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: GenerateScoreRequest) => void;
  submitting?: boolean;
  /**
   * Whether the balance is spent, decided by the caller.
   *
   * Passed in rather than looked up here, and that is a layering decision with
   * teeth: reading it would mean importing the auth provider, which imports
   * Firebase, which is how a form for choosing a key signature ends up unable
   * to render in a test without a Firebase transform. The screen has the auth
   * context already; the sheet renders.
   *
   * A **courtesy** gate, and only at zero — never when the estimate merely
   * exceeds the balance. A job may overdraw once by design, and a stricter rule
   * here would refuse work `POST /jobs` would have accepted. The 402 still has
   * to be handled: somebody whose credits ran out in another session gets here.
   */
  outOfCredits?: boolean;
};

export function GenerateScoreSheet({
  open,
  onClose,
  onSubmit,
  submitting = false,
  outOfCredits = false,
}: GenerateScoreSheetProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [measuresText, setMeasuresText] = useState('16');
  const [tempoText, setTempoText] = useState('');
  const [style, setStyle] = useState(NONE);
  const [mood, setMood] = useState(NONE);
  const [complexity, setComplexity] =
    useState<GenerateScoreComplexity>('moderate');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [fifths, setFifths] = useState('0');
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  const [instruments, setInstruments] = useState<readonly string[]>([
    INSTRUMENT_OPTIONS[0]?.value ?? '',
  ]);

  const durationMeasures = Number(measuresText);
  const draft = {
    ...(title.trim() ? { title } : {}),
    prompt,
    durationMeasures: Number.isFinite(durationMeasures) ? durationMeasures : 0,
    instrumentValues: instruments,
    complexity,
    timeSignature: GENERATE_SCORE_TIME_SIGNATURE_OPTIONS[timeSignature],
    keySignature: { fifths: Number(fifths), mode },
    ...(style === NONE ? {} : { style }),
    ...(mood === NONE ? {} : { mood }),
    tempoText,
  };
  const request = buildGenerateScoreRequest(draft);
  const credits = estimateGenerateScoreCredits(
    draft.durationMeasures,
    instruments.length,
  );

  return (
    <FormModal
      visible={open}
      title={t('generateScore.title')}
      onClose={onClose}
      size="large"
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('generate.action'),
          onPress: () => {
            if (request) onSubmit(request);
          },
          disabled: request === null || outOfCredits,
          loading: submitting,
        },
      ]}
    >
      {/*
        Scrolls inside the sheet: on a phone in landscape this is taller than
        the screen, and a form whose Generate button is off the bottom is a
        form nobody can submit.
      */}
      <ScrollView keyboardShouldPersistTaps="handled">
        <Field label={t('generateScore.titleField')}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={t('generateScore.titlePlaceholder')}
            accessibilityLabel={t('generateScore.titleField')}
          />
        </Field>

        <Field label={t('generate.prompt')}>
          <Input
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={3}
            accessibilityLabel={t('generate.prompt')}
          />
        </Field>

        <Field label={t('generateScore.measures')}>
          <Input
            value={measuresText}
            onChangeText={setMeasuresText}
            keyboardType="number-pad"
            accessibilityLabel={t('generateScore.measures')}
          />
        </Field>

        <Field label={t('generateScore.tempo')}>
          <Input
            value={tempoText}
            onChangeText={setTempoText}
            keyboardType="number-pad"
            accessibilityLabel={t('generateScore.tempo')}
          />
        </Field>

        <Field label={t('generateScore.style')}>
          <Select
            value={style}
            accessibilityLabel={t('generateScore.style')}
            options={[
              { value: NONE, label: t('generateScore.noStyle') },
              ...GENERATE_SCORE_STYLE_OPTIONS.map(value => ({
                value,
                label: value,
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
              ...GENERATE_SCORE_MOOD_OPTIONS.map(value => ({
                value,
                label: value,
              })),
            ]}
            onValueChange={setMood}
          />
        </Field>

        <Field label={t('generateScore.complexity')}>
          <Select
            value={complexity}
            accessibilityLabel={t('generateScore.complexity')}
            options={GENERATE_SCORE_COMPLEXITY_OPTIONS.map(value => ({
              value,
              label: value,
            }))}
            onValueChange={value =>
              setComplexity(value as GenerateScoreComplexity)
            }
          />
        </Field>

        <Field label={t('generateScore.timeSignature')}>
          <Select
            value={timeSignature}
            accessibilityLabel={t('generateScore.timeSignature')}
            options={Object.keys(GENERATE_SCORE_TIME_SIGNATURE_OPTIONS).map(
              value => ({ value, label: value }),
            )}
            onValueChange={setTimeSignature}
          />
        </Field>

        <Field label={t('generateScore.key')}>
          <Select
            value={fifths}
            accessibilityLabel={t('generateScore.key')}
            options={GENERATE_SCORE_KEY_FIFTHS_OPTIONS.map(option => ({
              value: String(option.fifths),
              label: option.label,
            }))}
            onValueChange={setFifths}
          />
        </Field>

        <Field label={t('generateScore.mode')}>
          <Select
            value={mode}
            accessibilityLabel={t('generateScore.mode')}
            options={[
              { value: 'major', label: t('key.major') },
              { value: 'minor', label: t('key.minor') },
            ]}
            onValueChange={value => setMode(value as 'major' | 'minor')}
          />
        </Field>

        {/*
          One picker per part rather than a checklist of every instrument: a
          score has an ordered instrumentation, and the same instrument twice
          is a perfectly ordinary request.
        */}
        <Field label={t('generateScore.instrumentation')}>
          <View className="gap-2">
            {instruments.map((value, index) => (
              <Select
                key={`${value}-${index}`}
                value={value}
                accessibilityLabel={t('generateScore.instrumentation')}
                options={[...INSTRUMENT_OPTIONS]}
                onValueChange={next =>
                  setInstruments(current =>
                    current.map((v, i) => (i === index ? next : v)),
                  )
                }
              />
            ))}
          </View>
        </Field>

        <Text className="text-muted-foreground text-xs">
          {t('generate.estimate', { count: credits })}
        </Text>
        {/*
          A courtesy gate, and only at zero. Deliberately *not* disabled when
          the estimate exceeds the balance: a job may overdraw once by design,
          and a stricter rule here would refuse work `POST /jobs` would have
          accepted. The 402 still has to be handled — this is a courtesy, and
          somebody whose credits ran out in another session reaches it.
        */}
        {outOfCredits ? (
          <Text className="text-destructive text-xs">
            {t('credits.outOfCreditsTitle')}
          </Text>
        ) : null}
      </ScrollView>
    </FormModal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1 pb-3">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      {children}
    </View>
  );
}
