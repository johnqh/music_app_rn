/**
 * The instrument table in the documentation.
 *
 * Its rows are music_types' `gmInstrumentRows`, the web reference's own call,
 * so the formatting and the filter are tested there. What is worth pinning here
 * is that the table renders *all* of them — a table that quietly showed 120 of
 * the 128 General MIDI programs would look completely normal to a reader, who
 * would conclude the missing instruments do not exist — and that it carries
 * the cells the prose above it promises: the compass, and how far to trust it.
 *
 * A plain `View` map rather than a `SectionList`, so nothing is virtualized
 * away and every row really is in the tree.
 */
import i18next from 'i18next';
import { fireEvent } from '@testing-library/react-native';
import { gmInstrumentRows } from '@sudobility/music_types';
import { renderWithApp } from '@/test/render';
import { InstrumentReference } from './InstrumentReference';

describe('InstrumentReference', () => {
  it('lists every General MIDI program', () => {
    const view = renderWithApp(<InstrumentReference />);
    const rows = gmInstrumentRows('');
    expect(rows).toHaveLength(128);
    const missing = rows
      .filter(
        row => view.queryAllByText(`${row.program}  ${row.name}`).length === 0,
      )
      .map(row => row.name);
    expect(missing).toEqual([]);
  });

  it('shows the compass and how far to trust it, in words', () => {
    const view = renderWithApp(<InstrumentReference />);
    const first = gmInstrumentRows('')[0]!;
    expect(view.queryAllByText(new RegExp(first.range)).length).toBeGreaterThan(
      0,
    );
    // The basis through its key, never printed as the key itself.
    expect(
      view.queryAllByText(i18next.t(first.basisKey)).length,
    ).toBeGreaterThan(0);
    expect(view.queryAllByText(first.basisKey)).toHaveLength(0);
  });

  it('narrows to what was searched for', () => {
    const view = renderWithApp(<InstrumentReference />);
    fireEvent.changeText(
      view.getByLabelText(i18next.t('docs.instruments.search')),
      'trumpet',
    );
    const expected = gmInstrumentRows('trumpet');
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(128);
    expect(
      view.getByText(
        i18next.t('docs.instruments.showing', { count: expected.length }),
      ),
    ).toBeTruthy();
  });
});
