/**
 * Whether the inspector opens before anybody has said.
 *
 * A module of its own, with nothing from React Native in it, so it can be
 * tested by vitest — the rendered `AppLayout` test cannot reach this rule at
 * all, because it renders with no layout and `useContainerSize` answers 0×0.
 * That is exactly how it shipped wrong: only the simulator caught it.
 *
 * The inspector is a right-hand column wherever it is shown (see `AppLayout`);
 * this decides only whether it starts open, and is never consulted again once
 * the reader has touched the toggle.
 */

/**
 * The inspector column's width, matching the `w-80` `AppLayout` draws it with.
 *
 * 320 rather than 288: the tab strip is a real `UISegmentedControl` on iPad,
 * which divides its width equally and elides a label that does not fit — at 288
 * the four tabs left ~66pt each and "Measure" rendered as "Measu…". Keep the
 * two in step; this is the number the arithmetic below uses.
 */
export const INSPECTOR_COLUMN_WIDTH = 320;

/** Narrower than this and a system of music is not worth reading. */
export const MIN_SCORE_WIDTH = 480;

/**
 * `width` is the editor **frame's**, insets included — which is the trap this
 * exists to name.
 *
 * `onLayout` reports a view's own frame, and `SafeAreaView` applies its insets
 * as padding *inside* that frame. So the number arriving here is the whole
 * 874pt of a landscape iPhone 16 Pro, not the 750 its content actually gets,
 * and 874 − 320 clears 480 while 750 − 320 does not. Measured on the simulator
 * before the insets were subtracted: the panel opened by default, leaving a
 * 430pt score and an inspector column 105pt tall with "Piano" cut off halfway —
 * the arrangement this rule exists to avoid.
 *
 * Subtracting the insets rather than raising the threshold, because a threshold
 * tuned until an iPhone falls one side of it and an iPad the other is a device
 * class wearing a number. This asks the real question: after the panel, is
 * there a readable system left? An 11" iPad has no side insets in landscape, so
 * it answers 1194 − 320 = 874 and opens; the phone answers 430 and does not.
 */
export function inspectorOpensByDefault(
  width: number,
  insets: { left: number; right: number },
): boolean {
  const content = width - insets.left - insets.right;
  return content - INSPECTOR_COLUMN_WIDTH >= MIN_SCORE_WIDTH;
}
