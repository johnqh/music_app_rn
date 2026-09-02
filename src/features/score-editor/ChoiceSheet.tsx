/**
 * A question with two answers and a way out.
 *
 * Cut and paste each have one — "leave silence or close the gap", "replace or
 * insert" — and neither is a yes/no, so a confirm dialog cannot ask it. The web
 * app has the same component for the same reason; this is its native half, and
 * the copy is the same locale key on both so the two cannot drift.
 *
 * Every answer carries a *detail* line saying what it does to the score, since
 * the labels alone ("Insert", "Replace") describe the button rather than the
 * consequence.
 */
import { View } from 'react-native';
import { FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';

export type Choice<T extends string> = {
  value: T;
  label: string;
  detail: string;
  /** The answer offered first, and the one a hurried reader will take. */
  primary?: boolean;
  /**
   * Offered but not available.
   *
   * Shown rather than hidden, so the set of answers does not change shape
   * between visits — a reader who has seen "Generate Track" once should find
   * it in the same place, greyed, rather than wonder where it went. The
   * `detail` line is what says why.
   */
  disabled?: boolean;
};

export function ChoiceSheet<T extends string>({
  open,
  title,
  message,
  choices,
  onChoose,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  choices: readonly Choice<T>[];
  onChoose: (value: T) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FormModal
      visible={open}
      title={title}
      onClose={onCancel}
      /*
        `actions`, not the `onSave` shorthand: that renders one full-width CTA
        and this has two answers, neither of which is "save".
      */
      actions={[
        {
          label: t('common.cancel'),
          onPress: onCancel,
          variant: 'ghost' as const,
        },
        ...choices.map(c => ({
          label: c.label,
          onPress: () => onChoose(c.value),
          variant: c.primary ? ('primary' as const) : ('secondary' as const),
          ...(c.disabled ? { disabled: true } : {}),
        })),
      ]}
      // The × in the top bar is named "Cancel" by default, and two controls
      // with one accessible name are ambiguous read aloud.
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-3 p-1">
        <Text className="text-foreground text-base">{message}</Text>
        {choices.map(c => (
          <View
            key={c.value}
            className="gap-0.5"
            style={c.disabled ? { opacity: 0.5 } : undefined}
          >
            <Text className="text-foreground text-base font-medium">
              {c.label}
            </Text>
            <Text className="text-muted-foreground text-sm">{c.detail}</Text>
          </View>
        ))}
      </View>
    </FormModal>
  );
}
