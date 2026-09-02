/**
 * What a reader sees when a job is refused for want of credits.
 *
 * `POST /jobs` answers 402 when the balance is at or below zero, and that used
 * to arrive here as a string in the generation overlay — reading like a network
 * failure, which it is not. It is the one API refusal with an obvious remedy,
 * so it opens a way to the store rather than reporting a problem.
 *
 * **It is not the web's dialog, and cannot be.** The web mounts
 * `CreditPaywallDialog` from `@sudobility/consumables_pages`, which has no
 * React Native port — so purchasing is not offered here rather than
 * half-offered, exactly as the Credits screen already decides. What this does
 * offer is the honest half: why the job was refused, and the way to the Credits
 * screen. When `consumables_pages` gains an RN build this becomes its adapter.
 *
 * It deliberately does not retry the refused job. The job was discarded
 * server-side and the project it would have filled was deleted with it, so
 * re-submitting after a purchase would spend credits on something the reader
 * may no longer want.
 */
import { View } from 'react-native';
import { FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';

export type CreditPaywallSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Takes the reader to the Credits screen. Omitted where there is none. */
  onOpenCredits?: () => void;
};

export function CreditPaywallSheet({
  open,
  onClose,
  onOpenCredits,
}: CreditPaywallSheetProps) {
  const { t } = useTranslation();
  return (
    <FormModal
      visible={open}
      title={t('credits.outOfCreditsTitle')}
      onClose={onClose}
      actions={[
        {
          label: t('common.cancel'),
          onPress: onClose,
          variant: 'ghost' as const,
        },
        ...(onOpenCredits
          ? [
              {
                label: t('credits.viewCredits'),
                onPress: () => {
                  onClose();
                  onOpenCredits();
                },
                variant: 'primary' as const,
              },
            ]
          : []),
      ]}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-2 p-1">
        <Text className="text-foreground text-base">
          {t('credits.outOfCreditsBody')}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {t('credits.rate')}
        </Text>
      </View>
    </FormModal>
  );
}
