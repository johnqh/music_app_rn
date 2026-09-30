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
 * `Editor` is the stack's `initialRouteName` on a desktop build and `Main` —
 * the tabs — is on iOS and Android, so each is reachable by being where the
 * app starts; the editor is also navigated to from Projects, so it needs no
 * exemption. Anything genuinely meant to be pushed only by a deep link would go
 * in `REACHED_BY_LINK` with a reason.
 *
 * **A tab is reachable by being a tab**: the bar that holds it is its door.
 * What is checked for `MainTabs` is that there are five and that every one of
 * them is also a screen of the desktop stack, which has no bar — the two
 * arrangements are of one set of routes, and a tab the desktop never heard of
 * would be a destination half the platforms cannot reach.
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
    const declared = [
      ...new Set(
        [...navigation.matchAll(/<Stack\.Screen\s+name="(\w+)"/g)].map(
          match => match[1]!,
        ),
      ),
    ].filter(name => !REACHED_BY_LINK.has(name));
    expect(declared.length).toBeGreaterThan(5);

    const sources = globSync('src/**/*.{ts,tsx}')
      .filter(file => !file.includes('.test.'))
      .map(file => readFileSync(file, 'utf8'))
      .join('\n');

    const unreachable = declared.filter(name => {
      const initial = new RegExp(`initialRouteName=["']${name}["']`).test(
        navigation,
      );
      // `navigate('X')` or `navigate('X', …)`, from anywhere in the app — or
      // `goToTab(navigation, 'X')`, which is how the five are reached from
      // beside the tabs and is a plain `navigate` where there are none.
      const navigated = new RegExp(
        `(navigate\\(|goToTab\\(\\s*\\w+,)\\s*['"]${name}['"]`,
      ).test(sources);
      return !initial && !navigated;
    });

    expect(unreachable).toEqual([]);
  });

  it('offers the same five under a tab bar as without one', () => {
    const tabs = [
      ...readFileSync('src/app/MainTabs.tsx', 'utf8').matchAll(
        /<Tab\.Screen\s+name="(\w+)"/g,
      ),
    ].map(match => match[1]!);
    expect(tabs).toEqual([
      'Dashboard',
      'Community',
      'Docs',
      'Resources',
      'Settings',
    ]);

    const stack = new Set(
      [
        ...readFileSync('src/app/Navigation.tsx', 'utf8').matchAll(
          /<Stack\.Screen\s+name="(\w+)"/g,
        ),
      ].map(match => match[1]!),
    );
    expect(tabs.filter(name => !stack.has(name))).toEqual([]);
  });
});
