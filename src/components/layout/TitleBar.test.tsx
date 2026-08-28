/**
 * The title bar.
 *
 * Its rule is that a control is **absent rather than dead** when it cannot
 * work: Generate, Snapshots and Print each depend on something the document may
 * not have — a project row, or a print service — and a button that is present
 * and refuses invites a tap that can only fail.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { TitleBar } from './TitleBar';

function setup(overrides: Partial<Parameters<typeof TitleBar>[0]> = {}) {
  const document = testDocument({ title: 'Quartet' });
  const onSave = jest.fn();
  const onExport = jest.fn();
  const view = renderWithApp(
    <TitleBar
      document={document}
      onSave={onSave}
      onExport={onExport}
      {...overrides}
    />,
  );
  return { view, document, onSave, onExport };
}

describe('TitleBar', () => {
  it('shows the document name', () => {
    expect(setup().view.getByText('Quartet')).toBeTruthy();
  });

  it('omits Generate for a document with no project behind it', () => {
    // A local file has no row on the server for a job to write back to.
    expect(setup().view.queryByLabelText(/generate/i)).toBeNull();
  });

  it('omits Snapshots for the same reason', () => {
    expect(setup().view.queryByLabelText(/snapshot/i)).toBeNull();
  });

  it('omits Print on a build with no print service', () => {
    expect(setup().view.queryByLabelText(/print/i)).toBeNull();
  });

  it('offers each one when its prerequisite is there', () => {
    const onGenerate = jest.fn();
    const onSnapshots = jest.fn();
    const onPrint = jest.fn();
    const { view } = setup({ onGenerate, onSnapshots, onPrint });
    fireEvent.press(view.getByLabelText(/generate/i));
    fireEvent.press(view.getByLabelText(/snapshot/i));
    fireEvent.press(view.getByLabelText(/print/i));
    expect(onGenerate).toHaveBeenCalled();
    expect(onSnapshots).toHaveBeenCalled();
    expect(onPrint).toHaveBeenCalled();
  });

  it('disables undo with no history rather than hiding it', () => {
    /*
      Unlike the three above, undo is always *applicable* — it is just empty.
      A disabled control says "there is nothing to undo"; an absent one says
      "this app cannot undo", which is a different and wrong claim.
    */
    const { view } = setup();
    expect(view.getByLabelText(/undo/i).props.accessibilityState.disabled).toBe(
      true,
    );
  });
});
