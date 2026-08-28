/**
 * Every `Select` states its own accessible name.
 *
 * A select's visible label sits *outside* it, so without `accessibilityLabel` a
 * screen reader announces only the current value — "English", with no word for
 * what is English; "Treble", with no word for what is treble. It is invisible
 * on screen and invisible in review, which is why five of them shipped that way
 * and were found by a test reaching for one by name rather than by anybody
 * looking.
 *
 * Source-scanned rather than render-driven: a rendered test proves one select
 * is named, where this proves there is no select that is not.
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

describe('Select controls', () => {
  it('all carry an accessible name', () => {
    const offenders = globSync('src/**/*.tsx')
      .filter(file => !file.includes('.test.'))
      .flatMap(file => {
        const source = readFileSync(file, 'utf8');
        return [...source.matchAll(/<Select\b[^>]*?\/?>/gs)]
          .filter(match => !match[0].includes('accessibilityLabel'))
          .map(
            match =>
              `${file}:${source.slice(0, match.index).split('\n').length}`,
          );
      });

    expect(offenders).toEqual([]);
  });
});
