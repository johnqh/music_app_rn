/**
 * Long-press on the score — the native half of the web's right-click menu.
 *
 * Nothing here is unreachable without it: every entry is also a toolbar
 * control. But pressing and holding a note is where people look for cut, copy
 * and delete, and finding nothing there reads as an unfinished editor — which
 * is exactly the reasoning behind the web's context menu.
 *
 * A sheet rather than a menu positioned at the touch, because a popover anchored
 * to a finger is under the finger: on a phone the thing you pressed is hidden
 * by the menu about it. The sheet leaves the score visible above it.
 *
 * **Entries follow the selection, and an action that would do nothing is
 * disabled rather than hidden** — so the list keeps the same shape and reading
 * order every time it opens, and nobody has to hunt for an entry that moved.
 */
import { View } from 'react-native';
import { Button, FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';

export type ScoreAction = 'copy' | 'cut' | 'paste' | 'delete' | 'selectAll';

export type ScoreActionsSheetProps = {
  open: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  /** False while the transport plays: content is immutable then. */
  canEdit: boolean;
  onAction: (action: ScoreAction) => void;
  onClose: () => void;
};

export function ScoreActionsSheet({
  open,
  hasSelection,
  hasClipboard,
  canEdit,
  onAction,
  onClose,
}: ScoreActionsSheetProps) {
  const { t } = useTranslation();

  const items: Array<{ action: ScoreAction; label: string; enabled: boolean }> =
    [
      // Copy only reads, so it survives playback — the same exemption the
      // toolbar makes.
      { action: 'copy', label: t('editor.copy'), enabled: hasSelection },
      {
        action: 'cut',
        label: t('editor.cut'),
        enabled: canEdit && hasSelection,
      },
      {
        action: 'paste',
        label: t('editor.paste'),
        enabled: canEdit && hasClipboard,
      },
      {
        action: 'delete',
        label: t('editor.deleteSelection'),
        enabled: canEdit && hasSelection,
      },
      { action: 'selectAll', label: t('editor.selectAllNotes'), enabled: true },
    ];

  return (
    <FormModal
      visible={open}
      title={t('editor.scoreActions')}
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
        {items.map(item => (
          <Button
            key={item.action}
            variant="secondary"
            disabled={!item.enabled}
            onPress={() => {
              onClose();
              onAction(item.action);
            }}
            accessibilityLabel={item.label}
          >
            {item.label}
          </Button>
        ))}
        <Text className="text-muted-foreground text-xs">
          {t('editor.scoreActionsHint')}
        </Text>
      </View>
    </FormModal>
  );
}
