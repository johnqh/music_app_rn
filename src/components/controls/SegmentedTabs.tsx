/**
 * A one-of-N picker across the top of a panel.
 *
 * On iOS and iPadOS this is a real `UISegmentedControl` — see
 * `SegmentedTabs.ios.tsx`. This file is what every other platform resolves,
 * and it is deliberately *not* the same package's JS fallback: that fallback
 * draws an iOS segmented control on Android, which is the wrong idiom in the
 * one place it would be seen. Android's own control for a small set of panel
 * sections is a tab row, and macOS's is close enough to it that a second
 * drawing would be worse than a shared one. So both get `Tabs`, which is what
 * this panel already used.
 *
 * The two files export one component with one signature; a caller never learns
 * which it got.
 */
import { Tabs, TabsList, TabsTrigger, Text } from '@sudobility/components-rn';

export type SegmentedOption = {
  value: string;
  label: string;
};

export type SegmentedTabsProps = {
  /** The accessible name of the group — what these sections belong to. */
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  /**
   * Names the control for a test.
   *
   * The two variants render entirely different things — a native view whose
   * labels are a `values` prop, and a row of pressable `Text` — so a test that
   * queries by label text passes on one and cannot even find the other. A
   * shared handle is what lets the panel's own test drive whichever it got.
   */
  testID?: string;
};

export function SegmentedTabs({
  label,
  options,
  value,
  onChange,
  testID,
}: SegmentedTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={onChange}
      accessibilityLabel={label}
      {...(testID ? { testID } : {})}
    >
      <TabsList>
        {options.map(option => (
          /*
            `px-2`, not the trigger's default `px-4`. Four labels — Track, Note,
            Measure, Score — plus 16px of padding each side come to ~313px, and
            the inspector column is 320px with a scrollbar's worth of chrome.
            `TabsList` is a horizontal ScrollView so nothing was unreachable,
            but at `px-4` "Score" sat half-cut at the panel edge, which reads as
            broken rather than as scrollable.
          */
          <TabsTrigger key={option.value} value={option.value} className="px-2">
            <Text
              className={
                value === option.value
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {option.label}
            </Text>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
