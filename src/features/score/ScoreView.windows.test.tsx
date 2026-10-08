import { jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { SvgXml } from 'react-native-svg';
import { ScoreView } from './ScoreView.windows';
import { SvgDrawingContext } from './svg-context';
import type { Signal, SvgPicture } from './useScoreCanvas.windows';

jest.mock('react-native-svg', () => ({ SvgXml: jest.fn(() => null) }));

it('keeps the base SVG mounted and only reparses the highlight layer during playback', () => {
  let value: SvgPicture | null = { base: 'base', overlay: 'note A' };
  const listeners = new Set<() => void>();
  const picture: Signal<SvgPicture | null> = {
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
  const calls = jest.mocked(SvgXml);
  calls.mockClear();
  const view = render(<ScoreView picture={picture} height={800} />);
  expect(calls).toHaveBeenCalledTimes(2);
  act(() => picture.set({ base: 'base', overlay: 'note B' }));
  expect(calls).toHaveBeenCalledTimes(3);
  expect(calls.mock.calls.at(-1)?.[0].xml).toBe('note B');
  act(() => picture.set({ base: 'new page', overlay: 'note C' }));
  expect(calls).toHaveBeenCalledTimes(5);
  view.unmount();
});

it('makes the highlight SVG transparent so it does not hide the cached notation', () => {
  const ctx = new SvgDrawingContext(200, 100);
  ctx.fillRect(20, 20, 10, 10);
  expect(ctx.toSvg()).toContain('fill="white"');
  expect(ctx.toSvg(null)).not.toContain('fill="white"');
  expect(ctx.toSvg(null)).toContain('width="10"');
});
