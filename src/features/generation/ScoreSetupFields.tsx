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
import { Button, Input, Select, Switch, Text } from '@sudobility/components-rn';
import { useScorePresets } from '@sudobility/music_client';
import { publicServerContext } from '@/config/server';
import {
  GENERATE_SCORE_COMPLEXITY_OPTIONS,
  GENERATE_SCORE_KEY_FIFTHS_OPTIONS,
  GENERATE_SCORE_MOOD_OPTIONS,
  GENERATE_SCORE_STYLE_OPTIONS,
  GENERATE_SCORE_STYLE_PRESETS,
  DEFAULT_VOCAL_INSTRUMENT_VALUE,
  hasVocalInstrument,
  styleRoster,
  GENERATE_SCORE_TIME_SIGNATURE_OPTIONS,
  DEFAULT_INSTRUMENT_VALUE,
  FAMILY_GROUPS,
  KIT_OPTIONS,
  VOICE_OPTIONS,
  sortOptionsByLabel,
  barsForSeconds,
  formatDuration,
  parseDuration,
  secondsForBars,
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
 * picker has no group heading. Built from the same three exports, so a
 * catalogue change moves both, and in the same order they appear there.
 *
 * The voices come first because General MIDI files them under Ensemble,
 * between String Ensemble and Orchestra Hit, which is where nobody setting out
 * to write a song looks for a singer. The kits come next for the reason they
 * always did: a drum kit is not program 40, and putting them among the melodic
 * programs is how the two come to be confused.
 *
 * Exported so it can be asserted on directly: the picker opens a modal, which
 * a test environment does not mount, so the only honest check is of the list
 * the picker is handed.
 */
export const GENERATION_INSTRUMENT_OPTIONS: readonly {
  value: string;
  label: string;
}[] = [
  ...VOICE_OPTIONS.map(voice => ({ value: voice.value, label: voice.label })),
  ...KIT_OPTIONS.map(kit => ({ value: kit.value, label: kit.label })),
  ...FAMILY_GROUPS.flatMap(group =>
    group.instruments.map(instrument => ({
      value: String(instrument.program),
      label: `${group.label} · ${instrument.name}`,
    })),
  ),
];

/**
 * The style and mood lists, in the order they are read.
 *
 * Thirty-three styles in declaration order — waltz, jazz, pop, cinematic — is
 * the order the vocabulary grew in and no order to find "reggae" by. Sorted on
 * the translated label rather than the key, and under the language on screen,
 * through `sortOptionsByLabel`, which the web dialog sorts with too.
 *
 * The "no style" entry is pinned above them: it is not a member of the
 * vocabulary, it is its absence.
 */
export function styleSelectOptions(
  t: (key: string) => string,
  locale?: string,
): { value: string; label: string }[] {
  return [
    { value: NONE, label: t('generateScore.noStyle') },
    ...sortOptionsByLabel(
      GENERATE_SCORE_STYLE_OPTIONS,
      value => t(`generateScore.styleName.${value}`),
      locale,
    ).map(value => ({
      value,
      label: t(`generateScore.styleName.${value}`),
    })),
  ];
}

/**
 * The moods, translated as well as sorted.
 *
 * They were rendered as their own raw values — `bittersweet`, `triumphant` —
 * so a Chinese reader chose a mood in English from a list with no key to be
 * missing from, which is the one class of gap `locale-parity` cannot see.
 */
export function moodSelectOptions(
  t: (key: string) => string,
  locale?: string,
): { value: string; label: string }[] {
  return [
    { value: NONE, label: t('generateScore.noMood') },
    ...sortOptionsByLabel(
      GENERATE_SCORE_MOOD_OPTIONS,
      value => t(`generateScore.moodName.${value}`),
      locale,
    ).map(value => ({
      value,
      label: t(`generateScore.moodName.${value}`),
    })),
  ];
}

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
  /**
   * The Bars field read as a length, `m:ss`. Editing either refreshes the other
   * at the form's tempo and meter, as the web dialog does.
   */
  durationText: string;
  setDurationText: (v: string) => void;
  /** Tidies a typed length to what the bars now play. */
  refreshDuration: () => void;
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
  /**
   * Whether the part at this position is one of the chosen style's essential
   * instruments, which cannot be changed away while generating — a reggae
   * without its kit is not reggae. Only the first of each is locked, so a
   * second kit is still the reader's to change.
   */
  isLockedInstrument: (index: number) => boolean;
  lyrics: boolean;
  setLyrics: (v: boolean) => void;
  /**
   * What the words are about, when that is not what the piece is about.
   *
   * Separate questions: the prompt describes the music, and the words over it
   * can be about coming home without the music brief being about coming home.
   * Blank means "the same as the piece", which is what the lyric always
   * followed.
   */
  lyricsTheme: string;
  setLyricsTheme: (v: string) => void;
  /**
   * What the project is called when nothing was typed.
   *
   * Two names, because the two modes produce different things and a reader
   * scanning a list can tell them apart. It is the placeholder *and* the
   * fallback: a placeholder showing a name you do not get is a label for a
   * value that never existed.
   */
  defaultTitle: string;
  /** Whether anybody in the roster can sing, which is what the lyrics switch turns on. */
  hasVocal: boolean;
  /**
   * Adds or takes back the singer the sheet offers with its Generate toggle.
   *
   * Here rather than in the sheet because the roster and the style that
   * overwrites it both live in this hook — a caller reaching in to splice the
   * list would be a second place that has to know what a voice is.
   */
  setGenerating: (v: boolean) => void;
  /** The same object both music_lib builders take. */
  draft: GenerateScoreRequestDraft;
};

