import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { PanResponder, Platform, StyleSheet } from 'react-native';
import type { PanResponderCallbacks } from 'react-native';
import { renderWithApp } from '@/test/render';
import { LevelSlider } from './LevelSlider.windows';

it('keeps a flexible track and maps clicks against its measured width', () => {
  const originalOS = Platform.OS;
  Platform.OS = 'windows';
  let handlers: PanResponderCallbacks = {};
  const pan = jest.spyOn(PanResponder, 'create').mockImplementation(config => {
    handlers = config;
    return { panHandlers: {} };
  });
  const onChange = jest.fn();
  try {
    const view = renderWithApp(
      <LevelSlider label="Volume" value={1} onChange={onChange} />,
    );
    const track = view.getByLabelText('Volume');
    expect(StyleSheet.flatten(track.props.style).maxWidth).toBeUndefined();
    fireEvent(track, 'layout', {
      nativeEvent: { layout: { width: 96, height: 20, x: 0, y: 0 } },
    });
    act(() => {
      handlers.onPanResponderGrant?.(
        { nativeEvent: { pageX: 190, locationX: 90 } } as never,
        {} as never,
      );
    });
    expect(onChange).toHaveBeenLastCalledWith(1);
    act(() => {
      handlers.onPanResponderMove?.({} as never, { moveX: 148 } as never);
    });
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    fireEvent(track, 'layout', {
      nativeEvent: { layout: { width: 216, height: 20, x: 0, y: 0 } },
    });
    act(() => {
      handlers.onPanResponderGrant?.(
        { nativeEvent: { pageX: 310, locationX: 210 } } as never,
        {} as never,
      );
    });
    expect(onChange).toHaveBeenLastCalledWith(1);
    act(() => {
      handlers.onPanResponderMove?.({} as never, { moveX: 208 } as never);
    });
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    view.unmount();
  } finally {
    Platform.OS = originalOS;
    pan.mockRestore();
  }
});
