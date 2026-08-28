/**
 * The instrument table in the documentation.
 *
 * The point of building it from `INSTRUMENT_OPTIONS` is that it cannot go
 * stale — prose about a table is a copy of that table, and the copy is wrong
 * the first time an instrument is renamed or regrouped. So the test worth
 * having is not "it renders" but "it renders *all* of them": a table that
 * quietly showed 120 of the 128 General MIDI programs would look completely
 * normal to a reader, who would simply conclude the missing instruments do not
 * exist.
 *
 * Unlike the shortcut list this is a plain `View` map rather than a
 * `SectionList`, so nothing is virtualized away and every row really is in the
 * tree.
 */
import { INSTRUMENT_OPTIONS } from '@sudobility/music_types';
import { renderWithApp } from '@/test/render';
import { InstrumentReference } from './InstrumentReference';

describe('InstrumentReference', () => {
  it('lists every General MIDI program', () => {
    const view = renderWithApp(<InstrumentReference />);
    const missing = INSTRUMENT_OPTIONS.filter(
      option => view.queryAllByText(option.label).length === 0,
    ).map(option => option.label);
    expect(missing).toEqual([]);
    expect(INSTRUMENT_OPTIONS).toHaveLength(128);
  });

  it('shows the family beside each instrument', () => {
    // The family is the column that makes the table navigable; a row rendering
    // only its name loses the grouping the catalogue exists to express.
    const view = renderWithApp(<InstrumentReference />);
    // `group` is optional on an InstrumentOption, and the component renders
    // nothing for an entry without one — so only the named families are
    // assertable here.
    const families = [...new Set(INSTRUMENT_OPTIONS.map(o => o.group))].filter(
      (family): family is string => family !== undefined,
    );
    expect(families.length).toBeGreaterThan(1);
    for (const family of families) {
      expect(view.queryAllByText(family).length).toBeGreaterThan(0);
    }
  });
});
