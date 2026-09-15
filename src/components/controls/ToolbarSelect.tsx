/**
 * A toolbar control that offers several mutually exclusive answers.
 *
 * The web bar's `Select`: a compact trigger drawing one glyph, and a menu that
 * spells the choices out in words. That shape is the whole reason the web bar
 * fits — five accidentals as five near-identical 18px glyphs were a quarter of
 * its width for an edit nobody makes constantly, and six note values were
 * another sixth. Native had them all as chips, which is why its bar was three
 * screens wide.
 *
 * Neither `Select`, `PopupSelect` nor `SheetSelector` from
 * `@sudobility/components-rn` can be used here: each draws its own bordered
 * text trigger and none accepts one. So the trigger is this app's `IconButton`
 * — the same control every other button on the bar is — and only the sheet is
 * new.
 *
 * A picker that **applies** rather than reflects passes no `value` (the web
 * does the same: its articulation `Select` holds nothing, it acts). One that
 * reflects passes the armed value and gets a tick beside it.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { FormModal, MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';
import { NotationIcon } from '@/components/icons/NotationIcon';
import type { NotationIconName } from '@sudobility/music_types';
import { IconButton } from '@/components/layout/IconButton';
import { useNotationInk } from '@/components/icons/notation-ink';

export type ToolbarOption = {
  value: string;
  label: string;
  /** Drawn beside the words, where the choice has a glyph of its own. */
  icon?: NotationIconName;
  disabled?: boolean;
};

export type ToolbarSelectProps = {
  /** The control's name — "Note duration", not "pick a length". */
  label: string;
  hint?: string;
  options: readonly ToolbarOption[];
  /** Omitted by a picker that applies rather than holds a value. */
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Drawn on the trigger. */
  children: ReactNode;
};

export function ToolbarSelect({
  label,
  hint,
  options,
  value,
  onChange,
  disabled = false,
  children,
}: ToolbarSelectProps) {
  const { t } = useTranslation();
  const ink = useNotationInk();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        label={label}
        {...(hint ? { hint } : {})}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        {children}
      </IconButton>
      <FormModal
        visible={open}
        title={label}
        onClose={() => setOpen(false)}
        /*
          No bottom bar: every row commits, so a Save would be a second way to
          do what tapping already did, and a Cancel would duplicate the × the
          shell already carries.
        */
        actions={[]}
        closeAriaLabel={t('common.closeDialog')}
      >
        <>
          {options.map(option => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{
                disabled: option.disabled === true,
                selected: value !== undefined && option.value === value,
              }}
              disabled={option.disabled === true}
              onPress={() => {
                setOpen(false);
                onChange(option.value);
              }}
              className="border-border flex-row items-center gap-3 border-b px-1 py-3"
              style={[
                { minHeight: MIN_TOUCH_TARGET },
                option.disabled ? { opacity: 0.4 } : null,
              ]}
            >
              {option.icon ? (
                <NotationIcon name={option.icon} color={ink.foreground} />
              ) : null}
              <Text className="text-foreground flex-1 text-base">
                {option.label}
              </Text>
              {value !== undefined && option.value === value ? (
                <Text className="text-primary text-base">✓</Text>
              ) : null}
            </Pressable>
          ))}
          {/* A tail, so the last row is not flush against the sheet's edge. */}
          <View className="h-2" />
        </>
      </FormModal>
    </>
  );
}
