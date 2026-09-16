/**
 * Every screen in the navigator has something that navigates to it.
 *
 * A `Stack.Screen` with no `navigate` anywhere is not a compile error, not a
 * lint error and not a failing render — it is a room with no door, and the only
 * way to find one is to look for it. `Dashboard` was exactly that: the projects
 * list, and with it New Project, Import MIDI, Import MusicXML, Import Module,
 * Import Audio and every server project, sat in the stack with nothing in the
 * app pointing at it. The Mac reached all of that through its File menu, which
 * iOS and Android do not have — so on a phone the only document that could ever
 * be opened was the scratch one made at launch.
 *
 * Source-scanned rather than render-driven, for the reason `accessible-names`
 * is: a rendered test proves one screen is reachable, where this proves there
 * is no screen that is not.
 *
 * `Editor` is the stack's `initialRouteName`, so it is reachable by being where
 * the app starts; it is also navigated to from the dashboard, so it needs no
 * exemption. Anything genuinely meant to be pushed only by a deep link would go
 * in `REACHED_BY_LINK` with a reason.
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

/**
 * Screens nothing in this app navigates to on purpose.
 *
 * `Published` is opened by `useOpenLink` from a `moosiac://` URL rather than by
 * a control, which is what a published-score link *is*.
 */
const REACHED_BY_LINK = new Set(['Published']);

describe('navigator screens', () => {
  it('are all reachable', () => {
    const navigation = readFileSync('src/app/Navigation.tsx', 'utf8');
    const declared = [...navigation.matchAll(/<Stack\.Screen\s+name="(\w+)"/g)]
      .map(match => match[1]!)
      .filter(name => !REACHED_BY_LINK.has(name));
    expect(declared.length).toBeGreaterThan(5);

    const sources = globSync('src/**/*.{ts,tsx}')
      .filter(file => !file.includes('.test.'))
      .map(file => readFileSync(file, 'utf8'))
      .join('\n');

    const unreachable = declared.filter(name => {
      const initial = new RegExp(`initialRouteName=["']${name}["']`).test(
        navigation,
      );
      // `navigate('X')` or `navigate('X', …)`, from anywhere in the app.
      const navigated = new RegExp(`navigate\\(\\s*['"]${name}['"]`).test(
        sources,
      );
      return !initial && !navigated;
    });

    expect(unreachable).toEqual([]);
  });
});
