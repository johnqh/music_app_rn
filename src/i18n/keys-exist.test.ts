/**
 * Every key the code asks for is a key the locales define.
 *
 * i18next answers a missing key with the key itself, so a typo renders as
 * `document.saev` on screen and fails nothing — the same class of invisible
 * failure as an untranslated string, and not caught by locale parity, which
 * only compares the two files with each other.
 *
 * Source-scanned rather than fixture-driven: a fixture proves one key resolves,
 * where this proves there is no key that cannot.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from './locales/en.json';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function flatten(o: unknown, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.add(key);
    else for (const nested of flatten(v, key)) out.add(nested);
  }
  return out;
}

describe('translation keys', () => {
  it('are all defined in the locales', () => {
    const defined = flatten(en);
    const used = new Set<string>();
    for (const file of walk(join(__dirname, '..'))) {
      if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      const source = readFileSync(file, 'utf8');
      // `t('a.b')` and `i18next.t('a.b')`, which is how both are written here.
      for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        used.add(match[1]);
      }
    }
    /*
      A key passed a `count` resolves to its plural forms rather than to itself:
      i18next looks up `editor.noSuchBar_one` / `_other` and never
      `editor.noSuchBar`. Requiring the bare key would force a third entry that
      nothing can ever read.
    */
    const definedOrPlural = (key: string): boolean =>
      defined.has(key) ||
      defined.has(`${key}_one`) ||
      defined.has(`${key}_other`);

    // `command.*` comes from music_editing's own key list, which this app
    // forwards wholesale rather than enumerating; it is checked upstream.
    const missing = [...used].filter(
      key => !definedOrPlural(key) && !key.startsWith('command.'),
    );
    expect(missing.sort()).toEqual([]);
  });
});
