/**
 * The waiting state of a call to action, and the control that shows it.
 *
 * The rule (CLAUDE.md, "A CTA that starts a wait spins through it"): pending
 * from before the work starts until it settles, either way, and a second
 * press meanwhile does nothing — refused by a ref, since two presses inside
 * one frame both read the state from before the first.
 */
import { jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { IconButton } from '@/components/layout/IconButton';
import { usePendingAction } from './usePendingAction';
import type { PendingAction } from './usePendingAction';

function deferred() {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function Probe({
  onRender,
}: {
  onRender: (pending: PendingAction<string>) => void;
}) {
  onRender(usePendingAction<string>());
  return null;
}

function mount() {
  let latest!: PendingAction<string>;
  render(<Probe onRender={pending => (latest = pending)} />);
  return () => latest;
}

describe('usePendingAction', () => {
  it('is pending, under its key, until the work settles', async () => {
    const current = mount();
    const work = deferred();
    let done!: Promise<unknown>;
    await act(async () => {
      done = current().run(() => work.promise, 'midi');
    });
    expect(current().pending).toBe(true);
    expect(current().pendingKey).toBe('midi');
    await act(async () => {
      work.resolve();
      await done;
    });
    expect(current().pending).toBe(false);
    expect(current().pendingKey).toBeNull();
  });

  it('refuses a second run while the first is in flight, even within one frame', async () => {
    const current = mount();
    const work = deferred();
    const second = jest.fn(async () => 'second');
    let refused: unknown = 'not yet';
    await act(async () => {
      const run = current().run;
      void run(() => work.promise);
      // The same `run`, before any re-render: what a double tap looks like.
      refused = await run(second);
    });
    expect(second).not.toHaveBeenCalled();
    expect(refused).toBeUndefined();
    await act(async () => {
      work.resolve();
    });
    // Free again once the first has settled.
    let answer: unknown;
    await act(async () => {
      answer = await current().run(second);
    });
    expect(answer).toBe('second');
  });

  it('stops waiting when the work fails, and lets the failure through', async () => {
    const current = mount();
    const work = deferred();
    let done!: Promise<unknown>;
    await act(async () => {
      done = current().run(() => work.promise);
    });
    await act(async () => {
      work.reject(new Error('offline'));
      await expect(done).rejects.toThrow('offline');
    });
    expect(current().pending).toBe(false);
  });
});

describe('IconButton while loading', () => {
  it('spins, says it is busy, and answers neither a press nor an assistive tap', () => {
    const onPress = jest.fn();
    const view = render(
      <IconButton label="Save" onPress={onPress} loading>
        <Text>glyph</Text>
      </IconButton>,
    );
    const button = view.getByLabelText('Save');
    expect(view.queryByText('glyph')).toBeNull();
    expect(button.props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
    expect(button.props.onAccessibilityTap).toBeUndefined();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('draws its glyph and answers both routes when not', () => {
    const onPress = jest.fn();
    const view = render(
      <IconButton label="Save" onPress={onPress}>
        <Text>glyph</Text>
      </IconButton>,
    );
    expect(view.getByText('glyph')).toBeTruthy();
    expect(view.getByLabelText('Save').props.onAccessibilityTap).toBe(onPress);
  });
});
