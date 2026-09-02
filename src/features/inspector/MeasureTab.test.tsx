/**
 * The Measure tab writes what its labels say.
 *
 * Every field here is a flag or an enum with a near neighbour it can be crossed
 * with — `coda` and `toCoda` are different bars, `repeatStart` and `repeatEnd`
 * are independent rather than a span, a clef change on bar 1 goes to the *track*
 * rather than the measure. All of those typecheck either way round, and all of
 * them are invisible on inspection: the score simply plays differently.
 */
import { act, fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { MeasureTab } from './MeasureTab';
import type { MusicDocument } from '@/documents/document';

/** Selects a bar by index, which is what the gutter does on a tap. */
function selectBar(document: MusicDocument, index: number) {
  act(() => {
    const score = document.store.getState().score!;
    const measure = score.tracks[0].measures[index];
    document.store.getState().selectMeasures([measure.id]);
  });
}

function setup(barIndex = 1) {
  const document = testDocument();
  selectBar(document, barIndex);
  const view = renderWithApp(<MeasureTab document={document} />);
  return { view, document };
}

function measureAt(document: MusicDocument, index: number) {
  return document.store.getState().score!.tracks[0].measures[index];
}

describe('MeasureTab', () => {
  it('sets the segno without touching the coda', () => {
    // They are separate places on purpose: the bar you leave from is not the
    // bar the coda begins at, and a bar can carry both.
    const { view, document } = setup();
    fireEvent(view.getByLabelText(/segno/i), 'valueChange', true);
    expect(measureAt(document, 1).segno).toBe(true);
    expect(measureAt(document, 1).coda).toBeUndefined();
  });

  it('sets the two repeat flags independently', () => {
    // Not a span: a `:|` with no matching `|:` repeats from the start of the
    // piece, which is a real marking rather than an error to prevent.
    const { view, document } = setup();
    fireEvent(view.getByLabelText(/repeat ends/i), 'valueChange', true);
    expect(measureAt(document, 1).repeatEnd).toBe(true);
    expect(measureAt(document, 1).repeatStart).toBeUndefined();
  });

  it('offers Inherit on a bar that is not the first', () => {
    const { view } = setup(1);
    expect(view.getByLabelText(/clef/i)).toBeTruthy();
  });

  it('parses an ending list, and clears on nonsense', () => {
    const { view, document } = setup();
    const field = view.getByLabelText(/ending/i);
    fireEvent.changeText(field, '1, 2');
    fireEvent(field, 'blur');
    expect(measureAt(document, 1).endingNumbers).toEqual([1, 2]);

    fireEvent.changeText(field, 'first time');
    fireEvent(field, 'blur');
    // Absent rather than empty: no volta is a bar with no bracket, and storing
    // `[]` would be a bracket over nothing.
    expect(measureAt(document, 1).endingNumbers ?? []).toEqual([]);
  });

  it('shows the tempo in force rather than a blank', () => {
    // Bar 2 sets no tempo of its own; the field still has to say 120.
    const { view } = setup(1);
    expect(view.getByLabelText(/tempo/i).props.value).toBe('120');
  });
});
