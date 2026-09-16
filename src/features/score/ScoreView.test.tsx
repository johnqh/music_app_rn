/**
 * The score view sends its first picture more than once.
 *
 * A picture reaches the Skia view from `Canvas`'s own layout effect, through
 * reanimated's UI runtime, and lands on the main thread some time after the
 * commit that created that view — so one that gets there too early is dropped
 * silently, with nothing to wait for and nothing to re-send it. On
 * react-native-macos that blanked the score on about half of the tab
 * activations whose sheet fits the viewport, because such a sheet is painted
 * exactly once and never again: there was no second picture to save it.
 *
 * What is pinned here is therefore *how many times* the first picture is sent —
 * more than once, and then not for ever, since during playback a picture a
 * frame is the cost that matters and a permanent re-send would double it.
 */
import { jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';
import type { ReactNode } from 'react';

/** Every `<Picture>` React was asked to draw, in order. */
const drawn: unknown[] = [];

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react') as typeof import('react');
  const { View: RNView } =
    require('react-native') as typeof import('react-native');
  return {
    Canvas: ({ children }: { children?: ReactNode }) =>
      React.createElement(RNView, null, children),
    Picture: ({ picture }: { picture: unknown }) => {
      drawn.push(picture);
      return null;
    },
    // The real hook measures the native view; the size is irrelevant here.
    useCanvasSize: () => ({
      ref: { current: { redraw: () => {} } },
      size: { width: 100, height: 100 },
    }),
  };
});

const { ScoreView, RESEND_FRAMES } =
  require('./ScoreView') as typeof import('./ScoreView');
const { createSignal } =
  require('./useScoreCanvas') as typeof import('./useScoreCanvas');

/** Frame callbacks waiting to run, so a test decides when a frame happens. */
let frames: (() => void)[] = [];

beforeEach(() => {
  drawn.length = 0;
  frames = [];
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((
    callback: () => void,
  ) => {
    frames.push(callback);
    return frames.length;
  }) as never);
  jest
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation((() => {}) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Runs whatever frame callbacks are pending, up to `times` frames. */
function runFrames(times: number): void {
  for (let i = 0; i < times; i += 1) {
    const pending = frames;
    frames = [];
    act(() => {
      for (const callback of pending) callback();
    });
  }
}

it('sends the first picture again on the frames after it arrives', () => {
  const picture = createSignal<never | null>(null);
  render(<ScoreView picture={picture as never} height={100} />);
  expect(drawn).toHaveLength(0);

  const first = { id: 'first' };
  act(() => picture.set(first as never));
  expect(drawn).toEqual([first]);

  runFrames(RESEND_FRAMES);
  // The one picture, sent again once per frame — otherwise a dropped first
  // send is a blank score for as long as the sheet needs no second paint.
  expect(drawn).toHaveLength(1 + RESEND_FRAMES);
  expect(drawn.every(sent => sent === first)).toBe(true);
});

it('stops re-sending, so playback pays for one picture a frame', () => {
  const picture = createSignal<never | null>(null);
  render(<ScoreView picture={picture as never} height={100} />);
  act(() => picture.set({ id: 'first' } as never));
  runFrames(RESEND_FRAMES + 5);
  const settled = drawn.length;

  const second = { id: 'second' };
  act(() => picture.set(second as never));
  runFrames(5);
  expect(drawn).toHaveLength(settled + 1);
  expect(drawn[drawn.length - 1]).toBe(second);
});

it('renders nothing while there is no picture', () => {
  const picture = createSignal<never | null>(null);
  const view = render(<ScoreView picture={picture as never} height={100} />);
  runFrames(RESEND_FRAMES + 1);
  expect(drawn).toHaveLength(0);
  expect(view.UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
});
