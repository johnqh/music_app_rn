/**
 * What is wrong with the score, and what Fix all honestly claims.
 *
 * Several validation rules — how many notes sound at once, most obviously —
 * have no repair that is not a guess about the music. So "fixed everything"
 * over a list that still has entries in it is a lie the reader can see, and the
 * sheet stays open when anything remains.
 */
import { jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';
import { IssuesSheet } from './IssuesSheet';

function setup() {
  const document = testDocument();
  const onClose = jest.fn();
  const view = renderWithApp(
    <IssuesSheet open document={document} onClose={onClose} />,
  );
  return { view, document, onClose };
}

describe('IssuesSheet', () => {
  it('says so plainly when the score is clean', () => {
    const { view } = setup();
    expect(view.getByText('No issues.')).toBeTruthy();
  });

  it('offers no repair when there is nothing to repair', () => {
    // A live Fix all over an empty list is a button that can only disappoint.
    const { view } = setup();
    const fix = view.getByRole('button', { name: 'Fix all' });
    expect(fix.props.accessibilityState.disabled).toBe(true);
  });

  it("lists what the store reports, in the store's words", () => {
    /*
      The messages come from `validateScore`, translated by the host through
      `EditingCopy`. Nothing here composes a sentence — a second wording is a
      second thing to keep in step.
    */
    const { view, document } = setup();
    act(() => {
      const score = document.store.getState().score!;
      // Take a bar's rest away so the measure no longer adds up.
      const shortened = {
        ...score,
        tracks: score.tracks.map(track => ({
          ...track,
          measures: track.measures.map((m, i) =>
            i === 0 ? { ...m, voices: [{ ...m.voices[0], events: [] }] } : m,
          ),
        })),
      };
      document.store.getState().setScore(shortened, { resetHistory: true });
    });
    const issues = document.store.getState().validationIssues;
    expect(issues.length).toBeGreaterThan(0);
    expect(view.getByText(issues[0].message)).toBeTruthy();
  });
});
