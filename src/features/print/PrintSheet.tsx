/**
 * What to print, on what paper, which way up — then print.
 *
 * The web print view's three pickers, in its order: the whole score or one
 * player's part, the paper, the orientation. Native used to print straight off
 * the title bar with none of them, so every printout was the whole score on
 * portrait A4 — a US Letter printer got a page laid out for a sheet it does not
 * have, and a player could not print their own part at all.
 *
 * The options are music_drawing's (`PAPER_OPTIONS`, `ORIENTATION_OPTIONS`,
 * `WHOLE_SCORE`) and so are their label keys; what each choice *does* is
 * `printPlan`'s. A part is written for its instrument with the score's
 * rehearsal marks and page turns laid out for that player; the whole score is
 * the visible tracks in concert pitch. This sheet only collects the answers.
 *
 * Held here rather than remembered: a print is a one-off, and a paper size
 * carried silently into next week's printout is a surprise.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Select } from '@sudobility/components-rn';
import {
  ORIENTATION_OPTIONS,
  PAPER_OPTIONS,
  WHOLE_SCORE,
} from '@sudobility/music_drawing';
import type {
  PaperOrientation,
  PaperSize,
  PrintPlanOptions,
} from '@sudobility/music_drawing';
import type { Score } from '@sudobility/music_types';
import { Field } from '@/features/inspector/Field';

export type PrintSheetProps = {
  open: boolean;
  score: Score;
  /** What the whole score prints; hidden tracks stay off the paper. */
  visibleTrackIds: readonly string[];
  onClose: () => void;
  onPrint: (options: PrintPlanOptions) => void;
};

export function PrintSheet({
  open,
  score,
  visibleTrackIds,
  onClose,
  onPrint,
}: PrintSheetProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<string>(WHOLE_SCORE);
  const [paper, setPaper] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<PaperOrientation>('portrait');

  // A part whose track has since been deleted falls back to the whole score
  // rather than printing nothing.
  const effectiveScope = score.tracks.some(track => track.id === scope)
    ? scope
    : WHOLE_SCORE;

  return (
    <FormModal
      visible={open}
      title={t('print.action')}
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('print.action'),
          onPress: () =>
            onPrint({
              scope: effectiveScope,
              visibleTrackIds,
              paper,
              orientation,
            }),
        },
      ]}
    >
      <View className="gap-3">
        <Field label={t('print.whatToPrint')}>
          <Select
            value={effectiveScope}
            accessibilityLabel={t('print.whatToPrint')}
            options={[
              { value: WHOLE_SCORE, label: t('print.wholeScore') },
              ...score.tracks.map(track => ({
                value: track.id,
                label: track.name,
              })),
            ]}
            onValueChange={setScope}
          />
        </Field>
        <Field label={t('print.paper')}>
          <Select
            value={paper}
            accessibilityLabel={t('print.paper')}
            options={PAPER_OPTIONS.map(option => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            onValueChange={value => setPaper(value as PaperSize)}
          />
        </Field>
        <Field label={t('print.orientation')}>
          <Select
            value={orientation}
            accessibilityLabel={t('print.orientation')}
            options={ORIENTATION_OPTIONS.map(option => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            onValueChange={value => setOrientation(value as PaperOrientation)}
          />
        </Field>
      </View>
    </FormModal>
  );
}
