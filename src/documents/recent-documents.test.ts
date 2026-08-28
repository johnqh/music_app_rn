import { describe, expect, it } from 'vitest';
import {
  RECENT_LIMIT,
  forgetRecent,
  loadRecent,
  noteOpened,
} from './recent-documents.js';
import type { KeyValueStore, RecentDocument } from './recent-documents.js';

function memoryStore(seed?: string): KeyValueStore & { value: string | null } {
  const state = { value: seed ?? null };
  return {
    get value() {
      return state.value;
    },
    getItem: async () => state.value,
    setItem: async (_k, v) => {
      state.value = v;
    },
  };
}

function entry(n: number): RecentDocument {
  return {
    uri: `/docs/${n}.moosiac`,
    title: `Doc ${n}`,
    handle: `/docs/${n}.moosiac`,
    openedAt: n,
  };
}

describe('recent documents', () => {
  it('is empty before anything is opened', async () => {
    expect(await loadRecent(memoryStore())).toEqual([]);
  });

  it('puts the most recent first', async () => {
    const store = memoryStore();
    await noteOpened(store, entry(1));
    const list = await noteOpened(store, entry(2));
    expect(list.map(e => e.title)).toEqual(['Doc 2', 'Doc 1']);
  });

  it('moves a document already known to the front rather than repeating it', async () => {
    const store = memoryStore();
    await noteOpened(store, entry(1));
    await noteOpened(store, entry(2));
    const list = await noteOpened(store, { ...entry(1), openedAt: 3 });
    expect(list.map(e => e.title)).toEqual(['Doc 1', 'Doc 2']);
    expect(list).toHaveLength(2);
  });

  it('keeps the list short', async () => {
    const store = memoryStore();
    for (let n = 0; n < RECENT_LIMIT + 5; n += 1)
      await noteOpened(store, entry(n));
    const list = await loadRecent(store);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0].title).toBe(`Doc ${RECENT_LIMIT + 4}`);
  });

  it('forgets a file that has gone away', async () => {
    const store = memoryStore();
    await noteOpened(store, entry(1));
    await noteOpened(store, entry(2));
    const list = await forgetRecent(store, '/docs/1.moosiac');
    expect(list.map(e => e.title)).toEqual(['Doc 2']);
  });

  it('treats unreadable stored state as empty rather than throwing at start-up', async () => {
    expect(await loadRecent(memoryStore('not json'))).toEqual([]);
    expect(await loadRecent(memoryStore('{"not":"an array"}'))).toEqual([]);
  });

  it('drops entries an older build wrote in another shape', async () => {
    const store = memoryStore(JSON.stringify([{ uri: '/a' }, entry(1)]));
    const list = await loadRecent(store);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Doc 1');
  });
});
