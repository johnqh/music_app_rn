/**
 * A text field with the button that acts on it, on one line and one height.
 *
 * The two come from the library at different heights — a field of 33 points
 * beside a button of 44 — and side by side that reads as two controls that
 * happen to be neighbours rather than one form. Both are drawn at
 * `MIN_TOUCH_TARGET` here: the taller of the two, and the least either
 * platform asks a control to be.
 *
 * The heights are stated as a style, not left to a class: `className` merges
 * with the library's own, and which of two heights wins a merge is not
 * something a caller can see from here.
 */
import { Platform, View } from 'react-native';
import { Button, Input, MIN_TOUCH_TARGET } from '@sudobility/components-rn';
import type { ComponentProps, ReactNode } from 'react';

export type FieldRowProps = {
  /** The field's accessible name, and its placeholder unless one is given. */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** The button's words, and its accessible name. */
  action: string;
  onAction: () => void;
  /** The button is drawn but refuses: nothing to act on, or already acting. */
  actionDisabled?: boolean;
  /** The button's work is under way: it spins and refuses a second press. */
  actionLoading?: boolean;
  /** Passed to the field: keyboard, capitalisation, length. */
  input?: Omit<
    ComponentProps<typeof Input>,
    'value' | 'onChangeText' | 'placeholder' | 'accessibilityLabel'
  >;
};

export function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  action,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  input,
}: FieldRowProps) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1" style={{ height: MIN_TOUCH_TARGET }}>
        <Input
          {...input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          accessibilityLabel={label}
          className="border-border h-full rounded-md border py-0"
        />
      </View>
      <View style={{ height: MIN_TOUCH_TARGET }}>
        <Button
          onPress={onAction}
          disabled={actionDisabled}
          loading={actionLoading}
          accessibilityLabel={action}
          className="h-full"
        >
          {action}
        </Button>
      </View>
    </View>
  );
}

/**
 * What a field or a button is given to fill it, inside a `FieldSlot`.
 *
 * `py-0` because the library's field pads itself vertically and a stated
 * height plus that padding leaves the text no room on Android.
 */
export const SLOT_FIELD_CLASS = 'h-full py-0';
export const SLOT_BUTTON_CLASS = 'h-full';
/**
 * What a `Select` in such a row is given. Not `h-full`: the library wraps its
 * trigger in a view of its own, so there is no stated height for the trigger
 * to fill. Its minimum height is a class a caller can replace, and this
 * replaces it with `MIN_TOUCH_TARGET` — which is 48 on Android and 44
 * elsewhere, so there are two, each written whole: a class assembled from
 * the constant is one Tailwind never sees. `field-row.test.ts` holds them to
 * the constant.
 */
export const SLOT_SELECT_CLASS =
  Platform.OS === 'android' ? 'min-h-[48px]' : 'min-h-[44px]';

/**
 * One control of a row that `FieldRow` cannot draw — a draft committed on
 * blur, several buttons after one field — at the same stated height.
 *
 * The child is handed `SLOT_FIELD_CLASS` or `SLOT_BUTTON_CLASS` by the
 * caller; this states the height they fill.
 */
export function FieldSlot({
  grow = false,
  children,
}: {
  /** Takes the row's remaining width: the field, rather than its action. */
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      className={grow ? 'flex-1' : 'flex-none'}
      style={{ height: MIN_TOUCH_TARGET }}
    >
      {children}
    </View>
  );
}
