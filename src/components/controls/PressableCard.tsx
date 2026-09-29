/**
 * A row in a list that is pressed to choose it — a project, a template, a
 * format to import — and says so under the pointer.
 *
 * These rows were plain `Pressable`s with one background, which is right on
 * a phone: a finger covers what it touches, and the press is felt. On a
 * desktop the pointer hovers before it clicks, and a row that does not
 * change under it reads as a label rather than a control — and a click that
 * changes nothing on the way down reads as a click that missed, which is
 * what it looked like while a project took a moment to open.
 *
 * Hover and press are held as state rather than read from `Pressable`'s
 * style callback, so the classes stay NativeWind's and follow the theme.
 * `onHoverIn`/`onHoverOut` are never called where there is no pointer, so a
 * phone sees the pressed state alone.
 */
import { useState } from 'react';
import { Pressable } from 'react-native';
import type { ReactNode } from 'react';
import { MIN_TOUCH_TARGET, cn } from '@sudobility/components-rn';

export type PressableCardProps = {
  /** The row's accessible name: what is being chosen. */
  label: string;
  onPress: () => void;
  children: ReactNode;
};

export function PressableCard({
  label,
  onPress,
  children,
}: PressableCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      // macOS has no synthesized-touch fallback for an assistive press, so a
      // VoiceOver activation reaches a Pressable only through
      // `onAccessibilityTap` — `onPress` is a touch/mouse responder.
      onAccessibilityTap={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => {
        setHovered(false);
        // A press dragged off the row never gets its `onPressOut` on every
        // platform, and a row left looking held down is worse than one that
        // let go a moment early.
        setPressed(false);
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cn(
        'rounded-lg border p-3',
        pressed
          ? 'border-primary bg-primary/20'
          : hovered
          ? 'border-primary bg-primary/10'
          : 'border-border bg-card',
      )}
      style={{ minHeight: MIN_TOUCH_TARGET }}
    >
      {children}
    </Pressable>
  );
}
