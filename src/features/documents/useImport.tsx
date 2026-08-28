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
import { IMPORT_EXTENSIONS, importDocument } from '@/documents/import';
import type { ImportFormat } from '@/documents/import';
import { createFilePicker } from '@/documents/file-picker';
import { createImportSource } from '@/documents/rn-storage';
import { getAppServices } from '@/config/initialize';
import { useDocumentList } from '@/documents/DocumentsContext';
import { musicXmlWarningCopy } from '@/i18n/lib-copy';

export function useImport() {
  const { t } = useTranslation();
  const list = useDocumentList();
  const [warnings, setWarnings] = useState<readonly string[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

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
        const result = await importDocument(
          list,
          createImportSource(),
          getAppServices().io,
          format,
          uri,
          musicXmlWarningCopy(),
        );
        if (result.warnings.length > 0) setWarnings(result.warnings);
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    },
    [list, t],
  );

  return { run, warnings, failure, setWarnings, setFailure };
}

export function ImportFeedback({
  warnings,
  failure,
  onDismissWarnings,
  onDismissFailure,
}: {
  warnings: readonly string[] | null;
  failure: string | null;
  onDismissWarnings: () => void;
  onDismissFailure: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <FormModal
        visible={warnings !== null}
        title={t('import.warningsTitle')}
        onClose={onDismissWarnings}
        onSave={onDismissWarnings}
        saveLabel={t('common.ok')}
        closeAriaLabel={t('common.closeDialog')}
      >
        <View className="gap-2">
          <Text className="text-muted-foreground text-sm">
            {t('import.warningsExplain')}
          </Text>
          {(warnings ?? []).map(warning => (
            <Text key={warning} className="text-foreground text-sm">
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
        <Text className="text-foreground text-sm">{failure}</Text>
      </FormModal>
    </>
  );
}
