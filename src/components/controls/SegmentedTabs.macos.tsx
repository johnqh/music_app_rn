/**
 * A one-of-N picker across the top of a panel — macOS.
 *
 * A segmented control, like iOS, rather than the tab row Android gets. macOS
 * has `NSSegmentedControl` and this is the same shape of thing, so a Mac window
 * showing a web-style tab strip looked out of place beside its own toolbars.
 *
 * **Drawn, not `NSSegmentedControl`**, and that is a limitation rather than a
 * choice: `@react-native-segmented-control/segmented-control` declares
 * `:ios, :visionos` in its podspec and its native view is `UISegmentedControl`,
 * which is UIKit and does not exist on macOS. What it also ships is a pure-JS
 * implementation for every other platform — the file this imports — which needs
 * no native module and is why this works at all. A real `NSSegmentedControl`
 * means writing an AppKit component here; nothing on npm offers one, which is
 * checked rather than assumed.
 *
 * `SegmentedTabs.ios.tsx` is the genuinely native one; `SegmentedTabs.tsx` is
 * Android's tab row. All three export one component with one signature.
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
      `px-1`, matching iOS: a segmented control divides its width equally and
      elides a label that does not fit, and the inspector's four — Track, Note,
      Measure, Score — are only just inside the panel's width.
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
