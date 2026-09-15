/**
 * Toasts.
 *
 * What is pinned: a store built with the queue as its sink reaches the screen
 * (the whole reason the queue exists — the native app used to push toasts into
 * a list nothing read), one toast shows at a time, an action runs and
 * dismisses, and the store's id is the one dismissed.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { createDocumentStore } from '@sudobility/music_lib';
import { createEmptyScore } from '@sudobility/music_types';
import { renderWithApp } from '@/test/render';
import { AUTO_HIDE_MS, createToastQueue, Toasts } from './Toasts';

describe('Toasts', () => {
  it("shows a store's toast when the queue is its sink", () => {
    const queue = createToastQueue();
    const store = createDocumentStore({
      title: 'T',
      score: createEmptyScore({ title: 'T' }),
      context: { toasts: queue },
    });
    const view = renderWithApp(<Toasts queue={queue} />);
    act(() => {
      store.getState().pushToast({ severity: 'error', message: 'Save failed' });
    });
    expect(view.getByText('Save failed')).toBeTruthy();
    store.getState().dispose();
  });

  it('shows the oldest toast first, one at a time', () => {
    const queue = createToastQueue();
    const view = renderWithApp(<Toasts queue={queue} />);
    act(() => {
      queue.push({ id: 'a', severity: 'info', message: 'First' });
      queue.push({ id: 'b', severity: 'info', message: 'Second' });
    });
    expect(view.getByText('First')).toBeTruthy();
    expect(view.queryByText('Second')).toBeNull();
    fireEvent.press(view.getByLabelText('Close'));
    expect(view.getByText('Second')).toBeTruthy();
  });

  it('runs an action and then dismisses it', () => {
    const queue = createToastQueue();
    const onClick = jest.fn();
    const view = renderWithApp(<Toasts queue={queue} />);
    act(() => {
      queue.push({
        id: 'paste',
        severity: 'warning',
        message: 'Nothing was pasted',
        action: { label: 'Undo', onClick },
      });
    });
    fireEvent.press(view.getByText('Undo'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(queue.toasts).toEqual([]);
  });

  it('hides itself after a while, errors lingering longest', () => {
    jest.useFakeTimers();
    try {
      const queue = createToastQueue();
      renderWithApp(<Toasts queue={queue} />);
      act(() => {
        queue.push({ id: 'e', severity: 'error', message: 'Broken' });
      });
      act(() => {
        jest.advanceTimersByTime(AUTO_HIDE_MS.info);
      });
      expect(queue.toasts).toHaveLength(1);
      act(() => {
        jest.advanceTimersByTime(AUTO_HIDE_MS.error);
      });
      expect(queue.toasts).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
