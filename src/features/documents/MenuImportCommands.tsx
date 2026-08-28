/**
 * The File menu's Import items, wired to the same runner as the dashboard.
 *
 * Mounted once, above the navigator, because an import makes a *new* document
 * rather than editing the open one — so it must work from any screen, and it
 * has nowhere sensible to live inside one. Renders only the feedback dialogs;
 * there is no visible control here.
 *
 * Export is deliberately *not* here: it acts on the document in front of you,
 * so it belongs to the editor and is handled there.
 */
import { useCallback } from 'react';
import type { ImportFormat } from '@/documents/import';
import { useMenuCommand } from '@/app/menu-commands';
import type { MenuCommand } from '@/app/menu-commands';
import { ImportFeedback, useImport } from './useImport';

const IMPORT_FOR: Partial<Record<MenuCommand, ImportFormat>> = {
  'import.midi': 'midi',
  'import.musicxml': 'musicxml',
  'import.tracker': 'tracker',
};

export function MenuImportCommands() {
  const { run, warnings, failure, setWarnings, setFailure } = useImport();

  useMenuCommand(
    useCallback(
      (command: MenuCommand) => {
        const format = IMPORT_FOR[command];
        // Export commands reach this listener too — they are handled in the
        // editor, and ignoring them here is what keeps the two from both
        // acting on one menu item.
        if (format) void run(format);
      },
      [run],
    ),
  );

  return (
    <ImportFeedback
      warnings={warnings}
      failure={failure}
      onDismissWarnings={() => setWarnings(null)}
      onDismissFailure={() => setFailure(null)}
    />
  );
}
