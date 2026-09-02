/**
 * The app's sliders on macOS, painted — because there is no native one to use.
 *
 * Everywhere else these are `@react-native-community/slider`, a `UISlider` /
 * `SeekBar` wrapper. Its podspec declares `:ios` and `:visionos` only, so
 * react-native-macos gets nothing from it, and this file is what a Mac build
 * resolves instead. It exports the same two names as `LevelSlider.tsx` and
 * nothing else — that is the whole contract, and a caller never learns which
 * variant it got.
 *
 * What follows is the web app's own drawing, kept for that reason.
 *
 * `@sudobility/components-rn`'s `Slider` is a good general control and the
 * wrong one here, for exactly the reason the web app rejected the shared web
 * `Slider`: its unfilled track is `bg-muted`, and against these surfaces that
 * is very nearly the background — so a control reads as a short bar floating in
 * space, with nothing to say how much further it goes. `music_app`'s
 * `level-slider.tsx` paints its groove in `bg-border` instead; this is that
 * drawing, with the same shapes and the same sizes, so a volume fader means the
 * same thing on both platforms.
 *
 * The gesture is ours because React Native has no `<input type="range">` to
 * borrow keyboard and touch behaviour from. Everything else — the 6px groove,
 * the 12px round knob for a level, the 8×16 slotted knob for a position — is
 * the web's geometry restated in numbers, since NativeWind cannot express
 * `::-webkit-slider-thumb`.
 *
 * The pointer origin is taken on **grant**, from `pageX - locationX`, and the
 * drag is measured against it. The library slider uses `gesture.moveX` raw,
 * which is a screen coordinate — correct only for a track whose left edge is
 * the left edge of the window.
 */
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

/** The web's `h-1.5` groove. */
const TRACK_HEIGHT = 6;

/** The web's `size-3` round knob. */
const LEVEL_THUMB_WIDTH = 12;
const LEVEL_THUMB_HEIGHT = 12;

/** The web's `h-4 w-2` slotted knob, for a position rather than an amount. */
const PAN_THUMB_WIDTH = 8;
const PAN_THUMB_HEIGHT = 16;

/** The row height, so a slider lines up with the text beside it. */
const SHELL_HEIGHT = 20;

type SliderShellProps = {
  /** The accessible name — what property of what this controls. */
  label: string;
  value: number;
  min: number;
  max: number;
  /** Quantum. 0 means continuous. */
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Fired once on release, for work too expensive to do per frame. */
  onSlidingComplete?: (value: number) => void;
  thumbWidth?: number;
  thumbHeight?: number;
  /** Whole class strings only — NativeWind never sees an interpolated one. */
  thumbClassName?: string;
  className?: string;
  /**
   * The painting behind the knob, given the measured track width.
   *
   * A function rather than a node because a fill has to be sized in pixels:
   * percentage widths inside an absolutely positioned RN view do not resolve
   * against a parent that is itself laid out by flex.
   */
  children: (width: number) => ReactNode;
};

