/**
 * The form both score-setup sheets show.
 *
 * `GenerateScoreSheet` asks for a whole score inside the project already open;
 * `NewProjectSheet` asks for a new one, with a toggle deciding whether a model
 * writes it. They differ in their title, their action and whether the AI half
 * is on screen — and in nothing else, so a second copy of this would be a
 * second place for the style presets, the credit estimate and the instrument
 * list to drift out of step.
 *
 * The draft is the *same object* music_lib's two builders take, which is what
 * lets one form back both: `buildGenerateScoreRequest` reads the prompt half,
 * `buildNewProjectScore` ignores it.
 *
 * Everything about *what* to ask for lives in `music_lib` — the style and mood
 * vocabularies, the key and time-signature lists, and the two builders that
 * decide whether a draft is usable. This file collects the answers and shows
 * them.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input, Select, Text } from '@sudobility/components-rn';
import {
  GENERATE_SCORE_COMPLEXITY_OPTIONS,
  GENERATE_SCORE_KEY_FIFTHS_OPTIONS,
  GENERATE_SCORE_MOOD_OPTIONS,
  GENERATE_SCORE_STYLE_OPTIONS,
  GENERATE_SCORE_STYLE_PRESETS,
  styleInstrumentsWithGuest,
  GENERATE_SCORE_TIME_SIGNATURE_OPTIONS,
  FAMILY_GROUPS,
  KIT_OPTIONS,
} from '@sudobility/music_lib';
import type {
  GenerateScoreComplexity,
  GenerateScoreRequestDraft,
} from '@sudobility/music_lib';

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

export type ScoreSetupDraft = {
  title: string;
  setTitle: (v: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  measuresText: string;
  setMeasuresText: (v: string) => void;
  tempoText: string;
  setTempoText: (v: string) => void;
  style: string;
  applyStyle: (v: string) => void;
  mood: string;
  setMood: (v: string) => void;
  complexity: GenerateScoreComplexity;
  setComplexity: (v: GenerateScoreComplexity) => void;
  timeSignature: string;
  setTimeSignature: (v: string) => void;
  fifths: string;
  setFifths: (v: string) => void;
  mode: 'major' | 'minor';
  setMode: (v: 'major' | 'minor') => void;
  instruments: readonly string[];
  setInstruments: (v: readonly string[]) => void;
  /** The same object both music_lib builders take. */
  draft: GenerateScoreRequestDraft;
};

