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
import { languageFor, resolveLanguage } from './index.js';

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

describe('resolveLanguage', () => {
  it('reads the device tags, and falls back to English', () => {
    expect(resolveLanguage(['zh-Hans-CN', 'en-US'])).toBe('zh');
    expect(resolveLanguage(['en-GB'])).toBe('en');
    expect(resolveLanguage(['fr-FR'])).toBe('en');
    expect(resolveLanguage([])).toBe('en');
  });
});

describe('languageFor', () => {
  it("follows the device until the reader chooses, then keeps the reader's choice", () => {
    expect(languageFor(null, ['zh-Hans-CN'])).toBe('zh');
    expect(languageFor('en', ['zh-Hans-CN'])).toBe('en');
  });

  it('ignores a stored language this build does not ship', () => {
    expect(languageFor('fr', ['zh-TW'])).toBe('zh');
  });
});
