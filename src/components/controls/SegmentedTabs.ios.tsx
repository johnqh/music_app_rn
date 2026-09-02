/**
 * A one-of-N picker across the top of a panel — the real `UISegmentedControl`.
 *
 * This is the control iOS uses for exactly this job, and a user recognises it
 * without being told: the sliding selected segment, the press-and-hold drag
 * between segments, the automatic equal-width division of whatever space it is
 * given, the VoiceOver phrasing ("Track, tab, 1 of 4"). None of that comes out
 * of a row of `Pressable`s, and the tab row it replaces here read as a web
 * page's tab strip rather than as part of an iPad app.
 *
 * `SegmentedTabs.tsx` is the fallback every other platform resolves — the
 * package's own non-iOS build is a JS *drawing* of this control, which would
 * put an iOS segmented control on Android, so it is deliberately not used.
 *
 * The tint is literal, from `useNotationInk`, for the reason the notation
 * glyphs' colours are: this is a native view, so a NativeWind class never
 * reaches it.
 */
import NativeSegmentedControl from '@react-native-segmented-control/segmented-control';
import { View } from 'react-native';
import { useNotationInk } from '@/components/icons/notation-ink';
import type { SegmentedTabsProps } from './SegmentedTabs';

export type { SegmentedOption, SegmentedTabsProps } from './SegmentedTabs';

export function SegmentedTabs({
  label,
  options,
  value,
  onChange,
  testID,
}: SegmentedTabsProps) {
  const ink = useNotationInk();
  const selected = options.findIndex(option => option.value === value);

  return (
    /*
      `px-1`, not `px-2`. A segmented control divides its width equally and
      elides a label that does not fit, and the inspector's four — Track, Note,
      Measure, Score — are only just inside the panel's width. This and the
      panel's own `w-80` (see `AppLayout`) are together what fits "Measure";
      at `px-2` in a `w-72` panel it rendered as "Meas…".
    */
    <View className="px-1 py-2" accessibilityLabel={label}>
      <NativeSegmentedControl
        {...(testID ? { testID } : {})}
        values={options.map(option => option.label)}
        selectedIndex={selected < 0 ? 0 : selected}
        onChange={event => {
          const next = options[event.nativeEvent.selectedSegmentIndex];
          if (next) onChange(next.value);
        }}
        tintColor={ink.primary}
        fontStyle={{ color: ink.foreground }}
        activeFontStyle={{ color: ink.onPrimary }}
      />
    </View>
  );
}
