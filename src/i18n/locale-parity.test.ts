/**
 * A missing translation is invisible: i18next falls back to English, which
 * looks like a working app until a Chinese reader hits it. So both halves are
 * pinned — the same keys in both files, and every zh string actually
 * containing CJK. Key parity alone passes happily when English was copied
 * across as a placeholder, which is exactly how 42 strings shipped
 * untranslated in the web app.
 */
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import zh from './locales/zh.json';
import { languageFor } from './index.js';

function flatten(o: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

/**
 * The same in both on purpose.
 *
 * A Chinese reader looking for the MIDI export is looking for the word MIDI.
 * The web app's parity test makes the same allowance for the same entries; a
 * value with no CJK and no Latin word at all (punctuation, a number) is fine
 * anywhere and is filtered below rather than listed here.
 */
const SHARED_BY_DESIGN = new Set([
  'app.name',
  'docs.formats.name.midi',
  'docs.formats.name.musicxml',
  'editor.midi',
  'editor.musicXml',
  // A paper size's name; the web's locale lists it as shared by design too.
  'print.paperA4',
  'settings.language_en',
  'settings.language_zh',
]);

describe('locales', () => {
  it('define exactly the same keys', () => {
    expect(Object.keys(flatten(en)).sort()).toEqual(
      Object.keys(flatten(zh)).sort(),
    );
  });

  it('actually translate the Chinese strings', () => {
    const zhFlat = flatten(zh);
    for (const [key, value] of Object.entries(zhFlat)) {
      if (SHARED_BY_DESIGN.has(key)) continue;
      expect(/[一-鿿]/.test(value), `${key} has no CJK: ${value}`).toBe(true);
    }
  });
});

/**
 * The resolution rule itself is music_types' `preferredLanguage` and is tested
 * there, since both apps call it. What is left here is that this app hands it
 * this build's list — and the case that rule was brought in to fix.
 */
describe('languageFor', () => {
  it("follows the device until the reader chooses, then keeps the reader's choice", () => {
    expect(languageFor(null, ['zh-Hans-CN'])).toBe('zh');
    expect(languageFor('en', ['zh-Hans-CN'])).toBe('en');
  });

  it('reads the device tags, and falls back to English', () => {
    expect(languageFor(null, ['zh-Hans-CN', 'en-US'])).toBe('zh');
    expect(languageFor(null, ['en-GB'])).toBe('en');
    expect(languageFor(null, ['fr-FR'])).toBe('en');
    expect(languageFor(null, [])).toBe('en');
  });

  it('ignores a stored language this build does not ship', () => {
    expect(languageFor('fr', ['zh-TW'])).toBe('zh');
  });

  it('keeps a stored regional or scripted tag, which it used to drop', () => {
    /*
      A stored `zh-Hans` matched no entry in `SUPPORTED_LANGUAGES` when the
      comparison was whole-tag, so it fell through to the device — and a reader
      who had chosen Chinese on an English phone got English back.
    */
    expect(languageFor('zh-Hans', ['en-US'])).toBe('zh');
    expect(languageFor('zh-Hant-TW', ['en-US'])).toBe('zh');
    expect(languageFor('en-GB', ['zh-CN'])).toBe('en');
  });
});
