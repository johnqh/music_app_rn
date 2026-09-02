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
import { createFilePicker } from '@/documents/file-picker';

/** What the server will accept, and what the picker should therefore offer. */
const AUDIO_EXTENSIONS = ['wav', 'mp3', 'mpa', 'm4a', 'aac'] as const;

/** MIME types by extension; React Native will not infer one for an upload. */
const AUDIO_MIME: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  mpa: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
};

export function nativeUploadFor(uri: string): NativeUploadFile {
  const name = uri.split('/').pop() ?? 'recording';
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return {
    uri,
    name,
    // A default rather than a refusal: the server sniffs the container anyway,
    // and refusing an unusual extension here would reject files it can read.
    type: AUDIO_MIME[extension] ?? 'audio/mpeg',
  };
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
    const uri = await picker.pickFile(AUDIO_EXTENSIONS);
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
              {t('importAudio.description')}
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
