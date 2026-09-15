/**
 * The instrument table, read from the catalogue.
 *
 * The rows — the search filter and every formatted cell: range, notes at once,
 * transposition, and how far the compass can be trusted — are music_types'
 * `gmInstrumentRows`, the web reference's own call. This used to list
 * `INSTRUMENT_OPTIONS` as name and family only, so the native docs said the
 * table below "shows the compass and how far to trust it" over a table that
 * showed neither, and offered no search over 128 rows. The `basis` column is
 * the one worth reading: a compass somebody checked and one nobody checked look
 * identical everywhere else in the app.
 *
 * Laid out as two lines per program rather than seven columns, because a phone
 * has no room for the web's table; the cells and their order are the web's.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input, Text } from '@sudobility/components-rn';
import { gmInstrumentRows } from '@sudobility/music_types';

/*
  Complete class literals per basis: Tailwind extracts classes by scanning
  text, so a class assembled from parts is never generated.
*/
const BASIS_CLASS: Record<string, string> = {
  measured: 'text-success text-sm',
  tunable: 'text-warning text-sm',
  synthetic: 'text-muted-foreground text-sm',
  unpitched: 'text-muted-foreground text-sm',
  assumed: 'text-destructive text-sm',
};

export function InstrumentReference() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => gmInstrumentRows(query), [query]);

  return (
    <View className="gap-2 pt-2">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t('docs.instruments.search')}
        accessibilityLabel={t('docs.instruments.search')}
      />
      <Text className="text-muted-foreground text-sm">
        {t('docs.instruments.showing', { count: rows.length })}
      </Text>
      {rows.map(row => (
        <View
          key={row.program}
          className="border-border/50 gap-0.5 border-b py-1.5"
        >
          <View className="flex-row justify-between gap-2">
            <Text className="text-foreground flex-1 text-sm">
              {`${row.program}  ${row.name}`}
            </Text>
            <Text className={BASIS_CLASS[row.basis] ?? 'text-sm'}>
              {t(row.basisKey)}
            </Text>
          </View>
          <Text className="text-muted-foreground text-sm tabular-nums">
            {[
              row.familyLabel,
              `${t('docs.instruments.colRange')} ${row.range}`,
              `${t('docs.instruments.colPolyphony')} ${
                row.polyphony ?? t('docs.instruments.polyUnlimited')
              }`,
              `${t('docs.instruments.colTranspose')} ${row.transposition}`,
            ].join(' · ')}
          </Text>
        </View>
      ))}
    </View>
  );
}
