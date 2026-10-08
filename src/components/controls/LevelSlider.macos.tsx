/** App labels and value callbacks over the shared AppKit slider. */
import { Slider } from '@sudobility/components-rn';

export type LevelSliderProps = {
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
  thumbStyle,
}: LevelSliderProps & { thumbStyle: 'default' | 'fader' }) {
  return (
    <Slider
      className={className}
      accessibilityLabel={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={onChange}
      onSlidingComplete={onSlidingComplete}
      thumbStyle={thumbStyle}
    />
  );
}

export function LevelSlider(props: LevelSliderProps) {
  return <BaseSlider {...props} thumbStyle="default" />;
}

export function PositionSlider(props: LevelSliderProps) {
  return <BaseSlider {...props} thumbStyle="fader" />;
}
