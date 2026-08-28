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
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Input, Select, Text } from '@sudobility/components-rn';
import {
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
};

export function GenerateTrackSheet({
  open,
  score,
  onClose,
  onSubmit,
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
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('generate.action'),
          disabled: trimmed === '',
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
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground pb-3 text-sm">
          {t('generateTrack.intro')}
        </Text>

        <View className="gap-1 pb-3">
          <Text className="text-muted-foreground text-xs">
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

        <View className="gap-1">
          <Text className="text-muted-foreground text-xs">
            {t('generate.instrument')}
          </Text>
          <Select
            value={value}
            accessibilityLabel={t('generate.instrument')}
            options={[...INSTRUMENT_OPTIONS]}
            onValueChange={setValue}
          />
        </View>
      </ScrollView>
    </FormModal>
  );
}
