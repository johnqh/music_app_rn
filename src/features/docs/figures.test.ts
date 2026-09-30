/**
 * The figure table, the asset list and the files on disk describe the same
 * pictures.
 *
 * None of the three can see the others: the table is TypeScript, the assets
 * are `require`s only Metro resolves, and the figures are PNGs. A topic whose
 * file was never captured fails the bundle; one missing from the asset list
 * draws an empty frame, and nothing else notices.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_TOPIC_IDS } from '@sudobility/music_types';
import { DOCS_FIGURES, docsFigureLabelKey } from './figures';

const DIR = join(__dirname, '../../../assets/docs/figures');
const ASSETS = readFileSync(join(__dirname, 'figure-assets.ts'), 'utf8');

/** A PNG states its size in the first chunk: width at byte 16, height at 20. */
function pngSize(path: string): { width: number; height: number } {
  const header = readFileSync(path).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function lookup(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );
}

const withFigure = DOCS_TOPIC_IDS.filter(id => DOCS_FIGURES[id] !== null);

describe('documentation figures', () => {
  it('pictures the topics about the interface', () => {
    expect(withFigure.length).toBeGreaterThanOrEqual(10);
  });

  it.each(withFigure)('%s has a file of the size the table states', id => {
    const path = join(DIR, `${id}.png`);
    expect(existsSync(path), `${id}.png is missing`).toBe(true);
    const figure = DOCS_FIGURES[id]!;
    // Captured at twice the density it is drawn at.
    expect(pngSize(path)).toEqual({
      width: figure.width * 2,
      height: figure.height * 2,
    });
  });

  it('has no file that no topic shows', () => {
    const files = readdirSync(DIR).filter(name => name.endsWith('.png'));
    expect(files.sort()).toEqual(withFigure.map(id => `${id}.png`).sort());
  });

  it('bundles exactly the figures the table names', () => {
    const bundled = [...ASSETS.matchAll(/figures\/([a-z-]+)\.png'\)/g)].map(
      match => match[1],
    );
    expect(bundled.sort()).toEqual([...withFigure].sort());
  });

  it.each(['en', 'zh'])('describes every figure in %s', lang => {
    const bundle = JSON.parse(
      readFileSync(join(__dirname, `../../i18n/locales/${lang}.json`), 'utf8'),
    );
    for (const id of withFigure) {
      const words = lookup(bundle, docsFigureLabelKey(id));
      expect(typeof words, docsFigureLabelKey(id)).toBe('string');
    }
  });
});
