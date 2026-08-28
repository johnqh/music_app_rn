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
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@sudobility/components-rn';
import type { ImportFormat } from '@/documents/import';
import { ImportFeedback, useImport } from './useImport';

const OFFERED: readonly { format: ImportFormat; labelKey: string }[] = [
  { format: 'midi', labelKey: 'import.midi' },
  { format: 'musicxml', labelKey: 'import.musicXml' },
  { format: 'tracker', labelKey: 'import.tracker' },
];

export function ImportButtons() {
  const { t } = useTranslation();
  // The same runner the macOS File menu uses, so the two cannot decode a file
  // differently or report a different set of warnings.
  const { run, warnings, failure, setWarnings, setFailure } = useImport();

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

      <ImportFeedback
        warnings={warnings}
        failure={failure}
        onDismissWarnings={() => setWarnings(null)}
        onDismissFailure={() => setFailure(null)}
      />
    </View>
  );
}
