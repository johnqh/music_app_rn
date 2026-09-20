import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Input, Switch, Text } from '@sudobility/components-rn';
import type { InsertBarsPosition } from '@sudobility/music_editing';

export type InsertBarsSheetResult = {
  count: number;
  position: InsertBarsPosition;
  generate: boolean;
};

export function InsertBarsSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (result: InsertBarsSheetResult) => void;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState('4');
  const [position, setPosition] = useState<InsertBarsPosition>('after');
  const [generate, setGenerate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCount('4');
    setPosition('after');
    setGenerate(false);
  }, [open]);

  const submit = (): void => {
    const parsed = Number(count);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) return;
    onSubmit({ count: parsed, position, generate });
  };

  return (
    <FormModal
      visible={open}
      onClose={onClose}
      title={t('editor.insertBarsTitle')}
      onSave={submit}
      saveLabel={t('editor.insertBars')}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="gap-4">
        <View className="gap-1">
          <Text className="text-muted-foreground text-sm">
            {t('editor.barCount')}
          </Text>
          <Input
            value={count}
            autoFocus
            keyboardType="number-pad"
            accessibilityLabel={t('editor.barCount')}
            onChangeText={setCount}
          />
        </View>

        <View className="gap-2">
          <Text className="text-muted-foreground text-sm">
            {t('editor.insertBarsPosition')}
          </Text>
          {(['before', 'after'] as const).map(option => (
            <Pressable
              key={option}
              className="flex-row items-center gap-2"
              hitSlop={10}
              accessibilityRole="radio"
              accessibilityState={{ selected: position === option }}
              onPress={() => setPosition(option)}
            >
              <View
                className={
                  position === option
                    ? 'border-primary h-4 w-4 rounded-full border-4'
                    : 'border-muted-foreground h-4 w-4 rounded-full border'
                }
              />
              <Text className="text-foreground">
                {t(
                  option === 'before'
                    ? 'editor.insertBarsBefore'
                    : 'editor.insertBarsAfter',
                )}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center gap-3">
          <Switch
            checked={generate}
            onCheckedChange={setGenerate}
            accessibilityLabel={t('editor.generateInsertedBars')}
          />
          <View className="flex-1">
            <Text className="text-foreground text-base">
              {t('editor.generateInsertedBars')}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {t('editor.generateInsertedBarsHint')}
            </Text>
          </View>
        </View>
      </View>
    </FormModal>
  );
}
