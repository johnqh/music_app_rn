/**
 * Keys outside the instrument are drawn but do not play.
 *
 * An import can hold notes a real instrument cannot reach, and the keyboard
 * widens to show them (`trackKeyboardSpan`). Those keys are pale and inert: a
 * person can import such a note, not play one in.
 */
import { jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { KEYBOARD_OUT_OF_RANGE_WHITE } from '@sudobility/music_drawing';
import { PianoKeyboard } from './PianoKeyboard';

describe('PianoKeyboard', () => {
  const range = { min: 16, max: 43 }; // E0 up to G2
  const playable = { min: 28, max: 67 }; // a bass: E1 upward

  it('marks keys below the playable range as disabled and pale', () => {
    const view = render(
      <PianoKeyboard width={600} range={range} playable={playable} />,
    );
    const keys = view.getAllByRole('button');
    const e0 = keys.find(
      k =>
        k.props.accessibilityLabel === 'E0' ||
        k.props.accessibilityLabel === '16',
    );
    const e1 = keys.find(k => k.props.accessibilityLabel === '28');
    expect(e0).toBeDefined();
    expect(e0!.props.accessibilityState).toMatchObject({ disabled: true });
    expect(StyleSheet.flatten(e0!.props.style).backgroundColor).toBe(
      KEYBOARD_OUT_OF_RANGE_WHITE,
    );
    expect(e1!.props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('does not report a press on a key outside the range', () => {
    const onKeyDown = jest.fn();
    const onKeyUp = jest.fn();
    const view = render(
      <PianoKeyboard
        width={600}
        range={range}
        playable={playable}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />,
    );
    const keys = view.getAllByRole('button');
    const low = keys.find(k => k.props.accessibilityState?.disabled === true)!;
    fireEvent(low, 'pressIn');
    fireEvent(low, 'pressOut');
    expect(onKeyDown).not.toHaveBeenCalled();
    const playableKey = keys.find(
      k => k.props.accessibilityState?.disabled === false,
    )!;
    fireEvent(playableKey, 'pressIn');
    expect(onKeyDown).toHaveBeenCalled();
  });
});