export function useScoreSetupDraft(): ScoreSetupDraft {
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

  /*
    Choosing a style fills the form with the ordinary shape of that genre.

    Reggae is an electric guitar, an organ, a bass and a kit at 78bpm; picking
    the word and then being handed a lone piano at 120 is the generator asking
    the reader to already know the answer. The shape lives in music_lib's
    `GENERATE_SCORE_STYLE_PRESETS`, which the web dialog fills from too — so a
    genre means the same ensemble here as it does there.

    It **overwrites**, deliberately: a preset that skipped fields the reader had
    touched would leave a half-country, half-whatever-was-there ensemble that
    matches no genre and that nobody chose. Everything stays editable.

    Clearing back to "No style" leaves the form alone — that is the reader
    saying they want no genre, not that they want the defaults back.
  */
  const applyStyle = (next: string) => {
    setStyle(next);
    const preset =
      next === NONE ? undefined : GENERATE_SCORE_STYLE_PRESETS[next];
    if (!preset) return;
    /*
      Through `styleInstrumentsWithGuest`, shared with the web dialog: the
      roster plus one common instrument the genre would not have asked for, so
      two goes at the same style are not the same five instruments twice. It is
      appended last and this list is editable, so it is visible before anything
      is generated and removable by somebody who wanted the plain lineup.
    */
    setInstruments([...styleInstrumentsWithGuest(next)]);
    setTempoText(String(preset.tempo));
    setMeasuresText(String(preset.measures));
    setTimeSignature(preset.timeSignature);
    if (preset.mode) setMode(preset.mode);
  };

  const durationMeasures = Number(measuresText);
  const draft: GenerateScoreRequestDraft = {
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

  return {
    title,
    setTitle,
    prompt,
    setPrompt,
    measuresText,
    setMeasuresText,
    tempoText,
    setTempoText,
    style,
    applyStyle,
    mood,
    setMood,
    complexity,
    setComplexity,
    timeSignature,
    setTimeSignature,
    fifths,
    setFifths,
    mode,
    setMode,
    instruments,
    setInstruments,
    draft,
  };
}

/**
 * Fields that fade and slide in when they are wanted, and out when they are not.
 *
 * Mounted only while visible *or* still animating out, so a collapsed field is
 * genuinely gone — not merely transparent and still reachable. The web dialog
 * keeps its equivalent mounted and marks it `inert`, because CSS can animate a
 * height nobody stated in advance; React Native cannot without measuring, so
 * this animates opacity and a small offset and lets the layout reflow at once.
 *
 * `useNativeDriver` because both properties it touches are ones the native
 * driver supports — the animation then runs off the JS thread, which matters on
 * a sheet that is animating while a form is being typed into.
 */
function Reveal({ shown, children }: { shown: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(shown);
  const progress = useRef(new Animated.Value(shown ? 1 : 0)).current;

  useEffect(() => {
    if (shown) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: shown ? 1 : 0,
      duration: REVEAL_MS,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      // Unmounted only once the fade has actually finished: cut short by a
      // second toggle, `finished` is false and the block stays for the
      // animation now running the other way.
      if (finished && !shown) setMounted(false);
    });
    return () => animation.stop();
  }, [shown, progress]);

  if (!mounted) return null;
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Long enough to read as motion, short enough not to be waited on. */
const REVEAL_MS = 200;

export function ScoreSetupFields({
  draft,
  showAi,
}: {
  draft: ScoreSetupDraft;
  /** Renders the prompt, style, mood and complexity fields. */
  showAi: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field label={t('generateScore.titleField')}>
        <Input
          value={draft.title}
          onChangeText={draft.setTitle}
          placeholder={t('generateScore.titlePlaceholder')}
          accessibilityLabel={t('generateScore.titleField')}
        />
      </Field>

      <Reveal shown={showAi}>
        <Field label={t('generate.prompt')}>
          <Input
            value={draft.prompt}
            onChangeText={draft.setPrompt}
            multiline
            numberOfLines={3}
            accessibilityLabel={t('generate.prompt')}
          />
        </Field>
      </Reveal>

      <Field label={t('generateScore.measures')}>
        <Input
          value={draft.measuresText}
          onChangeText={draft.setMeasuresText}
          keyboardType="number-pad"
          accessibilityLabel={t('generateScore.measures')}
        />
      </Field>

      <Field label={t('generateScore.tempo')}>
        <Input
          value={draft.tempoText}
          onChangeText={draft.setTempoText}
          keyboardType="number-pad"
          accessibilityLabel={t('generateScore.tempo')}
        />
      </Field>

      <Reveal shown={showAi}>
        <Field label={t('generateScore.style')}>
          <Select
            value={draft.style}
            accessibilityLabel={t('generateScore.style')}
            options={[
              { value: NONE, label: t('generateScore.noStyle') },
              // Translated, not the raw token: the list showed `heavyMetal`
              // and `bossaNova` to every reader, and a Chinese one has names
              // for these genres too.
              ...GENERATE_SCORE_STYLE_OPTIONS.map(value => ({
                value,
                label: t(`generateScore.styleName.${value}`),
              })),
            ]}
            onValueChange={draft.applyStyle}
          />
        </Field>

        <Field label={t('generateScore.mood')}>
          <Select
            value={draft.mood}
            accessibilityLabel={t('generateScore.mood')}
            options={[
              { value: NONE, label: t('generateScore.noMood') },
              ...GENERATE_SCORE_MOOD_OPTIONS.map(value => ({
                value,
                label: value,
              })),
            ]}
            onValueChange={draft.setMood}
          />
        </Field>

        <Field label={t('generateScore.complexity')}>
          <Select
            value={draft.complexity}
            accessibilityLabel={t('generateScore.complexity')}
            options={GENERATE_SCORE_COMPLEXITY_OPTIONS.map(value => ({
              value,
              label: value,
            }))}
            onValueChange={value =>
              draft.setComplexity(value as GenerateScoreComplexity)
            }
          />
        </Field>
      </Reveal>

      <Field label={t('generateScore.timeSignature')}>
        <Select
          value={draft.timeSignature}
          accessibilityLabel={t('generateScore.timeSignature')}
          options={Object.keys(GENERATE_SCORE_TIME_SIGNATURE_OPTIONS).map(
            value => ({ value, label: value }),
          )}
          onValueChange={draft.setTimeSignature}
        />
      </Field>

      <Field label={t('generateScore.key')}>
        <Select
          value={draft.fifths}
          accessibilityLabel={t('generateScore.key')}
          options={GENERATE_SCORE_KEY_FIFTHS_OPTIONS.map(option => ({
            value: String(option.fifths),
            label: option.label,
          }))}
          onValueChange={draft.setFifths}
        />
      </Field>

      <Field label={t('generateScore.mode')}>
        <Select
          value={draft.mode}
          accessibilityLabel={t('generateScore.mode')}
          options={[
            { value: 'major', label: t('key.major') },
            { value: 'minor', label: t('key.minor') },
          ]}
          onValueChange={value => draft.setMode(value as 'major' | 'minor')}
        />
      </Field>

      {/*
        One picker per part rather than a checklist of every instrument: a
        score has an ordered instrumentation, and the same instrument twice
        is a perfectly ordinary request.
      */}
      <Field label={t('generateScore.instrumentation')}>
        <View className="gap-2">
          {draft.instruments.map((value, index) => (
            <Select
              key={`${value}-${index}`}
              value={value}
              accessibilityLabel={t('generateScore.instrumentation')}
              options={[...INSTRUMENT_OPTIONS]}
              onValueChange={next =>
                draft.setInstruments(
                  draft.instruments.map((v, i) => (i === index ? next : v)),
                )
              }
            />
          ))}
        </View>
      </Field>
    </>
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
