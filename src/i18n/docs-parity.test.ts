/**
 * The documentation reads the same in both apps.
 *
 * `DOCS_TOPICS` moved into `music_lib` so the *structure* is shared, but
 * the prose stays in each host's locale files — the libraries hold no strings
 * in any language, and that rule is what lets a Chinese reader get Chinese
 * documentation rather than the library's idea of English.
 *
 * The consequence is two copies of the prose, which will drift the moment one
 * is edited — silently, because both apps still render. So the copies are
 * pinned against each other here: if the web app's documentation changes, this
 * fails until the native app's is brought across.
 *
 * `seeShortcutsScreen` is the one native-only key, because the web shows its
 * shortcut table inline and this app has a screen for it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_TOPICS } from '@sudobility/music_lib';

const WEB_LOCALES = join(__dirname, '../../../music_app/public/locales');

/** Keys this app adds because its documentation is navigated differently. */
const NATIVE_ONLY = new Set(['seeShortcutsScreen']);

function load(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function flatten(o: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

describe.each(['en', 'zh'])('documentation prose (%s)', lang => {
  it('matches the web app word for word', () => {
    const web = flatten(load(join(WEB_LOCALES, lang, 'app.json')).docs);
    const native = flatten(load(join(__dirname, `locales/${lang}.json`)).docs);
    for (const key of Object.keys(native)) {
      if (NATIVE_ONLY.has(key)) continue;
      expect(native[key], `docs.${key}`).toBe(web[key]);
    }
    // And nothing the web documents is missing here.
    for (const key of Object.keys(web)) {
      expect(native[key], `docs.${key} is missing`).toBeDefined();
    }
  });
});

describe('documentation structure', () => {
  it('has a translation for every key the shared topics name', () => {
    const native = load(join(__dirname, 'locales/en.json'));
    const flat = flatten(native);
    const missing: string[] = [];
    for (const topic of DOCS_TOPICS) {
      for (const key of [topic.title, topic.summary]) {
        if (flat[key] === undefined) missing.push(key);
      }
      for (const section of topic.sections) {
        if (flat[section.heading] === undefined) missing.push(section.heading);
        for (const body of section.body) {
          if (flat[body] === undefined) missing.push(body);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
