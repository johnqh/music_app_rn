/**
 * A position readout renders when its text changes, not on every report.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { PositionSource } from './usePositionReadout';
import { usePositionReadout } from './usePositionReadout';

function fakeTransport() {
  const listeners = new Set<(tick: number) => void>();
  const transport: PositionSource = {
    onPosition: (fn: (tick: number) => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  const report = (tick: number) => listeners.forEach(fn => fn(tick));
  return { transport, report };
}

describe('usePositionReadout', () => {
  it('renders once per change of text, however many reports arrive', () => {
    const { transport, report } = fakeTransport();
    const beat = (tick: number) => String(Math.floor(tick / 480) + 1);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return usePositionReadout(transport, beat);
    });
    const settled = renders;

    for (let tick = 0; tick < 480; tick += 16) act(() => report(tick));
    expect(renders).toBe(settled);
    expect(result.current).toBe('1');

    act(() => report(480));
    expect(renders).toBe(settled + 1);
    expect(result.current).toBe('2');
  });
});