/** The gesture and its painted bed; each control supplies its own painting. */
function SliderShell({
  label,
  value,
  min,
  max,
  step = 0,
  disabled = false,
  onChange,
  onSlidingComplete,
  thumbWidth = LEVEL_THUMB_WIDTH,
  thumbHeight = LEVEL_THUMB_HEIGHT,
  thumbClassName = 'bg-primary',
  className,
  children,
}: SliderShellProps) {
  const [width, setWidth] = useState(0);

  /*
    Refs, not state: the pan handlers are created once and would otherwise
    capture the first render's width and callbacks forever.
  */
  const widthRef = useRef(0);
  const originRef = useRef(0);
  const latest = useRef({
    min,
    max,
    step,
    thumbWidth,
    onChange,
    onSlidingComplete,
    disabled,
  });
  latest.current = {
    min,
    max,
    step,
    thumbWidth,
    onChange,
    onSlidingComplete,
    disabled,
  };

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(previous => (previous === next ? previous : next));
  }, []);

  const valueAt = useCallback((x: number): number => {
    const {
      min: lo,
      max: hi,
      step: quantum,
      thumbWidth: knob,
    } = latest.current;
    const usable = Math.max(1, widthRef.current - knob);
    const fraction = Math.min(1, Math.max(0, (x - knob / 2) / usable));
    const raw = lo + fraction * (hi - lo);
    if (!quantum) return raw;
    return Math.min(hi, Math.max(lo, Math.round(raw / quantum) * quantum));
  }, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderGrant: event => {
        const { pageX, locationX } = event.nativeEvent;
        originRef.current = pageX - locationX;
        latest.current.onChange(valueAt(locationX));
      },
      onPanResponderMove: (_event, gesture) => {
        latest.current.onChange(valueAt(gesture.moveX - originRef.current));
      },
      onPanResponderRelease: (event, gesture) => {
        const at = valueAt(
          gesture.dx === 0
            ? event.nativeEvent.locationX
            : gesture.moveX - originRef.current,
        );
        latest.current.onChange(at);
        latest.current.onSlidingComplete?.(at);
      },
    }),
  ).current;

  const span = max - min || 1;
  const fraction = Math.min(1, Math.max(0, (value - min) / span));
  const travel = Math.max(0, width - thumbWidth);
  /*
    Half the short side: a round knob comes out round, and the pan slider's
    tall narrow one comes out a stadium rather than an ellipse.
  */
  const thumbRadius = Math.min(thumbWidth, thumbHeight) / 2;

  return (
    <View
      onLayout={onLayout}
      className={className ? `justify-center ${className}` : 'justify-center'}
      style={{ height: SHELL_HEIGHT, opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityState={{ disabled }}
      {...(disabled ? {} : responder.panHandlers)}
    >
      {children(width)}
      <View
        className={thumbClassName}
        style={{
          position: 'absolute',
          width: thumbWidth,
          height: thumbHeight,
          left: fraction * travel,
          /*
            An explicit radius and a shadow, rather than `rounded-full` with a
            one-pixel border.

            A hairline border around a twelve-pixel circle is the hardest thing
            on screen to draw cleanly: macOS aliases it into a ragged grey ring
            that reads as a rendering fault rather than an edge. A real knob is
            not outlined anyway — `NSSlider` gives it a soft shadow, which
            separates it from the groove without an edge to alias.

            The radius is stated in pixels rather than left to `rounded-full`,
            so a non-square thumb (the pan slider's slotted knob) rounds by its
            own short side instead of collapsing to an ellipse.
          */
          borderRadius: thumbRadius,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </View>
  );
}

export type LevelSliderProps = {
  /** The accessible name — what property of what this controls. */
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  className?: string;
};

/**
 * A level: filled from the left, with the groove visible behind it.
 *
 * The whole control in one call, so a caller cannot get the groove wrong by
 * forgetting to paint it — which is how the web transport bar ended up without
 * one.
 */
export function LevelSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0,
  disabled,
  onChange,
  onSlidingComplete,
  className,
}: LevelSliderProps) {
  const span = max - min;
  const fraction =
    span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0;
  return (
    <SliderShell
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      {...(disabled === undefined ? {} : { disabled })}
      onChange={onChange}
      {...(onSlidingComplete ? { onSlidingComplete } : {})}
      {...(className ? { className } : {})}
    >
      {width => (
        <>
          {/* The unfilled groove — what says how much further the control goes. */}
          <View
            className="bg-border rounded-full"
            style={{ height: TRACK_HEIGHT, width: '100%' }}
          />
          <View
            className="bg-primary absolute rounded-full"
            style={{ height: TRACK_HEIGHT, left: 0, width: fraction * width }}
          />
        </>
      )}
    </SliderShell>
  );
}

/**
 * A position on a range, rather than an amount of one — the drawn counterpart.
 *
 * Unlike the native variant, which can only choose between two flat track
 * colours, this one can say what pan actually is: a bar growing *out of the
 * centre* towards whichever side is chosen, over a centre detent, under a tall
 * narrow knob rather than a bead. Square ends and a darker bed, so that a pan
 * row and the volume row directly above it read as the different things they
 * are at a glance.
 */
export function PositionSlider({
  label,
  value,
  min = -1,
  max = 1,
  step = 0,
  disabled,
  onChange,
  onSlidingComplete,
  className,
}: LevelSliderProps) {
  const span = max - min || 1;
  const centred = (value - min) / span;
  // Half-widths either side of centre, so the fill grows out of the middle.
  const magnitude = Math.abs(centred - 0.5);
  const offset = centred < 0.5 ? 0.5 - magnitude : 0.5;

  return (
    <SliderShell
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      {...(disabled === undefined ? {} : { disabled })}
      onChange={onChange}
      {...(onSlidingComplete ? { onSlidingComplete } : {})}
      {...(className ? { className } : {})}
      thumbWidth={PAN_THUMB_WIDTH}
      thumbHeight={PAN_THUMB_HEIGHT}
      thumbClassName="bg-primary"
    >
      {width => (
        <>
          <View
            className="bg-muted-foreground/45"
            style={{ height: TRACK_HEIGHT, width: '100%' }}
          />
          {/* The centre detent, so "no pan" is findable by eye as well as by feel. */}
          <View
            className="bg-muted-foreground/70 absolute"
            style={{ width: 1, height: 10, left: width / 2 }}
          />
          <View
            className="bg-primary absolute"
            style={{
              height: TRACK_HEIGHT,
              left: offset * width,
              width: magnitude * width,
            }}
          />
        </>
      )}
    </SliderShell>
  );
}
