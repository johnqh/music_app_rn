/**
 * Jump the caret to a bar by number.
 *
 * A long score has no other way to get somewhere specific: the caret is placed
 * by tapping, so reaching bar 180 means scrolling until you find it by eye.
 * Everything the editor aims — insertion, "play from here", a range selection
 * anchor — starts at the caret, so being unable to put it somewhere by name
 * makes all of them slower on exactly the scores where it matters most. It
 * matters more here than on the web, where a scroll wheel covers ground faster
 * than a finger does.
 *
 * Bars are numbered from 1, matching the numbers drawn in the gutter and the
 * status strip's readout — not the zero-based index the score stores.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Input, Text } from '@sudobility/components-rn';

export type GoToBarSheetProps = {
  open: boolean;
  /** How many bars there are, so the prompt can say the range. */
  barCount: number;
  onClose: () => void;
  /** Returns false when the bar does not exist, which keeps the sheet open. */
  onGo: (bar: number) => boolean;
};

export function GoToBarSheet({
  open,
  barCount,
  onClose,
  onGo,
}: GoToBarSheetProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(false);
    }
  }, [open]);

  const submit = (): void => {
    const bar = Number(value);
    if (!Number.isFinite(bar) || !onGo(Math.round(bar))) {
      setError(true);
      return;
    }
    onClose();
  };

  return (
    <FormModal
      visible={open}
      onClose={onClose}
      title={t('editor.goToBar')}
      onSave={submit}
      saveLabel={t('editor.go')}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-1">
        <Text className="text-muted-foreground text-xs">
          {t('editor.barNumberOf', { count: barCount })}
        </Text>
        <Input
          value={value}
          autoFocus
          /*
            A number pad rather than the full keyboard: there is nothing but
            digits to type here, and on a phone the wrong keyboard is the
            difference between one tap and three.
          */
          keyboardType="number-pad"
          returnKeyType="go"
          accessibilityLabel={t('editor.barNumber')}
          onChangeText={next => {
            setValue(next);
            setError(false);
          }}
          onSubmitEditing={submit}
        />
        {/* Says what is wrong and what would be right, rather than just refusing. */}
        {error ? (
          <Text className="text-destructive text-xs">
            {t('editor.noSuchBar', { count: barCount })}
          </Text>
        ) : null}
      </View>
    </FormModal>
  );
}
