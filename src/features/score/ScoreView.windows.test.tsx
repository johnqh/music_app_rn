import { jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import type { Picture } from '@sudobility/windows_canvas_rn';
import { ScoreView } from './ScoreView.windows';
import type { ScoreFrame, Signal } from './useScoreCanvas.windows';

jest.mock('@sudobility/windows_canvas_rn', () => {
  const React = require('react');
  // Memoised like the real one, so what renders is what would redraw.
  const draw = jest.fn(() => null);
  return { CanvasPicture: React.memo(draw), mockDraw: draw };
});
const { mockDraw } = jest.requireMock('@sudobility/windows_canvas_rn') as {
  mockDraw: jest.Mock;
};

const picture = (name: string): Picture => ({
  width: 1,
  height: 1,
  ops: [1],
  strings: [name],
});
const committed = jest.fn();
const frame = (base: Picture, overlay: Picture): ScoreFrame => ({
  base,
  overlay,
  committed,
});

it('keeps the base picture and only redraws the highlight layer during playback', () => {
  const base = picture('base');
  let value: ScoreFrame | null = frame(base, picture('note A'));
  const listeners = new Set<() => void>();
  const signal: Signal<ScoreFrame | null> = {
    get: () => value,
    set: next => {
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const drawn = () =>
    mockDraw.mock.calls.map(
      call => (call[0] as { picture: Picture }).picture.strings[0],
    );
  mockDraw.mockClear();
  committed.mockClear();
  const view = render(<ScoreView picture={signal} height={800} />);
  expect(drawn()).toEqual(['base', 'note A']);
  // Each committed frame is reported, which is how the canvas learns how
  // far ahead of the sound the lit notes have to be published.
  expect(committed).toHaveBeenCalledTimes(1);
  act(() => signal.set(frame(base, picture('note B'))));
  expect(drawn()).toEqual(['base', 'note A', 'note B']);
  expect(committed).toHaveBeenCalledTimes(2);
  act(() => signal.set(frame(picture('new page'), picture('note C'))));
  expect(drawn().slice(3)).toEqual(['new page', 'note C']);
  view.unmount();
});
