/**
 * The instrument table, read from the catalogue.
 *
 * Built from `INSTRUMENT_OPTIONS` rather than described in prose, for the
 * reason the web app's is: prose about a table is a copy of that table, and the
 * copy goes stale the first time an instrument's range is corrected.
 */
import { View } from 'react-native';
import { Text } from '@sudobility/components-rn';
import { INSTRUMENT_OPTIONS } from '@sudobility/music_types';

export function InstrumentReference() {
  return (
    <View className="gap-1 pt-2">
      {INSTRUMENT_OPTIONS.map(option => (
        <View
          key={option.value}
          className="border-border/50 flex-row justify-between border-b py-1"
        >
          <Text className="text-foreground flex-1 text-sm">{option.label}</Text>
          <Text className="text-muted-foreground text-sm">{option.group}</Text>
        </View>
      ))}
    </View>
  );
}
