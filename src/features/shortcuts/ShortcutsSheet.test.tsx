/**
 * The shortcut list, rendered from the same `SHORTCUTS` the web help dialog
 * uses.
 *
 * The failure this guards against already happened once on the web: the list
 * drifted six entries behind the bindings, so fermata, arpeggiate, glissando,
 * the octave bracket and both hairpins were bound, worked, and appeared nowhere
 * a reader could find them. Nothing throws when a row goes missing — the sheet
 * just quietly stops mentioning a feature.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { SHORTCUTS, shortcutGroupLabelKey } from '@sudobility/music_editing';
import { SHORTCUT_GROUPS } from '@sudobility/music_types';
import i18next from 'i18next';
import { renderWithApp } from '@/test/render';
import { ShortcutsSheet, shortcutSections } from './ShortcutsSheet';

describe('shortcutSections', () => {
  it('carries every shortcut in the shared list, exactly once', () => {
    const rows = shortcutSections().flatMap(section => section.rows);
    expect(rows).toHaveLength(SHORTCUTS.length);
    // Same rows, not merely the same count.
    expect(new Set(rows)).toEqual(new Set(SHORTCUTS));
  });

  it('groups each shortcut under its own group, in the declared order', () => {
    const sections = shortcutSections();
    const used = SHORTCUT_GROUPS.filter(g =>
      SHORTCUTS.some(row => row.group === g),
    );
    expect(sections.map(section => section.group)).toEqual(used);
    for (const section of sections) {
      expect(section.rows).toEqual(
        SHORTCUTS.filter(row => row.group === section.group),
      );
    }
  });

  it('drops a group with no rows rather than printing an empty header', () => {
    expect(shortcutSections().every(section => section.rows.length > 0)).toBe(
      true,
    );
  });
});

describe('ShortcutsSheet', () => {
  it('titles each group in words, never with its own key', () => {
    /*
      The headings used to be `t(`shortcuts.<group>`)` — a key neither locale
      has — so every heading printed the key itself, and nothing failed:
      `keys-exist` cannot see a key built at runtime.
    */
    const view = renderWithApp(<ShortcutsSheet open onClose={jest.fn()} />);
    for (const section of shortcutSections()) {
      const key = shortcutGroupLabelKey(section.group);
      expect(i18next.exists(key)).toBe(true);
      expect(view.getAllByText(i18next.t(key)).length).toBeGreaterThan(0);
    }
  });

  it('draws every row, not the first screenful', () => {
    // Drawn outright rather than virtualized, so the last shortcut in the
    // list is as present as the first.
    const view = renderWithApp(<ShortcutsSheet open onClose={jest.fn()} />);
    const withKeys = SHORTCUTS.filter(row => row.keys);
    const first = withKeys[0]!;
    const last = withKeys[withKeys.length - 1]!;
    expect(view.getAllByText(first.keys!).length).toBeGreaterThan(0);
    expect(view.getAllByText(last.keys!).length).toBeGreaterThan(0);
  });

  it('is named, and is put away by its own close control', () => {
    const onClose = jest.fn();
    const view = renderWithApp(<ShortcutsSheet open onClose={onClose} />);
    expect(view.getAllByText('Keyboard shortcuts').length).toBeGreaterThan(0);
    fireEvent.press(view.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('draws nothing while closed', () => {
    const view = renderWithApp(
      <ShortcutsSheet open={false} onClose={jest.fn()} />,
    );
    expect(view.queryByText('Keyboard shortcuts')).toBeNull();
  });
});
