/**
 * Importing a recording as a project.
 *
 * Nothing is analysed here. The file is handed to the server, which separates
 * it, transcribes each part and sends back a score — so this picks a file, says
 * what will happen, and uploads. The models and the weights that used to make
 * this the heaviest screen in the web app all live in `midi_transcriber_api`.
 *
 * There is no tempo field and no confirm step, because the score does not exist
 * yet when the sheet closes: the project is created immediately in a
 * `transcribing` state and fills itself in when the job lands.
 *
 * **The recording is uploaded by path, not by bytes.** React Native's `Blob`
 * cannot be constructed from an `ArrayBuffer`, so reading a recording in order
 * to send it is not possible — and would mean holding a whole audio file in
 * memory if it were. `MusicClient.transcribeAudio` takes an `UploadableFile`
 * for exactly this: the browser passes its `File`, native passes
 * `{ uri, name, type }` and RN's networking layer streams it.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import type { NativeUploadFile } from '@sudobility/music_client';
import { AUDIO_IMPORT_EXTENSIONS, audioMimeFor } from '@sudobility/music_io';
import { createFilePicker } from '@/documents/file-picker';

/**
 * The formats as a reader names them, for the description.
 *
 * The list is music_io's `AUDIO_IMPORT_EXTENSIONS`, the one the web picker
 * offers — this sheet kept its own copy of it and of the MIME table beside it —
 * and the words are the web's: the description takes `{{formats}}`, so the
 * two apps describe the import in one sentence rather than two.
 */
const FORMAT_NAMES = AUDIO_IMPORT_EXTENSIONS.map(ext => ext.toUpperCase()).join(
  ', ',
);

export function nativeUploadFor(uri: string): NativeUploadFile {
  const name = uri.split('/').pop() ?? 'recording';
  // `audioMimeFor` defaults rather than refusing: the server sniffs the
  // container anyway, and React Native will not infer a type for an upload.
  return { uri, name, type: audioMimeFor(name) };
}

export type AudioImportSheetProps = {
  open: boolean;
  /** True while the recording is being uploaded. */
  busy?: boolean;
  /** False where this deployment cannot transcribe at all. */
  available?: boolean;
  onClose: () => void;
  onUpload: (file: NativeUploadFile) => void;
};

export function AudioImportSheet({
  open,
  busy = false,
  available = true,
  onClose,
  onUpload,
}: AudioImportSheetProps) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<NativeUploadFile | null>(null);

  const choose = async (): Promise<void> => {
    const picker = createFilePicker();
    if (!picker.isSupported()) return;
    const uri = await picker.pickFile(AUDIO_IMPORT_EXTENSIONS);
    // Cancelling is an ordinary outcome, not something to report.
    if (uri) setPicked(nativeUploadFor(uri));
  };

  const close = (): void => {
    setPicked(null);
    onClose();
  };

  return (
    <FormModal
      visible={open}
      title={t('importAudio.title')}
      onClose={close}
      actions={[
        { label: t('common.cancel'), onPress: close, variant: 'ghost' },
        {
          label: picked ? t('importAudio.upload') : t('importAudio.choose'),
          onPress: () => {
            if (picked) onUpload(picked);
            else void choose();
          },
          variant: 'primary',
          ...(available ? {} : { disabled: true }),
          ...(busy ? { loading: true } : {}),
        },
      ]}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-2 p-1">
        {available ? (
          <>
            <Text className="text-foreground text-base">
              {t('importAudio.description', { formats: FORMAT_NAMES })}
            </Text>
            {picked ? (
              <Text className="text-muted-foreground text-sm">
                {picked.name}
              </Text>
            ) : null}
            {/*
              A warning rather than a choice: trimming would mean decoding the
              audio here, which is the very work that was moved to the server.
            */}
            <Text className="text-muted-foreground text-sm">
              {t('importAudio.longRecording')}
            </Text>
          </>
        ) : (
          <Text className="text-foreground text-base">
            {t('importAudio.unavailable')}
          </Text>
        )}
      </View>
    </FormModal>
  );
}
