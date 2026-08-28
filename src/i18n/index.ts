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
