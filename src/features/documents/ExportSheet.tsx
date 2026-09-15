/**
 * Choosing what to export to.
 *
 * The web app has a menu on its title bar; a phone has no menu bar, so this is
 * a sheet — the same destinations in the same order and under the same words,
 * because both read music_editing's `WRITABLE_EXPORT_FORMATS`. This sheet had
 * its own list of five with its own labels, and so never offered the project
 * file the web's menu did. Notation first (MIDI, MusicXML), then the tracker
 * module, then audio, then the project itself.
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
import { WRITABLE_EXPORT_FORMATS } from '@sudobility/music_editing';
import type { ExportFormat } from '@/documents/export';
import { prepareTrackerExport } from '@/documents/export';
import type { MusicDocument } from '@/documents/document';

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
        actions={WRITABLE_EXPORT_FORMATS.map(format => ({
          label: t(format.labelKey),
          onPress: () => choose(format.id),
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
