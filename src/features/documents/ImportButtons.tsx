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
 * **A Moosiac project file is offered here too**, and used not to be, on the
 * grounds that opening one is File → Open rather than an import. That held on
 * macOS and nowhere else: `file.new`/`file.open` live on the menu bar, which
 * iOS and Android do not have — so `.moo` was a format those two could write
 * from the export sheet and then never read back. Opening one *is* an import
 * here for the same reason every other import is: it ends in a new document.
 * The web app's dashboard offers it in the same menu.
 *
 * It needs no account. A `.moo` is a local document decoded on the device, so
 * this control stays useful signed out — which is why it sits above the
 * sign-in gate.
 */
/**
 * Exported for `ImportPane.tsx` (the desktop Projects window's Import
 * sidebar item) — the same five formats in the same order, so the dropdown
 * here and the list there cannot silently drift into offering different
 * things.
 *
 * `descriptionKey` reuses the in-app documentation's own `docs.formats.in.*`
 * table (`docs/formats/README` doc screen, "Formats it reads") rather than a
 * second set of strings — the same sentence explaining what a MIDI or
 * MusicXML import keeps is one fact, not two that agree until an edit misses
 * one of them.
 */
export const OFFERED = [
  {
    value: 'midi',
    labelKey: 'dashboard.importMidi',
    descriptionKey: 'docs.formats.in.midi',
  },
  {
    value: 'musicxml',
    labelKey: 'dashboard.importMusicXml',
    descriptionKey: 'docs.formats.in.musicxml',
  },
  {
    value: 'tracker',
    labelKey: 'dashboard.importModule',
    descriptionKey: 'docs.formats.in.tracker',
  },
  {
    value: 'audio',
    labelKey: 'dashboard.importAudio',
    descriptionKey: 'docs.formats.in.audio',
  },
  {
    value: 'project',
    labelKey: 'dashboard.importProject',
    descriptionKey: 'docs.formats.in.project',
  },
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
          } catch (error) {
            /*
              The sheet hands this callback a fire-and-forget promise, so a
              refused upload — no connection, a file the server will not take,
              an expired session — used to be an unhandled rejection: the
              spinner stopped and nothing said why. It is reported through the
              importer's own failure dialog, the one every other format's
              refusal already uses, after the sheet closes so the two are
              never stacked.
            */
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
    </View>
  );
}
