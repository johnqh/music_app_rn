/**
 * The desktop Projects window's Import pane — the five formats
 * `ImportButtons`' dropdown offers, as a plain list instead: clicking a
 * format opens the OS picker directly (`useImport`'s `run`, the same one
 * `ImportButtons` and the macOS File menu's Import submenu call — see
 * `FileImportModal.tsx` on the web for the sibling fix this already had
 * here), with no extra "are you sure" step in between.
 *
 * Audio is the one exception, same as everywhere else it is offered: it
 * uploads to the server rather than decoding on the device, so it keeps its
 * own sheet (`AudioImportSheet`, which *also* opens its own picker
 * immediately) instead of a bare `run('audio')`.
 */
import { useCallback, useState } from 'react';
import { FlatList, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import type { NativeUploadFile } from '@sudobility/music_client';
import type { ImportFormat } from '@/documents/import';
import { OFFERED } from '@/features/documents/ImportButtons';
import { ImportFeedback, useImport } from '@/features/documents/useImport';
import { AudioImportSheet } from '@/features/documents/AudioImportSheet';
import { getMusicClient } from '@/config/server';
import { useServerContext } from '@/config/useServerContext';

type OfferedFormat = (typeof OFFERED)[number];

export type ImportPaneProps = {
  /** A project landed — from a local import, or an audio upload starting. */
  onOpened: () => void;
};

export function ImportPane({ onOpened }: ImportPaneProps) {
  const { t } = useTranslation();
  const importer = useImport({ onImported: onOpened });
  const { run } = importer;
  const context = useServerContext();
  const [audioOpen, setAudioOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  /**
   * Uploads a recording and lets it transcribe in the background — the same
   * call `DashboardScreen`'s `ProjectList` makes. The project does not exist
   * yet when this returns (it fills in once the job lands), but the upload
   * itself succeeding is what "Import" means for this format, and is what
   * closes this window the same way a local import landing does.
   */
  const transcribeAudio = useCallback(
    async (file: NativeUploadFile) => {
      const client = getMusicClient();
      const token = await context?.getToken?.();
      if (!client || !token) return;
      await client.transcribeAudio(file, file.name, token);
      onOpened();
    },
    [context, onOpened],
  );

  return (
    <>
      <FlatList
        data={OFFERED}
        keyExtractor={(item: OfferedFormat) => item.value}
        accessibilityLabel={t('dashboard.importFormat')}
        contentContainerClassName="gap-2 p-4"
        renderItem={({ item }: { item: OfferedFormat }) => {
          const choose = () => {
            if (item.value === 'audio') setAudioOpen(true);
            else void run(item.value as ImportFormat);
          };
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
              onPress={choose}
              // macOS has no synthesized-touch fallback for an assistive
              // press, so a VoiceOver activation reaches a Pressable only
              // through `onAccessibilityTap` — `onPress` is a touch/mouse
              // responder.
              onAccessibilityTap={choose}
              className="border-border bg-card rounded-lg border p-3"
              style={{ minHeight: MIN_TOUCH_TARGET }}
            >
              <Text className="text-foreground font-medium">
                {t(item.labelKey)}
              </Text>
              <Text className="text-muted-foreground text-sm">
                {t(item.descriptionKey)}
              </Text>
            </Pressable>
          );
        }}
      />
      <AudioImportSheet
        open={audioOpen}
        busy={uploading}
        available={context !== null}
        onClose={() => setAudioOpen(false)}
        onUpload={async file => {
          setUploading(true);
          try {
            await transcribeAudio(file);
            setAudioOpen(false);
          } catch (error) {
            // Closed first, same order `ImportButtons` uses: the sheet's own
            // job is done (a file was picked and sent), and the failure is
            // this pane's to report, not a reason to leave the sheet open
            // stacked on top of it.
            setAudioOpen(false);
            importer.setFailure(
              error instanceof Error ? error.message : String(error),
            );
          } finally {
            setUploading(false);
          }
        }}
      />
      <ImportFeedback state={importer} />
    </>
  );
}
