/**
 * Volume and pan, drawn as the things they are — the web app's mixer rows.
 *
 * The generic `Slider` is a good general control and a poor mixer one, for two
 * reasons this fixes, both of them `music_app`'s `mixer-controls.tsx`'s:
 *
 * - **Volume gave no sense of its range.** Its unfilled track is `bg-muted`,
 *   which against the property sheet's own surface is very nearly invisible —
 *   so a quiet track looked like a short bar floating in space, with nothing to
 *   say how much further it could go. Here the groove is always visible behind
 *   the fill, and a percent readout says the same thing in words.
 * - **Pan is not a number in a range.** It is a position between left and
 *   right, and the only readings that matter are which side and how far from
 *   centre. So it fills *from the middle*, marks the centre, and reads out
 *   "C" / "L40" / "R25" — a bar growing from the left said "40% of maximum
 *   pan", which is not a thing.
 *
 * Each owns its whole row — label, control, readout — rather than being dropped
 * into a row the caller builds. The two sit directly above one another in the
 * panel, so any difference between them reads as a mistake, and letting each
 * caller size its own label column is exactly how they diverged on the web: the
 * volume groove sat 14px left of the pan groove and ran 68px wider, because
 * "Volume" is a longer word than "Pan" and both rows were sizing to their own
 * text.
 */
import { Pressable, View } from 'react-native';
import { MIN_TOUCH_TARGET, Text } from '@sudobility/components-rn';
import { LevelSlider, PositionSlider } from '@/components/controls/LevelSlider';
/*
  `panReadout` is music_types', not this app's — it sits with the other "say a
  stored value the way a musician says it" conversions in
  `music-vocabulary.ts`. It was three lines in music_app and three identical
  lines here, which is the shape of thing that agrees right up until one side
  is edited.
*/
import { panReadout } from '@sudobility/music_types';

/** The row shape both controls use, stated once so the two cannot drift. */
const ROW_CLASS = 'flex-row items-center gap-2';
const ROW_LABEL_CLASS = 'text-muted-foreground w-16 shrink-0 text-sm';
const ROW_READOUT_CLASS =
  'text-muted-foreground w-12 shrink-0 text-right text-sm tabular-nums';

/**
 * The trailing action column.
 *
 * Only pan has anything to put in it, but both rows reserve it — otherwise the
 * pan groove would be a button's width shorter than the volume groove directly
 * above it, which is the misalignment this row shape exists to prevent.
 */
/** The trailing action column, at the platform minimum. */
const ROW_ACTION_WIDTH = MIN_TOUCH_TARGET;

export type MixerSliderProps = {
  /** The accessible name — what property of what this controls. */
  label: string;
  /** The visible text in the row's label column, which is shorter. */
  rowLabel: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Fired on release, for a caller that commits rather than tracks. */
  onCommit?: (value: number) => void;
};

/** 0 to 1, filled from the left, on a groove that shows the whole range. */
export function VolumeSlider({
  label,
  rowLabel,
  value,
  disabled,
  onChange,
  onCommit,
}: MixerSliderProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <View className={ROW_CLASS}>
      <Text className={ROW_LABEL_CLASS}>{rowLabel}</Text>
      <LevelSlider
        className="flex-1"
        label={label}
        value={clamped}
        onChange={onChange}
        {...(onCommit ? { onSlidingComplete: onCommit } : {})}
        {...(disabled === undefined ? {} : { disabled })}
      />
      <Text className={ROW_READOUT_CLASS}>{`${percent}%`}</Text>
      <View style={{ width: ROW_ACTION_WIDTH }} />
    </View>
  );
}

export type PanSliderProps = MixerSliderProps & {
  /** Centres the pan. Omitted where there is nothing to commit to. */
  onReset?: () => void;
  /** The reset button's accessible name; the caller owns the words. */
  resetLabel: string;
};

/**
 * -1 to 1, as a position rather than a level.
 *
 * `PositionSlider` is what carries that distinction — an unfilled track on the
 * platforms whose native slider has one track colour either side of the thumb,
 * a bar growing out of the centre on macOS, where the control is drawn and can
 * say so. Either way the readout beside it states the value exactly, which is
 * the reading that actually matters: which side of centre, and how far.
 */
export function PanSlider({
  label,
  rowLabel,
  value,
  disabled,
  onChange,
  onCommit,
  onReset,
  resetLabel,
}: PanSliderProps) {
  const clamped = Math.min(1, Math.max(-1, value));
  const canReset = !disabled && clamped !== 0;

  return (
    <View className={ROW_CLASS}>
      <Text className={ROW_LABEL_CLASS}>{rowLabel}</Text>
      <PositionSlider
        className="flex-1"
        label={label}
        value={clamped}
        min={-1}
        max={1}
        {...(disabled === undefined ? {} : { disabled })}
        onChange={onChange}
        {...(onCommit ? { onSlidingComplete: onCommit } : {})}
      />
      <Text className={ROW_READOUT_CLASS}>{panReadout(clamped)}</Text>
      {onReset ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resetLabel}
          accessibilityState={{ disabled: !canReset }}
          disabled={!canReset}
          onPress={onReset}
          style={{
            width: ROW_ACTION_WIDTH,
            height: ROW_ACTION_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: canReset ? 1 : 0.4,
          }}
        >
          {/* A reset arrow: ⌖ was the obvious "centre" mark and was
              illegible at this size. */}
          <Text className="text-muted-foreground text-base">↺</Text>
        </Pressable>
      ) : (
        <View style={{ width: ROW_ACTION_WIDTH }} />
      )}
    </View>
  );
}
