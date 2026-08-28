/**
 * Remembering which colour scheme the reader asked for.
 *
 * The *choice* lives in the editing store (`ui-slice`'s `themeMode`), which is
 * where every app in this family keeps it. What lives here is the part that is
 * a property of the device rather than of a score: writing it down so it
 * survives a relaunch. A preference that resets every launch is worse than no
 * preference at all — it looks broken rather than absent.
 *
 * `system` is the default and is stored like any other value, so "I changed my
 * mind, follow the OS again" is remembered too.
 */
import { THEME_MODES } from '@sudobility/music_editing';
import type { ThemeMode } from '@sudobility/music_editing';
import type { KeyValueStore } from '@/documents/recent-documents';

const KEY = 'moosiac.themeMode';

export async function loadThemeMode(store: KeyValueStore): Promise<ThemeMode> {
  const raw = await store.getItem(KEY);
  // Anything unrecognised — a value an older or newer build wrote — falls back
  // rather than throwing. A stored preference is not input to trust.
  return THEME_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'system';
}

export async function saveThemeMode(
  store: KeyValueStore,
  mode: ThemeMode,
): Promise<void> {
  await store.setItem(KEY, mode);
}
