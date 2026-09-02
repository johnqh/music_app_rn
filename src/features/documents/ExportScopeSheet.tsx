/**
 * Asks whether an export should carry the hidden tracks.
 *
 * Only shown when some are hidden. A file that quietly omits parts is hard to
 * notice until it matters, and silently exporting everything would equally
 * surprise somebody who hid tracks precisely to extract a subset — so the
 * question is asked exactly when the two answers differ, and never otherwise.
 *
 * The web has asked since it grew track visibility; native exported the whole
 * score regardless, so hiding the other three parts and exporting gave you all
 * four with nothing said.
 */
import { View } from 'react-native';
import { FormModal, Text } from '@sudobility/components-rn';
import { useTranslation } from 'react-i18next';

export type ExportScope = 'all' | 'visible';

export type ExportScopeSheetProps = {
  open: boolean;
  /** How many tracks would be left out. Never 0 while open — see the doc. */
  hiddenCount: number;
  onChoose: (scope: ExportScope) => void;
  onCancel: () => void;
};

export function ExportScopeSheet({
  open,
  hiddenCount,
  onChoose,
  onCancel,
}: ExportScopeSheetProps) {
  const { t } = useTranslation();
  return (
    <FormModal
      visible={open}
      title={t('exportScope.title')}
      onClose={onCancel}
      actions={[
        { label: t('common.cancel'), onPress: onCancel, variant: 'ghost' },
        {
          label: t('exportScope.visibleOnly'),
          onPress: () => onChoose('visible'),
          variant: 'secondary',
        },
        {
          label: t('print.wholeScore'),
          onPress: () => onChoose('all'),
          variant: 'primary',
        },
      ]}
      closeAriaLabel={t('common.closeDialog')}
    >
      <View className="p-1">
        <Text className="text-foreground text-base">
          {t('exportScope.hiddenCount', { count: hiddenCount })}
        </Text>
      </View>
    </FormModal>
  );
}
