/**
 * Choosing what to export to.
 *
 * The web app has a menu on its title bar; a phone has no menu bar, so this is
 * a sheet — the same five destinations in the same order, which is what makes
 * the two the same product. Notation first (MIDI, MusicXML), then the tracker
 * module, then audio, because that is the order of how much the format keeps:
 * MusicXML round-trips the page, MIDI keeps the performance, XM keeps the notes
 * on a grid, and a WAV keeps only the sound.
 *
 * A tracker export is the one that can ask a question. `prepareTrackerExport`
 * builds the module and reports what a write would cost, and the numbers are
 * offered *before* anything lands on disk — the row grid, the channel count
 * and the note range are all lossy, and a reader about to lose a bassline's
 * bottom octave should be told rather than shown afterwards. A clean fit costs
 * no extra tap, which is the common case for XM.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { isCleanFit, trackerFitLosses } from '@sudobility/music_lib';
import type { TrackerFitReport } from '@sudobility/music_lib';
import type { ExportFormat } from '@/documents/export';
import { prepareTrackerExport } from '@/documents/export';
import type { MusicDocument } from '@/documents/document';

/** In order of how much of the music the format keeps. */
const OFFERED: readonly { format: ExportFormat; labelKey: string }[] = [
  { format: 'midi', labelKey: 'editor.midi' },
  { format: 'musicxml', labelKey: 'editor.musicXml' },
  { format: 'xm', labelKey: 'export.xm' },
  { format: 'wav', labelKey: 'export.wav' },
  { format: 'mp3', labelKey: 'export.mp3' },
];

export type ExportSheetProps = {
  open: boolean;
  document: MusicDocument;
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
};

export function ExportSheet({
  open,
  document,
  onClose,
  onExport,
}: ExportSheetProps) {
  const { t } = useTranslation();
  const [pendingFit, setPendingFit] = useState<TrackerFitReport | null>(null);

  const choose = (format: ExportFormat): void => {
    if (format !== 'xm') {
      onExport(format);
      onClose();
      return;
    }
    const score = document.store.getState().score;
    if (!score) return;
    const { report } = prepareTrackerExport(score);
    // A clean fit must not cost a tap: for XM that is the common case, and a
    // confirmation that always says "nothing was lost" is one people learn to
    // dismiss without reading.
    if (isCleanFit(report)) {
      onExport(format);
      onClose();
      return;
    }
    setPendingFit(report);
  };

  return (
    <>
      <FormModal
        visible={open && pendingFit === null}
        title={t('editor.export')}
        onClose={onClose}
        closeAriaLabel={t('common.closeDialog')}
        actions={OFFERED.map(o => ({
          label: t(o.labelKey),
          onPress: () => choose(o.format),
          variant: 'secondary' as const,
        }))}
      >
        <Text className="text-muted-foreground text-base">
          {t('export.explain')}
        </Text>
      </FormModal>

      <FormModal
        visible={pendingFit !== null}
        title={t('trackerFit.title')}
        onClose={() => setPendingFit(null)}
        closeAriaLabel={t('common.closeDialog')}
        actions={[
          {
            label: t('common.cancel'),
            onPress: () => setPendingFit(null),
            variant: 'ghost' as const,
          },
          {
            label: t('trackerFit.confirm'),
            onPress: () => {
              setPendingFit(null);
              onExport('xm');
              onClose();
            },
          },
        ]}
      >
        <View className="gap-2">
          {/*
            The numbers are named rather than summarised: "some notes were
            changed" is not something a reader can act on, where "12 notes
            outside the format's range were moved" tells them what to do.
          */}
          {pendingFit
            ? trackerFitLosses(pendingFit).map(({ kind, count }) => (
                <Text key={kind} className="text-foreground text-base">
                  {t(`trackerFit.${kind}`, { count, format: 'XM' })}
                </Text>
              ))
            : null}
        </View>
      </FormModal>
    </>
  );
}
