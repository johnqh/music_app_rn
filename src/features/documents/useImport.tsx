/**
 * Importing a file into a new document, and saying what was lost.
 *
 * Extracted from `ImportButtons` when the macOS File menu grew Import items:
 * the menu and the dashboard buttons do exactly the same thing, and a second
 * copy of "pick a file, decode it, report the warnings" is a second place for
 * the warning contract to drift out of step with music_io's.
 *
 * The feedback dialogs travel with the hook rather than being left to each
 * caller, because an importer that silently drops a warning is the failure
 * this whole path exists to prevent.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import type { MidiImportOptions, MidiSummary } from '@sudobility/music_lib';
import { IMPORT_EXTENSIONS, importDocument } from '@/documents/import';
import type { ImportFormat } from '@/documents/import';
import { createFilePicker } from '@/documents/file-picker';
import { createImportSource } from '@/documents/rn-storage';
import {
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';
import { getAppServices, libraryCopy } from '@/config/initialize';
import { MidiImportSheet } from './MidiImportSheet';

export function useImport() {
  const { t } = useTranslation();
  const list = useDocumentList();
  // Signed in, an import becomes a server project; the services say whether
  // there is a server and an account to make one with.
  const services = useDocumentServices();
  const [warnings, setWarnings] = useState<readonly string[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * A MIDI file that has been read and analysed but not yet imported.
   *
   * MIDI is the one format that cannot be imported without deciding things —
   * bar lines, clefs and key are all guesses — so the file is analysed first
   * and the wizard opened over the result. Every other format states its own
   * content outright and goes straight in.
   */
  const [pendingMidi, setPendingMidi] = useState<{
    uri: string;
    summary: MidiSummary;
  } | null>(null);

  const finish = useCallback(
    async (
      format: ImportFormat,
      uri: string,
      midiOptions?: MidiImportOptions,
    ): Promise<void> => {
      try {
        const result = await importDocument(
          list,
          services,
          createImportSource(),
          getAppServices().io,
          format,
          uri,
          libraryCopy.musicXmlWarnings(),
          midiOptions,
        );
        if (result.warnings.length > 0) setWarnings(result.warnings);
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    },
    [list, services],
  );

  /**
   * Imports a file already chosen — by the picker below, or by an open link.
   * MIDI still goes through its wizard either way.
   */
  const importFile = useCallback(
    async (format: ImportFormat, uri: string): Promise<void> => {
      try {
        if (format === 'midi') {
          // Analysed here rather than inside the sheet: reading the file can
          // fail, and a failure belongs in this hook's own report rather than
          // inside a modal that has already opened.
          const bytes = await createImportSource().readBytes(uri);
          setPendingMidi({
            uri,
            summary: getAppServices().io.analyzeMidi(bytes),
          });
          return;
        }
        await finish(format, uri);
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    },
    [finish],
  );

  const run = useCallback(
    async (format: ImportFormat): Promise<void> => {
      const picker = createFilePicker();
      if (!picker.isSupported()) {
        setFailure(t('import.unsupported'));
        return;
      }
      try {
        const uri = await picker.pickFile(IMPORT_EXTENSIONS[format]);
        // Cancelling is an ordinary outcome, not a failure to report.
        if (!uri) return;
        await importFile(format, uri);
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    },
    [t, importFile],
  );

  const confirmMidi = useCallback(
    (options: MidiImportOptions): void => {
      const pending = pendingMidi;
      setPendingMidi(null);
      if (pending) void finish('midi', pending.uri, options);
    },
    [pendingMidi, finish],
  );

  return {
    run,
    importFile,
    warnings,
    failure,
    setWarnings,
    setFailure,
    pendingMidi,
    confirmMidi,
    cancelMidi: () => setPendingMidi(null),
  };
}

export type ImportState = ReturnType<typeof useImport>;

/**
 * Everything the importer has to say, mounted by whoever ran it.
 *
 * Takes the hook's whole result rather than four hand-picked props: the MIDI
 * wizard joined the warnings and the failure here, and a caller that has to
 * remember to thread each new piece is a caller that will one day drop one —
 * which for an importer means silently losing the warning it exists to give.
 */
export function ImportFeedback({ state }: { state: ImportState }) {
  const { t } = useTranslation();
  const {
    warnings,
    failure,
    setWarnings,
    setFailure,
    pendingMidi,
    confirmMidi,
    cancelMidi,
  } = state;
  const onDismissWarnings = (): void => setWarnings(null);
  const onDismissFailure = (): void => setFailure(null);
  return (
    <>
      {/*
        MIDI asks before it imports: bar lines, clefs and key are all guesses,
        and a guess nobody was shown is a guess nobody can correct.
      */}
      <MidiImportSheet
        open={pendingMidi !== null}
        summary={pendingMidi?.summary ?? null}
        onCancel={cancelMidi}
        onImport={confirmMidi}
      />
      <FormModal
        visible={warnings !== null}
        title={t('import.warningsTitle')}
        onClose={onDismissWarnings}
        onSave={onDismissWarnings}
        saveLabel={t('common.ok')}
        closeAriaLabel={t('common.closeDialog')}
      >
        <View className="gap-2">
          <Text className="text-muted-foreground text-base">
            {t('import.warningsExplain')}
          </Text>
          {(warnings ?? []).map(warning => (
            <Text key={warning} className="text-foreground text-base">
              {warning}
            </Text>
          ))}
        </View>
      </FormModal>

      <FormModal
        visible={failure !== null}
        title={t('import.failedTitle')}
        onClose={onDismissFailure}
        onSave={onDismissFailure}
        saveLabel={t('common.ok')}
        closeAriaLabel={t('common.closeDialog')}
      >
        <Text className="text-foreground text-base">{failure}</Text>
      </FormModal>
    </>
  );
}