export function useScoreSetupDraft(): ScoreSetupDraft {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [measuresText, setMeasuresTextState] = useState('16');
  const [tempoText, setTempoTextState] = useState('');
  const [durationText, setDurationTextState] = useState(() =>
    formatDuration(secondsForBars(16, '')),
  );
  const [style, setStyle] = useState(NONE);
  const [mood, setMood] = useState(NONE);
  const [complexity, setComplexity] =
    useState<GenerateScoreComplexity>('moderate');
  const [timeSignature, setTimeSignatureState] = useState('4/4');

  /*
    Bars are the value; the duration is what is typed, kept apart so "1:" part
    way through an edit is not rewritten under the cursor. Every change to bars,
    tempo or meter refreshes it, and typing a length sets the bars.
  */
  const refreshDurationFrom = (bars: string, tempo: string, meter: string) => {
    const count = Number(bars);
    if (Number.isInteger(count) && count > 0) {
      setDurationTextState(
        formatDuration(
          secondsForBars(
            count,
            tempo,
            GENERATE_SCORE_TIME_SIGNATURE_OPTIONS[meter],
          ),
        ),
      );
    }
  };
  const setMeasuresText = (next: string) => {
    setMeasuresTextState(next);
    refreshDurationFrom(next, tempoText, timeSignature);
  };
  const setTempoText = (next: string) => {
    setTempoTextState(next);
    refreshDurationFrom(measuresText, next, timeSignature);
  };
  const setTimeSignature = (next: string) => {
    setTimeSignatureState(next);
    refreshDurationFrom(measuresText, tempoText, next);
  };
  const setDurationText = (next: string) => {
    setDurationTextState(next);
    const seconds = parseDuration(next);
    if (seconds !== null) {
      setMeasuresTextState(
        String(
          barsForSeconds(
            seconds,
            tempoText,
            GENERATE_SCORE_TIME_SIGNATURE_OPTIONS[timeSignature],
          ),
        ),
      );
    }
  };
  const [fifths, setFifths] = useState('0');
  const [mode, setMode] = useState<'major' | 'minor'>('major');
  /*
    Piano, the same opening roster the web dialog has.

    It used to be whatever sat first in the flattened option list, which was the
    Standard drum kit — so New Project on native started as a drum solo, and
    would now start as a voice.
  */
  const [lyrics, setLyrics] = useState(true);
  const [lyricsTheme, setLyricsTheme] = useState('');
  /*
    Whether a model is writing the music.

    Held here rather than only in the sheet because two things in this hook turn
    on it: the default title, and whether a style that rewrites the roster puts
    the singer back.
  */
  const [generating, setGeneratingState] = useState(false);
  /*
    The singer this sheet added, so turning the toggle back off removes that one
    and not a voice the reader chose themselves. A ref: it is read inside
    handlers and must never cause a render.
  */
  const autoVocal = useRef(false);
  const [instruments, setInstruments] = useState<readonly string[]>([
    DEFAULT_INSTRUMENT_VALUE,
  ]);
  /** The chosen style's essential instruments, as picker values. */
  const [essentials, setEssentials] = useState<readonly string[]>([]);

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
      Through `styleRoster`, shared with the web dialog: the style's essential
      instruments (locked while generating), its preferred ones (the singer
      among them in a song style, only while the model writes the music) and a
      couple of its optional ones drawn fresh each time, so two goes at one
      style are not the same band twice. A style overwrites the whole roster
      deliberately: half one genre and half another is nobody's ensemble.
    */
    const roster = styleRoster(next, { voice: generating });
    const values = roster.map(entry => entry.value);
    autoVocal.current = hasVocalInstrument(values);
    setInstruments(values);
    setEssentials(
      roster
        .filter(entry => entry.tier === 'essential')
        .map(entry => entry.value),
    );
    setTempoTextState(String(preset.tempo));
    setMeasuresTextState(String(preset.measures));
    setTimeSignatureState(preset.timeSignature);
    refreshDurationFrom(
      String(preset.measures),
      String(preset.tempo),
      preset.timeSignature,
    );
    if (preset.mode) setMode(preset.mode);
  };

  /*
    Turning the model on gives the roster somebody to sing, because a song needs
    one and the form otherwise opens on a piano solo. Turning it off takes back
    exactly what was given.
  */
  const setGenerating = (next: boolean): void => {
    setGeneratingState(next);
    if (next) {
      if (hasVocalInstrument(instruments)) return;
      autoVocal.current = true;
      setInstruments([DEFAULT_VOCAL_INSTRUMENT_VALUE, ...instruments]);
      return;
    }
    if (!autoVocal.current) return;
    autoVocal.current = false;
    const at = instruments.indexOf(DEFAULT_VOCAL_INSTRUMENT_VALUE);
    if (at === -1 || instruments.length <= 1) return;
    setInstruments(instruments.filter((_, index) => index !== at));
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
    lyrics,
    lyricsTheme,
  };

  return {
    title,
    setTitle,
    defaultTitle: t(
      generating
        ? 'newProject.defaultTitleGenerated'
        : 'newProject.defaultTitle',
    ),
    prompt,
    setPrompt,
    measuresText,
    setMeasuresText,
    durationText,
    setDurationText,
    refreshDuration: () =>
      refreshDurationFrom(measuresText, tempoText, timeSignature),
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
    isLockedInstrument: (index: number) =>
      generating &&
      style !== NONE &&
      essentials.includes(instruments[index]) &&
      instruments.indexOf(instruments[index]) === index,
    lyrics,
    setLyrics,
    lyricsTheme,
    setLyricsTheme,
    hasVocal: hasVocalInstrument(instruments),
    setGenerating,
    draft,
  };
}

