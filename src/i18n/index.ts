/**
 * Translations, initialised once at start-up.
 *
 * Bundled rather than fetched, unlike the web app: a native app has its
 * strings on disk already, and a locale that arrives over the network is a
 * blank screen on a train. The device's language picks the locale, falling
 * back to English for anything that is not Chinese.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Chinese for any zh tag; English otherwise. */
export function resolveLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    if (tag.toLowerCase().startsWith('zh')) return 'zh';
    if (tag.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

export function initializeI18n(deviceTags: readonly string[]): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: { en: { translation: en }, zh: { translation: zh } },
      lng: resolveLanguage(deviceTags),
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  }
  return i18next;
}

/** The part of the device prefs store the language follows. */
type LanguagePref = {
  getState(): { language: string | null };
  subscribe(listener: () => void): () => void;
};

/**
 * The language in force: the reader's choice, else the device's.
 *
 * `null` means "follow the device", which is the default and is what a reader
 * who never opened Settings gets — so a phone set to Chinese opens in Chinese.
 * A choice made in Settings is a device pref, remembered across launches; it
 * used to be `i18n.changeLanguage` alone, which lasted until the app was next
 * killed. A stored language this build does not ship is ignored rather than
 * applied, since i18next would silently fall back to English for it.
 */
export function languageFor(
  language: string | null,
  deviceTags: readonly string[],
): Language {
  return SUPPORTED_LANGUAGES.includes(language as Language)
    ? (language as Language)
    : resolveLanguage(deviceTags);
}

/** Keeps i18next on the language the prefs store says. Returns an unsubscribe. */
export function followLanguagePref(
  prefs: LanguagePref,
  deviceTags: readonly string[],
): () => void {
  const apply = () => {
    const next = languageFor(prefs.getState().language, deviceTags);
    if (i18next.language !== next) void i18next.changeLanguage(next);
  };
  apply();
  return prefs.subscribe(apply);
}
