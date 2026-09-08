/**
 * Bringing a file in — one menu, every format.
 *
 * Every import makes a **new document**, never an edit to the open one — which
 * is why this lives in the empty state and on the dashboard rather than on the
 * editor's own toolbar. The web app follows the same rule for the same reason:
 * an Import menu inside a project could only throw you out of the project you
 * had open.
 *
 * Warnings from the decode are shown rather than swallowed. A MusicXML file can
 * carry things this model does not hold, and a silent import that quietly drops
 * a third of the markings is worse than one that says what it left behind.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Select } from '@sudobility/components-rn';
import type { NativeUploadFile } from '@sudobility/music_client';
import type { ImportFormat } from '@/documents/import';
import { ImportFeedback, useImport } from './useImport';
import { AudioImportSheet } from './AudioImportSheet';

/**
 * What the Import menu offers, in one control.
 *
 * Four buttons that differed by a word were one decision — which file — spread
 * across four controls. Audio is among them and stays offered whether or not a
 * server is configured: it *says* why it cannot run rather than vanishing,
 * because a control that comes and goes teaches the reader nothing about where
 * to find it.
 *
 * A project document is deliberately absent. Opening one of those is File →
 * Open and Recent Documents, not an import — an import makes a new document out
 * of somebody else's format.
 */
const OFFERED = [
  { value: 'midi', labelKey: 'import.midi' },
  { value: 'musicxml', labelKey: 'import.musicXml' },
  { value: 'tracker', labelKey: 'import.tracker' },
  { value: 'audio', labelKey: 'import.audio' },
] as const;

export type ImportButtonsProps = {
  /**
   * Uploads a recording for transcription.
   *
   * Omitted where there is no server: a recording is transcribed *server-side*
   * — the models and the four megabytes of weights live in
   * `midi_transcriber_api` — so unlike every other import this one cannot
   * happen offline, and offering it would be offering a button that fails.
   */
  onTranscribeAudio?: (file: NativeUploadFile) => Promise<void> | void;
};

export function ImportButtons({ onTranscribeAudio }: ImportButtonsProps = {}) {
  const { t } = useTranslation();
  // The same runner the macOS File menu uses, so the two cannot decode a file
  // differently or report a different set of warnings.
  const importer = useImport();
  const { run } = importer;
  const [audioOpen, setAudioOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  return (
    <View className="flex-row flex-wrap gap-2">
      {/*
        Held with no `value`, so the trigger goes on reading "Import" rather
        than becoming the last format chosen — this is a menu, not a setting.
      */}
      <Select
        accessibilityLabel={t('dashboard.importFormat')}
        placeholder={t('dashboard.import')}
        options={OFFERED.map(o => ({ value: o.value, label: t(o.labelKey) }))}
        onValueChange={value => {
          // Audio is not a `run(format)` import: it uploads to the server
          // rather than decoding locally, so it opens a sheet of its own.
          if (value === 'audio') setAudioOpen(true);
          else void run(value as ImportFormat);
        }}
      />

      <AudioImportSheet
        open={audioOpen}
        busy={uploading}
        available={onTranscribeAudio !== undefined}
        onClose={() => setAudioOpen(false)}
        onUpload={async file => {
          if (!onTranscribeAudio) return;
          setUploading(true);
          try {
            await onTranscribeAudio(file);
            setAudioOpen(false);
          } finally {
            setUploading(false);
          }
        }}
      />

      <ImportFeedback state={importer} />
    </View>
  );
}
