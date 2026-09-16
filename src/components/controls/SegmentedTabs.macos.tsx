/**
 * A one-of-N picker across the top of a panel — macOS.
 *
 * A segmented control, like iOS, rather than the tab row Android gets: macOS
 * has `NSSegmentedControl` and this is the same shape of thing, so a Mac window
 * showing a web-style tab strip looked out of place beside its own toolbars.
 *
 * **Drawn here, and no longer by `@react-native-segmented-control`.** That
 * package's native view is `UISegmentedControl`, which is UIKit and does not
 * exist on macOS; what it also ships is a pure-JS drawing of one for every
 * other platform, and that is what this used. The drawing moves its selected
 * segment with `Animated.timing({useNativeDriver: true})` — and a
 * native-driven animation never reaches a view on this react-native-macos
 * build (the same thing `PlaybackCursor.macos.tsx` measured, and why the
 * playhead is an `NSView` of its own). So the pill sat on whichever tab was
 * selected when the panel mounted and never moved, while `activeFontStyle` —
 * plain JS — followed the selection correctly and drew the *real* tab's label
 * white on the panel's white background. Selecting a note switched the panel
 * to Note, whose contents appeared, under a strip that still said Track and
 * had an invisible label where Note should be.
 *
 * A remount key on the control would move the pill and keep the dependency —
 * and would throw away the pressed segment's focus on every change, which is
 * exactly what a keyboard or VoiceOver user is holding. Drawing it here costs
 * about twenty lines, takes an animation this platform cannot run off the
 * critical panel entirely, and lets the segments carry an accessible
 * name at all — the JS drawing takes one from `Platform.select({android, ios})`,
 * which answers `undefined` on macOS, so every segment was an unnamed button.
 * There is no animation: a Mac segmented control does not slide either.
 *
 * `SegmentedTabs.ios.tsx` is the genuinely native one; `SegmentedTabs.tsx` is
 * Android's tab row. All three export one component with one signature.
 */
import { Pressable, View } from 'react-native';
import { MIN_TOUCH_TARGET, Text, touchSlop } from '@sudobility/components-rn';
import type { SegmentedTabsProps } from './SegmentedTabs';

export type { SegmentedOption, SegmentedTabsProps } from './SegmentedTabs';

/*
  Whole class strings, never a template with a hole in it: Tailwind extracts
  classes by scanning source text, so an interpolated variant never appears
  whole in the file and is silently never generated — the layout still works
  and the colours do not. `IconButton` states the same rule.
*/
const SEGMENT = 'flex-1 items-center justify-center rounded px-2 py-1';
const SEGMENT_SELECTED =
  'bg-primary flex-1 items-center justify-center rounded px-2 py-1';
const LABEL = 'text-muted-foreground text-sm';
const LABEL_SELECTED = 'text-primary-foreground text-sm font-medium';

/**
 * The drawn height of a segment: `text-sm`'s 20pt line in `py-1`.
 *
 * Short of the 44pt a touch target is asked to be, and it has to be — a
 * segmented control is a strip, not a row of buttons. `hitSlop` closes that
 * **vertically only**: the segments tile against each other, so widening them
 * sideways would make each steal its neighbour's presses, the reason the piano
 * keys take no slop either. Passing the minimum as the width is what asks
 * `touchSlop` for nothing on that axis.
 */
const SEGMENT_HEIGHT = 28;
const SLOP = touchSlop(MIN_TOUCH_TARGET, SEGMENT_HEIGHT);

export function SegmentedTabs({
  label,
  options,
  value,
  onChange,
  testID,
}: SegmentedTabsProps) {
  return (
    /*
      `px-1`, matching iOS: a segmented control divides its width equally and
      elides a label that does not fit, and the inspector's four — Track, Note,
      Measure, Score — are only just inside the panel's width.
    */
    <View className="px-1 py-2">
      {/*
        `button`, not `tab`, and the group takes no role at all: this
        react-native-macos build maps neither `tab` nor `tablist` onto an AppKit
        role, so both arrive as `AXUnknown` — an element VoiceOver cannot press.
        Measured on the accessibility tree: with `tab` the four segments were
        unpressable; with `button` they are the four AXButtons the strip used to
        expose. `accessibilityState.selected` is what carries which one is on.
      */}
      <View
        accessibilityLabel={label}
        className="bg-muted flex-row rounded-md p-0.5"
        {...(testID ? { testID } : {})}
      >
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              // macOS has no synthesized-touch fallback for an assistive
              // press, so a VoiceOver press would otherwise do nothing.
              onAccessibilityTap={() => onChange(option.value)}
              hitSlop={SLOP}
              className={selected ? SEGMENT_SELECTED : SEGMENT}
            >
              <Text
                numberOfLines={1}
                className={selected ? LABEL_SELECTED : LABEL}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
