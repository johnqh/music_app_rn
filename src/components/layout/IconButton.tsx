/**
 * An icon button in the title bar.
 *
 * The web app has `ICON_BUTTON_CLASS` for exactly this — one stated size for
 * every glyph in the bar, because a row of buttons that each size themselves
 * from their own content comes out ragged. Same reasoning here, and the same
 * height.
 */
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

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
const SELECTED = 'bg-accent rounded-md p-1.5';

export function IconButton({
  label,
  hint,
  onPress,
  disabled = false,
  selected = false,
  children,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint ? { accessibilityHint: hint } : {})}
      accessibilityState={{ disabled, selected }}
      onPress={onPress}
      disabled={disabled}
      className={disabled ? DISABLED : selected ? SELECTED : BASE}
    >
      {children}
    </Pressable>
  );
}
