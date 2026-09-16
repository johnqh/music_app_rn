/**
 * Long-press on the score — the native half of the web's right-click menu.
 *
 * **This is now the only place cut, copy, paste and delete live**, on both
 * platforms. They were also toolbar controls, which meant four buttons on a bar
 * that is already the widest thing in the editor, for actions that only apply to
 * something already selected and that could say nothing about *what* they would
 * act on. A menu opened on the thing itself can: it names the object before it
 * offers to change it.
 *
 * That header is the point. "Track" / "Bars" / "Notes" in small grey type above
 * the entries, because Delete means three different edits depending on what is
 * selected, and a list of verbs with no subject is one you have to try to
 * understand.
 *
 * A sheet rather than a menu positioned at the touch, because a popover anchored
 * to a finger is under the finger: on a phone the thing you pressed is hidden
 * by the menu about it. The sheet leaves the score visible above it.
 *
 * **Entries follow the selection, and an action that would do nothing is
 * disabled rather than hidden** — so the list keeps the same shape and reading
 * order every time it opens, and nobody has to hunt for an entry that moved.
 * Those rules are music_editing's `scoreContextMenuModel`, which the web's
 * right-click menu draws too; this sheet only draws it.
 */
import { View } from 'react-native';
import { Button, FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';
import type {
  ScoreContextAction,
  ScoreContextMenuModel,
} from '@sudobility/music_types';

export type ScoreActionsSheetProps = {
  open: boolean;
  /**
   * What to show: `scoreContextMenuModel` over the selection as it is now.
   *
   * The entries, their order, which are live and the subject header used to be
   * written out here and again in the web's `ScoreContextMenu`. Both counted a
   * bar selected across four tracks as "4 bars", because a count of measure ids
   * is not a count of bars; the model counts bars once, for both.
   */
  model: ScoreContextMenuModel;
  onAction: (action: ScoreContextAction) => void;
  onClose: () => void;
};

export function ScoreActionsSheet({
  open,
  model,
  onAction,
  onClose,
}: ScoreActionsSheetProps) {
  const { t } = useTranslation();
  const { subject, entries } = model;

  return (
    <FormModal
      visible={open}
      title={t(model.titleKey)}
      onClose={onClose}
      /*
        No bottom bar: every row acts, so a Save would be a second way to do
        what tapping already did, and a Cancel would duplicate the × the shell
        carries.
      */
      actions={[]}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-2 p-1">
        {/*
          The subject, before the verbs — it says what the list is about, which
          is exactly what "Delete" cannot say on its own when it means three
          different edits. Clear and Delete are separate entries because they
          are different edits: Clear keeps the container and empties it, Delete
          removes it and everything behind moves up.
        */}
        {subject === null ? null : (
          <Text className="text-muted-foreground text-sm font-medium">
            {t(subject.key, { count: subject.count })}
          </Text>
        )}
        {entries.map(entry => (
          <Button
            key={entry.action}
            variant="secondary"
            disabled={!entry.enabled}
            onPress={() => {
              onClose();
              onAction(entry.action);
            }}
            accessibilityLabel={t(entry.labelKey)}
          >
            {t(entry.labelKey)}
          </Button>
        ))}
        <Text className="text-muted-foreground text-sm">
          {t('editor.scoreActionsHint')}
        </Text>
      </View>
    </FormModal>
  );
}
