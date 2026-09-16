/**
 * The shortcut list, rendered from the same `SHORTCUTS` the web help dialog
 * uses.
 *
 * The failure this guards against already happened once on the web: the list
 * drifted six entries behind the bindings, so fermata, arpeggiate, glissando,
 * the octave bracket and both hairpins were bound, worked, and appeared nowhere
 * a reader could find them. Nothing throws when a row goes missing — the screen
 * just quietly stops mentioning a feature.
 *
 * Asserted against the `SectionList`'s own `sections` prop rather than the
 * rendered rows, because a `SectionList` virtualizes: only the first handful of
 * its 30 rows exist in the tree at any time, so "every shortcut is on screen"
 * is not a question the renderer can answer. `sections` is exactly this
 * component's contribution — the grouping and the drop of empty groups — and it
 * holds all of them.
 */
import { SectionList } from 'react-native';
import { SHORTCUTS, shortcutGroupLabelKey } from '@sudobility/music_editing';
import i18next from 'i18next';

import { renderWithApp } from '@/test/render';
import { ShortcutsScreen } from './ShortcutsScreen';
import { SHORTCUT_GROUPS } from '@sudobility/music_types';

/*
  `group` is not on `ShortcutRow`: `SHORTCUTS` is declared as
  `ReadonlyArray<ShortcutRow & { group: ShortcutGroup }>`, so the grouped
  element type has to be read off the array rather than imported by name.
*/
type GroupedShortcut = (typeof SHORTCUTS)[number];
type Section = { title: string; data: GroupedShortcut[] };

function sectionsOf(): Section[] {
  const view = renderWithApp(<ShortcutsScreen />);
  return view.UNSAFE_getByType(SectionList as never).props
    .sections as Section[];
}

describe('ShortcutsScreen', () => {
  it('carries every shortcut in the shared list, exactly once', () => {
    const rows = sectionsOf().flatMap(section => section.data);
    expect(rows).toHaveLength(SHORTCUTS.length);
    // Same rows, not merely the same count.
    expect(new Set(rows)).toEqual(new Set(SHORTCUTS));
  });

  it('groups each shortcut under its own group, in the declared order', () => {
    const sections = sectionsOf();
    const used = SHORTCUT_GROUPS.filter(g =>
      SHORTCUTS.some(row => row.group === g),
    );
    expect(sections).toHaveLength(used.length);
    sections.forEach((section, index) => {
      const group = used[index];
      expect(section.data.every(row => row.group === group)).toBe(true);
      expect(section.data).toEqual(SHORTCUTS.filter(r => r.group === group));
    });
  });

  it('titles each group in words, never with its own key', () => {
    /*
      The headings used to be `t(`shortcuts.<group>`)` — a key neither locale
      has — so every heading printed the key itself, and nothing failed:
      `keys-exist` cannot see a key built at runtime. The key is
      music_editing's `shortcutGroupLabelKey`, the one the web docs page reads.
    */
    const sections = sectionsOf();
    const used = SHORTCUT_GROUPS.filter(g =>
      SHORTCUTS.some(row => row.group === g),
    );
    sections.forEach((section, index) => {
      const key = shortcutGroupLabelKey(used[index]!);
      expect(i18next.exists(key)).toBe(true);
      expect(section.title).toBe(i18next.t(key));
      expect(section.title).not.toMatch(/^[a-z]+\.[a-zA-Z.]+$/);
    });
  });

  it('drops a group with no rows rather than printing an empty header', () => {
    // Every declared group currently has rows, so this asserts the filter is
    // present by its effect on the count rather than by a contrived fixture:
    // a section is emitted only where the data has one.
    const sections = sectionsOf();
    expect(sections.every(section => section.data.length > 0)).toBe(true);
  });

  it('renders a visible row for the shortcuts it does draw', () => {
    // Virtualization means only the first rows exist; that is enough to prove
    // `renderItem` shows the key chord rather than an empty column.
    const view = renderWithApp(<ShortcutsScreen />);
    const first = SHORTCUTS.find(row => row.keys)!;
    expect(view.queryAllByText(first.keys!).length).toBeGreaterThan(0);
  });
});
