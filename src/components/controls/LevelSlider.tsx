/**
 * The app's sliders — the platform's own control, not a drawing of one.
 *
 * `@react-native-community/slider` is a thin wrapper over `UISlider` on iOS and
 * `SeekBar` on Android, so a fader here has the system's track height, its
 * thumb shadow, its press-and-grow animation, its haptics and its VoiceOver /
 * TalkBack behaviour — none of which a `PanResponder` over two `View`s can
 * reproduce, and all of which a user recognises without being told.
 *
 * Its podspec declares `:ios` and `:visionos` only. macOS uses the shared
 * AppKit slider from `@sudobility/components-rn`; Windows uses the painted
 * fallback. Callers use the same two names on every platform.
 *
 * Colours are literal, from `useNotationInk`, for the reason the notation
 * glyphs' are: these are native views, so a NativeWind class never reaches
 * them, and a hardcoded hex is the thing that cannot follow the theme.
 */
import NativeSlider from '@react-native-community/slider';
import { View } from 'react-native';
import { useNotationInk } from '@/components/icons/notation-ink';

export type LevelSliderProps = {
  /** The accessible name — what property of what this controls. */
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** Quantum. 0 means continuous. */
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Fired once on release, for work too expensive to do per frame. */
  onSlidingComplete?: (value: number) => void;
  className?: string;
};

/**
 * The native slider, with the one decision the two variants differ on.
 *
 * `filled` is whether the track left of the thumb is painted in the accent —
 * which is the difference between an amount and a position, and the only thing
 * `PositionSlider` changes.
 */
function BaseSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0,
  disabled = false,
  onChange,
  onSlidingComplete,
  className,
  filled,
}: LevelSliderProps & { filled: boolean }) {
  const ink = useNotationInk();
  return (
    <View className={className}>
      <NativeSlider
        accessibilityLabel={label}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        onValueChange={onChange}
        {...(onSlidingComplete ? { onSlidingComplete } : {})}
        minimumTrackTintColor={filled ? ink.primary : ink.border}
        maximumTrackTintColor={ink.border}
        thumbTintColor={ink.primary}
        style={{ opacity: disabled ? 0.5 : 1 }}
      />
    </View>
  );
}

/** An amount: the track fills from the left as the value grows. */
export function LevelSlider(props: LevelSliderProps) {
  return <BaseSlider {...props} filled />;
}

/**
 * A position on a range, rather than an amount of one.
 *
 * Pan is the case: -1 to 1 with the default in the middle, where the readings
 * that matter are which side of centre and how far. So the track is *not*
 * filled — a bar growing from the left would say "70% of maximum pan", which is
 * not a thing — and the value is stated in words beside it ("C", "L40", "R25")
 * by the row that owns the control.
 *
 * The web app draws this as a bar growing out of the centre with a slotted
 * knob. A `UISlider` has one track colour either side of its thumb and a round
 * thumb, and neither is settable, so that drawing is the one thing lost by
 * going native here. It was decoration over a readout that already says the
 * same thing exactly.
 */
export function PositionSlider(props: LevelSliderProps) {
  return <BaseSlider {...props} filled={false} />;
}
