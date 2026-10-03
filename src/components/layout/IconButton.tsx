/**
 * An icon button in the title bar.
 *
 * The web app has `ICON_BUTTON_CLASS` for exactly this — one stated size for
 * every glyph in the bar, because a row of buttons that each size themselves
 * from their own content comes out ragged. Same reasoning here, and the same
 * height.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable } from 'react-native';
import { touchSlop } from '@sudobility/components-rn';
import { useNotationInk } from '@/components/icons/notation-ink';

export type IconButtonProps = {
  /**
   * The control's *name* — "Copy", not "Duplicate the selection".
   *
   * A screen reader reads this to announce what the button is, so it has to be
   * the short name. Anything longer belongs in `hint`, which is read after it
   * and describes what pressing will do — the same split the web bar makes
   * between `aria-label` and its tooltip.
   */
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  /**
   * On for a control that is a toggle rather than an action.
   *
   * It reports `selected` to the accessibility layer as well as tinting, so a
   * screen reader says whether note input is on — the tint alone says it only
   * to somebody looking at it.
   */
  selected?: boolean;
  /**
   * Fill the button red while `selected`, rather than leaving the glyph to say
   * it — for an on/off switch (see `FILLED`). The caller draws its glyph in
   * inverse ink when on.
   */
  fill?: boolean;
  /**
   * The button's work is under way: the glyph becomes a spinner, the button
   * refuses a second press (and the assistive activation with it), and
   * `busy` is reported to the accessibility layer.
   */
  loading?: boolean;
  /**
   * The spinner's ink. A colour must be passed rather than inherited, so it
   * comes from `useNotationInk()`: the bar's ordinary `foreground` unless the
   * button sits on `bg-primary` (the title bar), which passes `onPrimary`.
   */
  spinnerColor?: string;
  children: ReactNode;
};

/*
  Whole class strings, never a template with a hole in it: Tailwind extracts
  classes by scanning source text, so an interpolated variant never appears
  whole in the file and is silently never generated. It fails quietly — the
  colours still work, the layout does not.
*/
const BASE = 'rounded-md p-1.5';
const DISABLED = 'rounded-md p-1.5 opacity-40';
/*
  Selection is a *colour*, and this used to paint a grey chip behind one.

  Every selected control in this app already says so in the accent: the toolbar
  chips fill red with inverse ink, and the loop, metronome, note-input and
  inspector toggles tint their glyph red. A grey background underneath was the
  same fact stated twice — and stated in a second visual language, so a
  red-on-grey control read as two overlapping states rather than one. The
  button keeps its shape; `accessibilityState.selected` still carries the fact
  to anything not looking at it.
*/
const SELECTED = 'rounded-md p-1.5';
/*
  The exception: a control that *is* an on/off switch for something on screen —
  the piano keyboard — fills red when on, with inverse ink, the way the toolbar
  chips do. Tinting the glyph alone read as "selected" rather than "on".
*/
const FILLED = 'rounded-md p-1.5 bg-primary';

/**
 * The drawn size: an 18px glyph in 6px of padding.
 *
 * Well under the 44/48 both platforms ask a touch target to be — and it has to
 * be, because the editing bar is 44pt tall in total and cannot hold a 44pt
 * control with any padding at all. `touchSlop` is what closes that: the button
 * still *looks* 30pt, and still fits the bar, while the region that responds
 * to a finger is the full 44 or 48. Both platforms' guidance is about the
 * touch area rather than the drawing, which is exactly this case.
 */
const DRAWN_SIZE = 30;
const SLOP = touchSlop(DRAWN_SIZE, DRAWN_SIZE);

/**
 * What the button does while the finger is still down.
 *
 * It used to do nothing: the glyph only changed once the touch *ended*, which
 * reads as a control that did not notice the press — and on a slow frame as
 * one that ignored it entirely. Every native button on both platforms answers
 * on touch-**down**, and each answers in its own way, so this is two answers
 * rather than one drawn compromise.
 *
 * Android gets `android_ripple`, which is the platform's own `RippleDrawable`
 * — drawn by the OS, from the touch point outwards, on the UI thread, so it
 * appears even while JavaScript is busy. `borderless` is right for a bar
 * glyph: the ripple is a circle around the icon rather than a filled rounded
 * rectangle, which is what Material specifies for an icon button.
 *
 * iOS has no ripple. A `UIBarButtonItem` dims to about half alpha the instant
 * it is touched and restores on release, and that is what the pressed opacity
 * below is. Deliberately *not* `TouchableOpacity`, whose 150ms fade is its own
 * invention rather than UIKit's — a bar glyph there responds immediately.
 */
const RIPPLE = { borderless: true, radius: DRAWN_SIZE / 2 } as const;
const PRESSED_OPACITY = Platform.OS === 'ios' ? 0.4 : 1;
/** The glyph's own box, so a spinning button keeps the bar's rhythm. */
const SPINNER_STYLE = { width: 18, height: 18 } as const;

export function IconButton({
  label,
  hint,
  onPress,
  disabled = false,
  selected = false,
  fill = false,
  loading = false,
  spinnerColor,
  children,
}: IconButtonProps) {
  const ink = useNotationInk();
  // Waiting is refusing: a second press while the first is in flight is the
  // double submit the spinner exists to prevent. Drawn at full strength,
  // though — a spinner at 40% reads as a control that is off.
  const inert = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint ? { accessibilityHint: hint } : {})}
      accessibilityState={{ disabled: inert, selected, busy: loading }}
      onPress={onPress}
      // macOS has no synthesized-touch fallback for an assistive press, so a
      // VoiceOver press would otherwise do nothing.
      {...(inert ? {} : { onAccessibilityTap: onPress })}
      disabled={inert}
      hitSlop={SLOP}
      android_ripple={RIPPLE}
      className={
        disabled ? DISABLED : selected ? (fill ? FILLED : SELECTED) : BASE
      }
      style={({ pressed }) =>
        pressed && !inert ? { opacity: PRESSED_OPACITY } : null
      }
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={spinnerColor ?? ink.foreground}
          style={SPINNER_STYLE}
        />
      ) : (
        children
      )}
    </Pressable>
  );
}
