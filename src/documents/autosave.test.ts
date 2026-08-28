import { describe, expect, it, vi } from 'vitest';
import { createAutosaver } from './autosave.js';
import { createDocument } from './document.js';
import {
  changeMetadataCommand,
  createEmptyScore,
} from '@sudobility/music_types';
import type { DocumentOrigin } from './document.js';

let n = 0;
function doc(
  origin: DocumentOrigin = { kind: 'file', uri: `/f${++n}.moosiac` },
) {
  const d = createDocument({
    id: `d${n}`,
    title: `T${n}`,
    score: createEmptyScore({ title: 'T' }),
    origin,
  });
  d.store
    .getState()
    .dispatchCommand(changeMetadataCommand({ title: 'edited' }, 'edit'));
  return d;
}

/** A hand-cranked clock, so nothing waits on real time. */
function manualTimer() {
  let fn: (() => void) | null = null;
  return {
    setTimer: (f: () => void) => {
      fn = f;
      return 1;
    },
    clearTimer: () => {
      fn = null;
    },
    tick: async () => {
      const f = fn;
      fn = null;
      f?.();
      await Promise.resolve();
    },
  };
}

describe('autosave', () => {
  it('waits, then writes once for a burst of edits', async () => {
    const save = vi.fn(async () => {});
    const timer = manualTimer();
    const a = createAutosaver({ save, ...timer });
    const d = doc();
    a.notify(d);
    a.notify(d);
    a.notify(d);
    expect(save).not.toHaveBeenCalled();
    await timer.tick();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('writes every dirty document, not just the last one touched', async () => {
    const save = vi.fn(async () => {});
    const timer = manualTimer();
    const a = createAutosaver({ save, ...timer });
    const first = doc();
    const second = doc();
    a.notify(first);
    a.notify(second);
    await timer.tick();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('never autosaves a document with no file: where it goes is the user’s call', async () => {
    const save = vi.fn(async () => {});
    const timer = manualTimer();
    const a = createAutosaver({ save, ...timer });
    a.notify(doc({ kind: 'unsaved' }));
    await timer.tick();
    expect(save).not.toHaveBeenCalled();
  });

  it('reports a failure rather than retrying forever', async () => {
    const save = vi.fn(async () => {
      throw new Error('volume went away');
    });
    const onError = vi.fn();
    const timer = manualTimer();
    const a = createAutosaver({ save, onError, ...timer });
    a.notify(doc());
    await timer.tick();
    expect(onError).toHaveBeenCalledTimes(1);
    // Nothing rescheduled itself: a file save that failed may have failed for
    // good, and a retry loop against a vanished volume writes nothing forever.
    await timer.tick();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flushes on demand, so a quit does not drop the pending write', async () => {
    const save = vi.fn(async () => {});
    const timer = manualTimer();
    const a = createAutosaver({ save, ...timer });
    a.notify(doc());
    await a.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('writes nothing after dispose', async () => {
    const save = vi.fn(async () => {});
    const timer = manualTimer();
    const a = createAutosaver({ save, ...timer });
    a.notify(doc());
    a.dispose();
    await a.flush();
    expect(save).not.toHaveBeenCalled();
  });
});
