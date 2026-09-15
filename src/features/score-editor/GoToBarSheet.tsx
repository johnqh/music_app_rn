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
 * Bars are numbered as the gutter draws them — from 1, with a pickup having no
 * number at all — which is not the zero-based index the score stores. That
 * rule is music_editing's `goToBarFromInput`, so the sheet hands over the text
 * as typed rather than parsing it: it used to turn the text into a number and
 * hand that to `caretToBar`, which counted `index + 1` and so landed one bar
 * early on every score with an anacrusis.
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
  /**
   * Goes to the bar the text names — `goToBarFromInput`. Returns false for
   * blank text, a non-number or a bar that does not exist, which keeps the
   * sheet open.
   */
  onGo: (text: string) => boolean;
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
    if (!onGo(value)) {
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
        <Text className="text-muted-foreground text-sm">
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
          <Text className="text-destructive text-sm">
            {t('editor.noSuchBar', { count: barCount })}
          </Text>
        ) : null}
      </View>
    </FormModal>
  );
}
