/**
 * The two questions cut and paste have to ask.
 *
 * Neither is asked every time. `useClipboardPrompts` in music_editing decides —
 * the rule is "ask only when the answers differ", so cutting from the end of a
 * track, where closing the gap and leaving silence produce the same score,
 * costs no extra tap. Both halves of that (the test, and the state) live in the
 * library so the web dialog and this sheet cannot come to disagree about when a
 * question is warranted; only the drawing is here.
 */
import { useTranslation } from 'react-i18next';
import type { ClipboardPrompts } from '@sudobility/music_editing';
import { ChoiceSheet } from './ChoiceSheet';

export function ClipboardPromptSheets({
  clipboard,
}: {
  clipboard: ClipboardPrompts;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceSheet
        open={clipboard.pendingCut}
        title={t('editor.cutTitle')}
        message={t('editor.cutMessage')}
        choices={[
          {
            value: 'silence' as const,
            label: t('editor.leaveSilence'),
            detail: t('editor.leaveSilenceDetail'),
            primary: true,
          },
          {
            value: 'close' as const,
            label: t('editor.closeGap'),
            detail: t('editor.closeGapDetail'),
          },
        ]}
        onChoose={clipboard.resolveCut}
        onCancel={clipboard.cancel}
      />
      <ChoiceSheet
        open={clipboard.pendingPaste}
        title={t('editor.pasteTitle')}
        message={t('editor.pasteMessage')}
        choices={[
          {
            value: 'replace' as const,
            label: t('replace.action'),
            detail: t('editor.replaceDetail'),
            primary: true,
          },
          {
            value: 'insert' as const,
            label: t('editor.insert'),
            detail: t('editor.insertDetail'),
          },
        ]}
        onChoose={clipboard.resolvePaste}
        onCancel={clipboard.cancel}
      />
    </>
  );
}
