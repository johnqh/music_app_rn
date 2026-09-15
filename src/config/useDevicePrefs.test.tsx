/**
 * A theme chosen before device prefs existed survives the move to them.
 *
 * The theme used to be written under a key of its own, `moosiac.themeMode`,
 * through `createKeyValueStore()` — AsyncStorage with the key as given. Device
 * prefs are one object now, and music_lib's `loadPrefs` reads the old key as a
 * fallback when that object has no theme. The fallback can only find it if the
 * storage handed to `bindDevicePrefs` is the **same** storage the old key was
 * written to, with no prefix or namespace of its own; this pins the wiring the
 * composition root uses (`App.tsx` binds `devicePrefs` to
 * `createKeyValueStore()`), so a reader who picked dark keeps dark.
 *
 * A `.tsx` for jest rather than a vitest `.ts`: AsyncStorage is a native module
 * and only jest's setup maps it to the package's in-memory mock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LEGACY_THEME_MODE_KEY,
  bindDevicePrefs,
  createDevicePrefsStore,
} from '@sudobility/music_lib';
import { createKeyValueStore } from '@/documents/rn-key-value';

describe('device prefs over the app key-value store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reads the theme the old preference module wrote', async () => {
    // Exactly what `theme-preference.ts` did: the raw key, the raw value.
    expect(LEGACY_THEME_MODE_KEY).toBe('moosiac.themeMode');
    await createKeyValueStore().setItem('moosiac.themeMode', 'dark');

    const prefs = createDevicePrefsStore();
    const binding = bindDevicePrefs(prefs, createKeyValueStore());
    await binding.ready;

    expect(prefs.getState().themeMode).toBe('dark');
    binding.unbind();
  });

  it('follows the system when nothing was ever stored', async () => {
    const prefs = createDevicePrefsStore();
    const binding = bindDevicePrefs(prefs, createKeyValueStore());
    await binding.ready;
    expect(prefs.getState().themeMode).toBe('system');
    binding.unbind();
  });
});
