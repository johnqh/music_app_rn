/**
 * The vendored instrument packs, checked against the parser that reads them.
 *
 * This is the test that would have caught a real bug automatically. The
 * percussion packs shipped for months in a format `parseSamplePack` cannot
 * read — `B1: 'data:...'` where it requires `"B1": "data:..."` — so every kit
 * parsed to *zero samples*. Nothing threw at build time, nothing failed a
 * typecheck, and the only symptom would have been drums that make no sound.
 * They were stale output from an older `build-percussion-packs.mjs`; the
 * current one is correct, which is precisely why a check on the *artifacts*
 * rather than on the generator is the one that matters.
 *
 * Runs under vitest because it is plain file reading — no React Native needed
 * to know whether 314MB of assets are well-formed.
 *
 * Skipped rather than failed when the directory is empty: `assets/soundfont/`
 * is gitignored (it is 314MB), so a fresh clone legitimately has none until
 * `bun run soundfont` is run. A skip says "not checked"; a failure here would
 * cry wolf on every clean checkout and quickly be ignored.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', '..', 'assets', 'soundfont');

/* The two rules `parseSamplePack` applies, restated as the artifacts' contract. */
const HEADER = /MIDI\.Soundfont\.([A-Za-z0-9_]+)\s*=/;
const ENTRY = /"([A-Ga-g][#b]?-?\d+)"\s*:\s*"(data:audio\/[^"]+)"/g;

const packs = existsSync(DIR)
  ? readdirSync(DIR).filter(f => f.endsWith('-mp3.js'))
  : [];

describe.skipIf(packs.length === 0)('vendored soundfont packs', () => {
  it('every pack declares the instrument it is for', () => {
    const missing = packs.filter(
      f => !HEADER.test(readFileSync(join(DIR, f), 'utf8')),
    );
    expect(missing).toEqual([]);
  });

  it('every pack yields samples — none parses to nothing', () => {
    // The silent failure: a pack with no entries is an instrument that makes no
    // sound, and neither the build nor the engine says a word about it.
    const empty = packs.filter(f => {
      const body = readFileSync(join(DIR, f), 'utf8');
      return [...body.matchAll(ENTRY)].length === 0;
    });
    expect(empty).toEqual([]);
  });

  it('covers the melodic set and the drum kits', () => {
    const melodic = packs.filter(f => !f.startsWith('percussion_'));
    const drums = packs.filter(f => f.startsWith('percussion_'));
    // 128 General MIDI programs; the kits are the eight addresses GM defines.
    expect(melodic).toHaveLength(128);
    expect(drums.length).toBeGreaterThan(0);
  });

  it('ships the attribution CC-BY 3.0 requires', () => {
    // The licence obliges the app to carry the credit, not merely to link it.
    expect(existsSync(join(DIR, 'LICENSE.md'))).toBe(true);
  });
});
