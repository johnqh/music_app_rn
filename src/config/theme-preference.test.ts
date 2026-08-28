import { describe, expect, it } from 'vitest';
import { loadThemeMode, saveThemeMode } from './theme-preference.js';
import type { KeyValueStore } from '@/documents/recent-documents';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return {
    getItem: async key => map.get(key) ?? null,
    setItem: async (key, value) => void map.set(key, value),
  };
}

describe('the theme preference', () => {
  it('survives a relaunch', async () => {
    // The whole point: a preference that resets every launch looks broken
    // rather than absent.
    const store = memoryStore();
    await saveThemeMode(store, 'dark');
    expect(await loadThemeMode(store)).toBe('dark');
  });

  it('remembers going back to following the system', async () => {
    const store = memoryStore();
    await saveThemeMode(store, 'dark');
    await saveThemeMode(store, 'system');
    expect(await loadThemeMode(store)).toBe('system');
  });

  it('follows the system when nothing was stored', async () => {
    expect(await loadThemeMode(memoryStore())).toBe('system');
  });

  it('falls back rather than throwing on a value it does not know', async () => {
    // A stored preference is not input to trust: an older or newer build may
    // have written something this one has never heard of.
    const store = memoryStore({ 'moosiac.themeMode': 'sepia' });
    expect(await loadThemeMode(store)).toBe('system');
  });
});