/**Anot
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
  generateToggle,
}: {
  draft: ScoreSetupDraft;
  /** Renders the prompt, style, mood and complexity fields. */
  showAi: boolean;
  /** Placed under the title, where the web dialog puts "Generate for me". */
  generateToggle?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  /*
    The briefs the server offers for this style.

    `i18n.exists` filters what arrives: a server one version ahead of this app
    would otherwise offer a brief's id as its own label. The value carried is
    the *text*, because that text is the prompt.
  */
  const { data: presetKeys } = useScorePresets(
    publicServerContext(),
    draft.style === NONE ? undefined : draft.style,
  );
  const presets = (presetKeys ?? [])
    .filter(key => i18n.exists(`generateScore.preset.${key}`))
    .map(key => ({
      value: t(`generateScore.preset.${key}`),
      label: t(`generateScore.preset.${key}`),
    }));

  const lockedLabel = t('generateScore.essential');
  const durationRefused = parseDuration(draft.durationText) === null;

  return (
    <>
      <Field label={t('generateScore.titleField')}>
        <Input
          value={draft.title}
          onChangeText={draft.setTitle}
          placeholder={draft.defaultTitle}
          accessibilityLabel={t('generateScore.titleField')}
        />
      </Field>

      {/* The caller's own control, if it has one — New Project's "Generate for
          me" — in the place the web dialog puts it: under the title, above
          everything it reveals. */}
      {generateToggle ?? null}

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

        {/* A starting point, chosen from the briefs the server offers for the
            style in hand. Rendered only when a list has arrived. */}
        {presets.length > 0 ? (
          <Field label={t('generateScore.presetPrompts')}>
            <Select
              value=""
              placeholder={t('generate.presets')}
              accessibilityLabel={t('generateScore.presetPrompts')}
              options={presets}
              onValueChange={draft.setPrompt}
            />
          </Field>
        ) : null}

        <Row>
          <Field label={t('generateScore.style')} grow>
            <Select
              value={draft.style}
              accessibilityLabel={t('generateScore.style')}
              options={styleSelectOptions(t, i18n.language)}
              onValueChange={draft.applyStyle}
            />
          </Field>
          <Field label={t('generateScore.mood')} grow>
            <Select
              value={draft.mood}
              accessibilityLabel={t('generateScore.mood')}
              options={moodSelectOptions(t, i18n.language)}
              onValueChange={draft.setMood}
            />
          </Field>
          <Field label={t('generateScore.complexity')} grow>
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
        </Row>

        {/* Only where somebody can sing them: syllables under a bass line are
            not a lyric. music_lib drops the field from the request otherwise,
            rather than trusting this to stay in step with the roster. */}
        {draft.hasVocal ? (
          <View className="flex-row items-center gap-3 pb-3">
            <Switch
              checked={draft.lyrics}
              onCheckedChange={draft.setLyrics}
              accessibilityLabel={t('newProject.writeLyrics')}
            />
            <View className="flex-1">
              <Text className="text-foreground text-base">
                {t('newProject.writeLyrics')}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t('newProject.writeLyricsHint')}
              </Text>
            </View>
          </View>
        ) : null}

        {draft.hasVocal && draft.lyrics ? (
          <Field label={t('newProject.lyricsTheme')}>
            <Input
              value={draft.lyricsTheme}
              onChangeText={draft.setLyricsTheme}
              placeholder={t('newProject.lyricsThemePlaceholder')}
              accessibilityLabel={t('newProject.lyricsTheme')}
            />
          </Field>
        ) : null}
      </Reveal>

      {/*
        One picker per part, in order: a score has an ordered instrumentation,
        and the same instrument twice is a perfectly ordinary request. A part
        can be removed unless the chosen style cannot do without it.
      */}
      <Field label={t('generateScore.instrumentation')}>
        <View className="gap-2">
          {draft.instruments.map((value, index) => {
            const locked = draft.isLockedInstrument(index);
            return (
              <View
                key={`${value}-${index}`}
                className="flex-row items-center gap-2"
              >
                <View className="flex-1">
                  <Select
                    value={value}
                    accessibilityLabel={t('generateScore.instrumentation')}
                    options={[...GENERATION_INSTRUMENT_OPTIONS]}
                    disabled={locked}
                    onValueChange={next =>
                      draft.setInstruments(
                        draft.instruments.map((v, i) =>
                          i === index ? next : v,
                        ),
                      )
                    }
                  />
                </View>
                {locked ? (
                  <Text className="text-muted-foreground text-sm">
                    {lockedLabel}
                  </Text>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={draft.instruments.length <= 1}
                    accessibilityLabel={t('generateScore.removeInstrument', {
                      instrument:
                        GENERATION_INSTRUMENT_OPTIONS.find(
                          option => option.value === value,
                        )?.label ?? value,
                    })}
                    onPress={() =>
                      draft.setInstruments(
                        draft.instruments.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ✕
                  </Button>
                )}
              </View>
            );
          })}
          <View className="flex-row">
            <Button
              variant="outline"
              size="sm"
              onPress={() =>
                draft.setInstruments([
                  ...draft.instruments,
                  DEFAULT_INSTRUMENT_VALUE,
                ])
              }
            >
              {t('generateScore.addInstrument')}
            </Button>
          </View>
        </View>
      </Field>

      <Row>
        <Field label={t('generateScore.measures')} grow>
          <Input
            value={draft.measuresText}
            onChangeText={draft.setMeasuresText}
            keyboardType="number-pad"
            accessibilityLabel={t('generateScore.measures')}
          />
        </Field>
        <Field
          label={t('generateScore.duration')}
          grow
          {...(durationRefused
            ? { hint: t('generateScore.durationInvalid') }
            : {})}
        >
          <Input
            value={draft.durationText}
            onChangeText={draft.setDurationText}
            onBlur={draft.refreshDuration}
            accessibilityLabel={t('generateScore.duration')}
          />
        </Field>
        <Field label={t('generateScore.tempo')} grow>
          <Input
            value={draft.tempoText}
            onChangeText={draft.setTempoText}
            keyboardType="number-pad"
            accessibilityLabel={t('generateScore.tempo')}
          />
        </Field>
      </Row>

      <Row>
        <Field label={t('generateScore.key')} grow>
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
        <Field label={t('generateScore.mode')} grow>
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
        <Field label={t('generateScore.timeSignature')} grow>
          <Select
            value={draft.timeSignature}
            accessibilityLabel={t('generateScore.timeSignature')}
            options={Object.keys(GENERATE_SCORE_TIME_SIGNATURE_OPTIONS).map(
              value => ({ value, label: value }),
            )}
            onValueChange={draft.setTimeSignature}
          />
        </Field>
      </Row>
    </>
  );
}

/** Controls side by side, as the web dialog lays them out — one per row wasted the width. */
function Row({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-2">{children}</View>;
}

function Field({
  label,
  children,
  grow = false,
  hint,
}: {
  label: string;
  children: ReactNode;
  /** Shares a row's width with its neighbours. */
  grow?: boolean;
  /** Shown under the control when what was typed is refused. */
  hint?: string;
}) {
  return (
    <View className={grow ? 'min-w-0 flex-1 gap-1 pb-3' : 'gap-1 pb-3'}>
      <Text className="text-muted-foreground text-sm">{label}</Text>
      {children}
      {hint ? <Text className="text-destructive text-sm">{hint}</Text> : null}
    </View>
  );
}
