/**
 * The keyboard shortcuts, from the same list the web help dialog shows.
 *
 * `SHORTCUTS` moved into `music_editing` for this: the list used to live in the
 * web app beside the dialog and had fallen six entries behind the bindings —
 * fermata, arpeggiate, glissando, octave bracket and both hairpins were bound,
 * worked, and appeared in no list. A second copy here would have started the
 * same drift on day one.
 *
 * Shown on every platform, not just the desktops. A phone has no keyboard until
 * one is paired, and iPads are routinely used with one.
 */
import { SectionList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  shortcutGroupLabelKey,
} from '@sudobility/music_editing';
import type { ShortcutRow } from '@sudobility/music_editing';

export function ShortcutsScreen() {
  const { t } = useTranslation();

  const sections = SHORTCUT_GROUPS.map(group => ({
    /*
      `shortcutGroupLabelKey`, never a template here: this built
      `shortcuts.<group>`, which neither locale has, and so printed the key as
      every heading. The web docs page reads the same function.
    */
    title: t(shortcutGroupLabelKey(group)),
    data: SHORTCUTS.filter(row => row.group === group),
  })).filter(section => section.data.length > 0);

  return (
    <SectionList<ShortcutRow, { title: string }>
      className="bg-background flex-1"
      contentContainerClassName="p-4"
      sections={sections}
      keyExtractor={(row: ShortcutRow, index: number) =>
        `${row.actionKey}-${index}`
      }
      renderSectionHeader={({ section }: { section: { title: string } }) => (
        <Text className="text-muted-foreground bg-background pt-4 pb-1 text-sm font-semibold uppercase">
          {section.title}
        </Text>
      )}
      renderItem={({ item }: { item: ShortcutRow }) => (
        <View className="border-border/50 flex-row items-center justify-between border-b py-2">
          <Text className="text-foreground flex-1 text-base">
            {t(item.actionKey)}
          </Text>
          <Text className="text-muted-foreground text-base">
            {/* Either literal keys, or a translated description of a gesture
                that is not a chord — a drag, say. */}
            {item.keys ?? (item.keysKey ? t(item.keysKey) : '')}
          </Text>
        </View>
      )}
    />
  );
}
