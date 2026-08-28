/**
 * Every `@sudobility` package this app imports must be reachable from CommonJS.
 *
 * An `exports` map whose condition object carries `import` but no `default`
 * (or `require`) resolves for a bundler and fails for a CJS resolver — which is
 * what jest is. The symptom is "Cannot find module", pointing at the importer
 * rather than the package, and it is invisible to Metro, to Vite and to
 * `tsc`, all of which resolve the `import` condition happily.
 *
 * It has bitten four packages so far — music_editing, music_drawing, types,
 * music_io — plus music_player's nested `react-native`/`default` pair, where
 * the *inner* object was the one missing it. Hence a check rather than a habit.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/** Condition keys inside an `exports` entry, by the path that reaches them. */
function unreachable(entry: unknown, path: string): string[] {
  if (!entry || typeof entry !== 'object') return [];
  const record = entry as Record<string, unknown>;
  const out = Object.entries(record).flatMap(([key, value]) =>
    unreachable(value, `${path}/${key}`),
  );
  // `types` is not a runtime condition, so an entry of only `types` + `import`
  // still has nothing a CJS resolver can take.
  if ('import' in record && !('default' in record) && !('require' in record)) {
    out.push(path);
  }
  return out;
}

const PACKAGES = [
  'music_types',
  'music_codecs',
  'music_drawing',
  'music_editing',
  'music_client',
  'music_io',
  'music_lib',
  'music_player',
];

describe('package exports', () => {
  it('are reachable from a CommonJS resolver', () => {
    const offenders = PACKAGES.flatMap(name => {
      const pkg = JSON.parse(
        readFileSync(`node_modules/@sudobility/${name}/package.json`, 'utf8'),
      ) as { exports?: Record<string, unknown> };
      return Object.entries(pkg.exports ?? {}).flatMap(([subpath, entry]) =>
        unreachable(entry, `${name} ${subpath}`),
      );
    });

    expect(offenders).toEqual([]);
  });
});
