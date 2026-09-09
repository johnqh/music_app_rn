/**
 * Every brief the server can send has words here, in both languages.
 *
 * The presets are chosen server-side and translated host-side — the same
 * division `MusicXmlWarnings` uses, and with the same failure mode: a key the
 * server serves and this app has never heard of would render as its own id,
 * and nothing would fail, because a key missing from *both* locales is
 * perfectly consistent and `locale-parity` sees nothing wrong with it.
 *
 * Read from `SCORE_PRESET_KEYS` at runtime rather than from a list written out
 * here, because a check against drift that restates what it checks drifts too.
 */
import { describe, expect, it } from 'vitest';
import { SCORE_PRESET_KEYS } from '@sudobility/music_types';
import en from './locales/en.json';
import zh from './locales/zh.json';

const enPresets = (en as { generateScore: { preset: Record<string, string> } })
  .generateScore.preset;
const zhPresets = (zh as { generateScore: { preset: Record<string, string> } })
  .generateScore.preset;

describe('the preset briefs', () => {
  it('has an English brief for every key the server can serve', () => {
    expect([...SCORE_PRESET_KEYS].filter(key => !enPresets[key])).toEqual([]);
  });

  it('has a Chinese brief for every one of them, in Chinese', () => {
    for (const key of SCORE_PRESET_KEYS) {
      expect(zhPresets[key], key).toBeTruthy();
      expect(zhPresets[key], key).toMatch(/[一-鿿]/);
    }
  });

  it('carries no brief the server could never send', () => {
    const known = new Set<string>(SCORE_PRESET_KEYS);
    expect(Object.keys(enPresets).filter(key => !known.has(key))).toEqual([]);
  });
});
