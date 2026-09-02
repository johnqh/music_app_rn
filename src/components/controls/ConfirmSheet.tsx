/**
 * A yes/no question about something that cannot be undone by looking away.
 *
 * The web app's `ConfirmDialog`, which uses `actions` rather than `FormModal`'s
 * `onSave` shorthand for one reason: the shorthand renders a single full-width
 * CTA and **cannot be destructive**, and the whole point of this component is
 * that its confirm button is usually the dangerous one.
 *
 * `closeAriaLabel` is not optional here. The top-bar × is named "Cancel" by
 * default, this footer already has a Cancel, and two controls with one
 * accessible name are ambiguous read aloud and a strict-mode failure in tests.
 */
import { View } from 'react-native';
import { FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';

export type ConfirmSheetProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Paints the confirm button as the dangerous answer. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { t } = useTranslation();
  return (
    <FormModal
      visible={open}
      title={title}
      onClose={onCancel}
      actions={[
        { label: t('common.cancel'), onPress: onCancel, variant: 'ghost' },
        {
          label: confirmLabel,
          onPress: onConfirm,
          variant: destructive ? 'destructive' : 'primary',
        },
      ]}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="p-1">
        <Text className="text-foreground text-base">{message}</Text>
      </View>
    </FormModal>
  );
}
