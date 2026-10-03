/**
 * Adding one generated track to the open score.
 *
 * A prompt and an instrument, and nothing else — everything a track has to
 * agree with is taken from the score by `buildGenerateTrackRequest`: its
 * length, time signature, key and tempo. Offering those as fields would let a
 * reader ask for a track that cannot line up with the music it is meant to
 * accompany, and the result would be unusable rather than merely different.
 *
 * The instrument list is the shared catalogue: all 128 GM programs by family,
 * with the eight drum kits ahead of them. A kit is chosen as a kit rather than
 * as a program, because on a percussion track `midiProgram` names a kit and the
 * two never agree — Brush is 40 and program 40 is Violin.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Input, Select, Text } from '@sudobility/components-rn';
import {
  estimateGenerateTrackCredits,
  DEFAULT_INSTRUMENT_VALUE,
  FAMILY_GROUPS,
  KIT_OPTIONS,
  buildGenerateTrackRequest,
  instrumentChoiceFor,
} from '@sudobility/music_lib';
import type { GenerateTrackRequest } from '@sudobility/music_lib';
import type { Score } from '@sudobility/music_types';

/** Kits first: they are addressed differently and must not be mistaken for programs. */
const INSTRUMENT_OPTIONS: readonly { value: string; label: string }[] = [
  ...KIT_OPTIONS.map(kit => ({ value: kit.value, label: kit.label })),
  ...FAMILY_GROUPS.flatMap(group =>
    group.instruments.map(instrument => ({
      value: String(instrument.program),
      label: `${group.label} · ${instrument.name}`,
    })),
  ),
];

export type GenerateTrackSheetProps = {
  open: boolean;
  score: Score;
  onClose: () => void;
  onSubmit: (request: GenerateTrackRequest) => void;
  /**
   * The job is being started (the pending edit written, the job posted).
   * Generate spins and the sheet stays up, every way out refused, until the
   * server has answered.
   */
  submitting?: boolean;
};

function ignore(): void {}

export function GenerateTrackSheet({
  open,
  score,
  onClose,
  onSubmit,
  submitting = false,
}: GenerateTrackSheetProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [value, setValue] = useState(DEFAULT_INSTRUMENT_VALUE);

  useEffect(() => {
    if (open) setPrompt('');
  }, [open]);

  const trimmed = prompt.trim();

  return (
    <FormModal
      visible={open}
      title={t('generateTrack.title')}
      onClose={submitting ? ignore : onClose}
      saving={submitting}
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        {
          label: t('common.cancel'),
          onPress: onClose,
          variant: 'ghost',
          disabled: submitting,
        },
        {
          label: t('generate.action'),
          disabled: trimmed === '',
          loading: submitting,
          onPress: () =>
            onSubmit(
              buildGenerateTrackRequest(
                score,
                trimmed,
                instrumentChoiceFor(value),
              ),
            ),
        },
      ]}
    >
      <>
        <Text className="text-muted-foreground pb-3 text-base">
          {t('generateTrack.intro')}
        </Text>

        <View className="gap-1 pb-3">
          <Text className="text-muted-foreground text-sm">
            {t('generateTrack.promptLabel')}
          </Text>
          <Input
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={3}
            placeholder={t('generateTrack.promptPlaceholder')}
            accessibilityLabel={t('generateTrack.promptLabel')}
          />
        </View>

        <View className="gap-1 pb-3">
          <Text className="text-muted-foreground text-sm">
            {t('generate.instrument')}
          </Text>
          <Select
            value={value}
            accessibilityLabel={t('generate.instrument')}
            options={[...INSTRUMENT_OPTIONS]}
            onValueChange={setValue}
          />
        </View>

        {/* Every bar of the score, once: what the server bills for a new part. */}
        <Text className="text-muted-foreground text-sm">
          {t('generate.estimate', {
            count: estimateGenerateTrackCredits(score),
          })}
        </Text>
      </>
    </FormModal>
  );
}
