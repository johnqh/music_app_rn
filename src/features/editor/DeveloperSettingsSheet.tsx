/**
 * The six developer toggles.
 *
 * Every one is a `devSettings` field the editing store already keeps, so this
 * reflects and invokes and decides nothing. What it deliberately leaves out is
 * the web dialog's other half — the stress-test score, the benchmark and
 * "reset the database" — because those act on a *browser* database this app
 * does not have, and a control that could only fail is worse than one that is
 * absent.
 *
 * Reached from Settings rather than from the editor's toolbar: these change how
 * the app is *inspected*, not what the score is, and putting them beside the
 * editing tools invites a reader to try one mid-phrase.
 */
import { useStore } from 'zustand';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Switch, Text } from '@sudobility/components-rn';
import type { DevSettings } from '@sudobility/music_editing';
import type { MusicDocument } from '@/documents/document';

/**
 * The toggles, in the order the web dialog lists them.
 *
 * A `Record`-shaped list keyed by the setting rather than a parallel array:
 * adding a field to `DevSettings` fails to compile here until it is labelled,
 * where an array would silently go on offering the old six.
 *
 * Keyed by the BOOLEAN settings specifically, which is what a Switch can show.
 * It was `keyof DevSettings`, and that accepts any key at all — so when
 * `generationVariant` (a string) was added upstream the failure surfaced deep
 * in the JSX as "Type 'string | boolean' is not assignable to 'boolean'",
 * rather than here where the list is declared. A setting that is not a toggle
 * now cannot be added to a list of toggles.
 */
type BooleanSettingKey = {
  [K in keyof DevSettings]: DevSettings[K] extends boolean ? K : never;
}[keyof DevSettings];

const TOGGLES: readonly { key: BooleanSettingKey; labelKey: string }[] = [
  { key: 'showIds', labelKey: 'devSettings.showScoreIds' },
  { key: 'showTicks', labelKey: 'devSettings.showTicks' },
  {
    key: 'showMeasureBoundaries',
    labelKey: 'devSettings.showMeasureBoundaries',
  },
  { key: 'showPlaybackScheduling', labelKey: 'devSettings.showScheduling' },
  { key: 'enableDiagnostics', labelKey: 'devSettings.generationDiagnostics' },
  {
    key: 'enableValidationWarnings',
    labelKey: 'devSettings.validationWarnings',
  },
];

export function DeveloperSettingsSheet({
  open,
  document,
  onClose,
}: {
  open: boolean;
  document: MusicDocument;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const settings = useStore(document.store, s => s.devSettings);

  return (
    <FormModal
      visible={open}
      title={t('devSettings.title')}
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      // No bottom bar: every setting applies as it is switched, so a Save
      // button would be a button that does nothing.
      actions={[]}
    >
      <View className="gap-2">
        {TOGGLES.map(({ key, labelKey }) => (
          <View
            key={key}
            className="flex-row items-center justify-between py-1"
          >
            <Text className="text-foreground flex-1 text-base">
              {t(labelKey)}
            </Text>
            <Switch
              checked={settings[key]}
              onCheckedChange={checked =>
                document.store.getState().setDevSettings({ [key]: checked })
              }
              accessibilityLabel={t(labelKey)}
            />
          </View>
        ))}
      </View>
    </FormModal>
  );
}
