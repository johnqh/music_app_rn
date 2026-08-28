/**
 * The cover over a score while the server is writing it.
 *
 * A generation is a job, not a request that resolves: `POST /jobs` returns as
 * soon as the row exists and the work happens afterwards. So there is nothing
 * to await and nothing to show a determinate progress bar for — what there is
 * is a project that cannot be edited (the server rejects writes with 409) and a
 * reader who needs to be told why.
 *
 * Cancel is offered because it is cheap and honest: cancelling writes `ready`,
 * and the running job discards its result when it next looks — including
 * between chunks of a long one.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Spinner, Text } from '@sudobility/components-rn';

export function GenerationOverlay({
  visible,
  error,
  onCancel,
}: {
  visible: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View className="bg-background/90 absolute inset-0 items-center justify-center gap-3 p-6">
      <Spinner />
      <Text className="text-foreground text-base">{t('generate.working')}</Text>
      <Text className="text-muted-foreground text-center text-xs">
        {t('generate.workingExplain')}
      </Text>
      {error ? (
        <Text className="text-destructive text-center text-sm">{error}</Text>
      ) : null}
      <Button variant="secondary" onPress={onCancel}>
        {t('common.cancel')}
      </Button>
    </View>
  );
}
