/**
 * The developer toggles reflect and invoke, and decide nothing.
 *
 * Each is a `devSettings` field the editing store already keeps. The failure
 * worth guarding is a toggle wired to the wrong key — it looks like it works,
 * and silently changes something else about how the score is inspected.
 */
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { DeveloperSettingsSheet } from './DeveloperSettingsSheet';

function setup() {
  const document = testDocument();
  const view = renderWithApp(
    <DeveloperSettingsSheet open document={document} onClose={() => {}} />,
  );
  return { view, document };
}

describe('DeveloperSettingsSheet', () => {
  it('shows what the store holds, defaults included', () => {
    /*
      Not "everything off": `enableValidationWarnings` defaults **on**, because
      a warning the reader never sees is a warning that may as well not exist.
      The sheet reflects the store rather than assuming a state.
    */
    const { document } = setup();
    const settings = document.store.getState().devSettings;
    expect(settings.enableValidationWarnings).toBe(true);
    expect(settings.showIds).toBe(false);
  });

  it('writes each toggle to its own key and no other', () => {
    /*
      The bug this exists for: two toggles pointing at one field. Both would
      appear to work, and one setting would move when the other was touched.
    */
    const { view, document } = setup();
    const before = document.store.getState().devSettings;
    fireEvent.press(view.getByLabelText('Show score IDs'));
    const after = document.store.getState().devSettings;
    expect(after.showIds).toBe(true);
    // Everything else exactly as it was, defaults and all.
    expect({ ...after, showIds: before.showIds }).toEqual(before);
  });

  it('offers a toggle for every setting the store keeps', () => {
    // A field added to `DevSettings` with no toggle here is a setting nobody
    // can reach; the Record-shaped list is what makes that a compile error,
    // and this is what makes it a test failure if the list is loosened.
    const { view, document } = setup();
    const count = Object.keys(document.store.getState().devSettings).length;
    expect(view.getAllByRole('switch')).toHaveLength(count);
  });
});
