/**
 * Every key music_types hands this app to label a vocabulary with has words in
 * both languages.
 *
 * `keys-exist.test.ts` scans `t('…')` calls and cannot see a key held in a
 * table, which is exactly what these are — and a key missing from *both*
 * locales is one `locale-parity` cannot see either, since two locales agreeing
 * that a key does not exist is perfectly consistent.
 *
 * Both tables used to be declared in this app *and* in music_app, which is why
 * this test once only knew about clefs: they now come from music_types, so what
 * is left to check here is that this app's bundles answer them.
 */
import { describe, expect, it } from 'vitest';
import { CLEF_OPTIONS, THEME_MODE_OPTIONS } from '@sudobility/music_types';
import en from './locales/en.json';
import zh from './locales/zh.json';

const lookup = (strings: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      strings,
    );

describe.each([
  ['en', en],
  ['zh', zh],
] as const)('shared label keys (%s)', (_lang, strings) => {
  it.each([
    ['clef', CLEF_OPTIONS],
    ['theme mode', THEME_MODE_OPTIONS],
  ])('resolve for every %s', (_what, options) => {
    const missing = options
      .map(option => option.labelKey)
      .filter(key => typeof lookup(strings, key) !== 'string');
    expect(missing).toEqual([]);
  });
});
