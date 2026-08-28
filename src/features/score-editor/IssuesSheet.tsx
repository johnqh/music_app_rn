/**
 * What is wrong with the score, and what can be put right automatically.
 *
 * The issues themselves come from `validateScore`, which the store recomputes
 * on every change — a bar that does not add up, a note past the last barline, a
 * chord thicker than the instrument can play. Nothing here decides what an
 * issue is.
 *
 * **Fix all reports what actually left the list, not what was attempted.**
 * Several rules — how many notes sound at once, most obviously — have no repair
 * that is not a guess about the music, so "fixed everything" over a list that
 * still has entries in it is a lie the reader can see. `repairAllIssues`
 * answers with both numbers for exactly that reason, and does the whole sweep
 * as one undoable step.
 */
import { View } from 'react-native';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { repairAllIssues } from '@sudobility/music_editing';
import type { MusicDocument } from '@/documents/document';

export function IssuesSheet({
  open,
  document,
  onClose,
}: {
  open: boolean;
  document: MusicDocument;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const issues = useStore(document.store, s => s.validationIssues);

  return (
    <FormModal
      visible={open}
      title={t('editor.validationIssues')}
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      actions={[
        { label: t('common.cancel'), onPress: onClose, variant: 'ghost' },
        {
          label: t('editor.fixIssues'),
          onPress: () => {
            const { remaining } = repairAllIssues(
              document.store,
              t('editor.fixIssues'),
            );
            // Closed only when the list is actually empty: leaving it open over
            // what could not be repaired is what tells the reader there is
            // still something here that needs a decision.
            if (remaining === 0) onClose();
          },
          disabled: issues.length === 0,
        },
      ]}
    >
      <View className="gap-2">
        {issues.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            {t('editor.noIssues')}
          </Text>
        ) : (
          issues.map((issue, index) => (
            <Text
              key={`${issue.code}-${index}`}
              className={
                issue.severity === 'error'
                  ? 'text-destructive text-sm'
                  : 'text-foreground text-sm'
              }
            >
              {issue.message}
            </Text>
          ))
        )}
      </View>
    </FormModal>
  );
}
