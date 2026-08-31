/**
 * What the app reads and writes, from the one declaration of it.
 *
 * `IMPORT_FORMATS` and `EXPORT_FORMATS` are `@sudobility/music_editing`'s and
 * shared with the web page: a paragraph naming the formats would be a copy of
 * that list, and would stop being true the first time one was added. The docs
 * topic that carries `widget: 'formats'` rendered nothing at all here, so the
 * native reader got a heading with no table under it.
 *
 * Rows rather than a table: two columns of a `<table>` do not survive a phone,
 * and what a reader needs is the extensions and what survives the trip — which
 * reads better stacked than side by side.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@sudobility/components-rn';
import { EXPORT_FORMATS, IMPORT_FORMATS } from '@sudobility/music_editing';
import type { FormatEntry } from '@sudobility/music_editing';

function FormatList({
  titleKey,
  entries,
}: {
  titleKey: string;
  entries: readonly FormatEntry[];
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Text className="text-foreground text-sm font-semibold">
        {t(titleKey)}
      </Text>
      {entries.map(entry => (
        <View key={entry.id} className="border-border gap-0.5 border-b pb-2">
          <Text className="text-foreground text-sm font-medium">
            {t(`docs.formats.name.${entry.id}`)}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {entry.extensions}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {t(entry.noteKey)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function FormatReference() {
  return (
    <View className="gap-4 pt-2">
      <FormatList
        titleKey="docs.formats.importsHeading"
        entries={IMPORT_FORMATS}
      />
      <FormatList
        titleKey="docs.formats.exportsHeading"
        entries={EXPORT_FORMATS}
      />
    </View>
  );
}
