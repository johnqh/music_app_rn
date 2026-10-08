import { afterEach, describe, expect, it, vi } from 'vitest';
import { installWindowsAnimationFrames } from './windows-animation-frames';

function install(now: { value: number }) {
  const timers: { callback: () => void; delay: number }[] = [];
  const schedule = vi.fn((callback: () => void, delay: number) => {
    timers.push({ callback, delay });
    return timers.length;
  });
  vi.stubGlobal('setTimeout', schedule);
  vi.stubGlobal('performance', { now: () => now.value });
  // Preserve the globals for the test environment too.
  vi.stubGlobal('requestAnimationFrame', undefined);
  vi.stubGlobal('cancelAnimationFrame', undefined);
  installWindowsAnimationFrames();
  return { timers, schedule };
}

describe('Windows animation frame cadence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paces callbacks instead of posting an immediate frame loop', () => {
    const now = { value: 1234 };
    const { timers } = install(now);
    const draw = vi.fn();
    requestAnimationFrame(draw);
    expect(timers).toHaveLength(1);
    // Never 1ms: RNW treats a one-shot 1ms timer as an immediate frame post.
    expect(timers[0]!.delay).toBeGreaterThan(1);
    expect(draw).not.toHaveBeenCalled();
    timers[0]!.callback();
    expect(draw).toHaveBeenCalledWith(1234);
  });

  it('serves every request made before a frame with one timer', () => {
    const now = { value: 0 };
    const { timers } = install(now);
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    requestAnimationFrame(a);
    requestAnimationFrame(b);
    const cancelled = requestAnimationFrame(c);
    cancelAnimationFrame(cancelled);
    expect(timers).toHaveLength(1);
    now.value = 5;
    timers[0]!.callback();
    expect(a).toHaveBeenCalledWith(5);
    expect(b).toHaveBeenCalledWith(5);
    expect(c).not.toHaveBeenCalled();
  });

  it('aims the next frame at the grid rather than a fixed delay after the request', () => {
    const now = { value: 0 };
    const { timers } = install(now);
    requestAnimationFrame(() => undefined);
    now.value = 100;
    timers[0]!.callback();
    // Asked for straight after a frame: the rest of the frame.
    now.value = 102;
    requestAnimationFrame(() => undefined);
    expect(timers[1]!.delay).toBeCloseTo(1000 / 60 - 2);
    now.value = 140;
    timers[1]!.callback();
    // Asked for long after: as soon as RNW allows.
    now.value = 180;
    requestAnimationFrame(() => undefined);
    expect(timers[2]!.delay).toBe(2);
  });

  it('runs the rest of the frame when one callback throws', () => {
    const now = { value: 0 };
    const { timers } = install(now);
    const after = vi.fn();
    requestAnimationFrame(() => {
      throw new Error('boom');
    });
    requestAnimationFrame(after);
    timers[0]!.callback();
    expect(after).toHaveBeenCalled();
    // The error is rethrown on a timer of its own.
    expect(timers).toHaveLength(2);
    expect(() => timers[1]!.callback()).toThrow('boom');
  });
});
