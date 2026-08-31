/**
 * Bringing a file in.
 *
 * Every import makes a **new document**, never an edit to the open one — which
 * is why these live in the empty state and on the dashboard rather than on the
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
import { Button } from '@sudobility/components-rn';
import type { NativeUploadFile } from '@sudobility/music_client';
import type { ImportFormat } from '@/documents/import';
import { ImportFeedback, useImport } from './useImport';
import { AudioImportSheet } from './AudioImportSheet';

const OFFERED: readonly { format: ImportFormat; labelKey: string }[] = [
  { format: 'midi', labelKey: 'import.midi' },
  { format: 'musicxml', labelKey: 'import.musicXml' },
  { format: 'tracker', labelKey: 'import.tracker' },
];

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
      {OFFERED.map(o => (
        <Button
          key={o.format}
          variant="secondary"
          onPress={() => void run(o.format)}
        >
          {t(o.labelKey)}
        </Button>
      ))}

      {/*
        Audio is offered whether or not a server is configured, and *says* why
        it cannot run rather than vanishing: a control that comes and goes
        teaches the reader nothing about where to find it.
      */}
      <Button variant="secondary" onPress={() => setAudioOpen(true)}>
        {t('import.audio')}
      </Button>

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
