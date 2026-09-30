/**
 * The keyboard shortcuts, as a sheet over whatever asked for them — the web
 * app's shortcut help dialog.
 *
 * From the same list the web shows. `SHORTCUTS` moved into `music_editing`
 * for this: the list used to live in the web app beside its dialog and had
 * fallen six entries behind the bindings — fermata, arpeggiate, glissando,
 * octave bracket and both hairpins were bound, worked, and appeared in no
 * list. A second copy here would have started the same drift on day one.
 *
 * A sheet rather than a screen, because it is looked at and put away: it was
 * a section of Settings and a pushed screen, and either one took the reader
 * out of the score to read about the keys that work in the score.
 *
 * Shown on every platform, not just the desktops. A phone has no keyboard
 * until one is paired, and iPads are routinely used with one.
 *
 * The rows are drawn outright rather than by a `SectionList`: the sheet's
 * body already scrolls, and a list that virtualizes inside one measures
 * nothing and draws nothing.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormModal, Text } from '@sudobility/components-rn';
import { SHORTCUTS, shortcutGroupLabelKey } from '@sudobility/music_editing';
import { SHORTCUT_GROUPS } from '@sudobility/music_types';

/**
 * The shortcuts under their groups, in the declared order, with a group that
 * has no rows left out rather than printed as an empty heading.
 */
export function shortcutSections() {
  return SHORTCUT_GROUPS.map(group => ({
    group,
    /*
      `shortcutGroupLabelKey`, never a template here: this built
      `shortcuts.<group>`, which neither locale has, and so printed the key as
      every heading. The web docs page reads the same function.
    */
    titleKey: shortcutGroupLabelKey(group),
    rows: SHORTCUTS.filter(row => row.group === group),
  })).filter(section => section.rows.length > 0);
}

export function ShortcutsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FormModal
      visible={open}
      title={t('editor.keyboardShortcuts')}
      onClose={onClose}
      closeAriaLabel={t('common.closeDialog')}
      // No bottom bar: there is nothing to confirm, and a Close would
      // duplicate the × the shell carries.
      actions={[]}
    >
      <View className="gap-2 p-1">
        {shortcutSections().map(section => (
          <View key={section.group}>
            <Text className="text-muted-foreground pt-3 pb-1 text-sm font-semibold uppercase">
              {t(section.titleKey)}
            </Text>
            {section.rows.map((row, index) => (
              <View
                key={`${row.actionKey}-${index}`}
                className="border-border/50 flex-row items-center justify-between gap-3 border-b py-2"
              >
                <Text className="text-foreground flex-1 text-base">
                  {t(row.actionKey)}
                </Text>
                <Text className="text-muted-foreground text-base">
                  {/* Either literal keys, or a translated description of a
                      gesture that is not a chord — a drag, say. */}
                  {row.keys ?? (row.keysKey ? t(row.keysKey) : '')}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </FormModal>
  );
}
