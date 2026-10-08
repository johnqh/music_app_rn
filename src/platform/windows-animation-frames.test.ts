import { afterEach, describe, expect, it, vi } from 'vitest';
import { installWindowsAnimationFrames } from './windows-animation-frames';

describe('Windows animation frame cadence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paces callbacks instead of posting an immediate frame loop', () => {
    let timer: (() => void) | undefined;
    const schedule = vi.fn((callback: () => void, _delay: number) => {
      timer = callback;
      return 42;
    });
    const cancel = vi.fn();
    vi.stubGlobal('setTimeout', schedule);
    vi.stubGlobal('clearTimeout', cancel);
    vi.stubGlobal('performance', { now: () => 1234 });
    // Preserve the globals for the test environment too.
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    installWindowsAnimationFrames();
    const draw = vi.fn();
    const id = requestAnimationFrame(draw);
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1000 / 60);
    expect(draw).not.toHaveBeenCalled();
    timer?.();
    expect(draw).toHaveBeenCalledWith(1234);
    cancelAnimationFrame(id);
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
