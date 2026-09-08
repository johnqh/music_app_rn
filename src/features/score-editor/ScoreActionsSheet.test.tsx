/**
 * The long-press menu — where cut, copy, paste, clear and delete live now.
 *
 * Two things here are the whole reason it is a menu rather than four buttons on
 * the editing bar. It **names its subject**, because Delete means three
 * different edits depending on whether a track, a span of bars or a run of notes
 * is selected. And it offers **Clear beside Delete**, which the bar never did
 * because the action did not exist: a cleared bar keeps its number and its
 * markings, a deleted one takes the rest of the score up with it.
 *
 * The web app's `ScoreContextMenu.test.tsx` asserts the same things about the
 * same menu; the two are one control with two shells.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import { ScoreActionsSheet } from './ScoreActionsSheet';
import type { ScoreActionsSheetProps } from './ScoreActionsSheet';

function open(overrides: Partial<ScoreActionsSheetProps> = {}) {
  const onAction = jest.fn();
  const onClose = jest.fn();
  const view = renderWithApp(
    <ScoreActionsSheet
      open
      kind="notes"
      count={1}
      canPaste={false}
      canEdit
      onAction={onAction}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { view, onAction, onClose };
}

const disabled = (view: ReturnType<typeof open>['view'], name: RegExp) =>
  view.getByLabelText(name).props.accessibilityState.disabled === true;

describe('the subject header', () => {
  it.each([
    ['track' as const, 1, 'Track'],
    ['measures' as const, 1, 'Bar'],
    ['measures' as const, 4, 'Bars'],
    ['notes' as const, 1, 'Note'],
    ['notes' as const, 3, 'Notes'],
  ])('names %s (%i) as "%s"', (kind, count, label) => {
    const { view } = open({ kind, count });
    expect(view.getByText(label)).toBeTruthy();
  });

  it('says nothing when nothing is selected', () => {
    const { view } = open({ kind: null, count: 0 });
    expect(view.queryByText('Track')).toBeNull();
    expect(view.queryByText('Notes')).toBeNull();
  });
});

describe('the entries', () => {
  it('offers Clear and Delete as separate choices', () => {
    const { view } = open();
    expect(disabled(view, /^clear$/i)).toBe(false);
    expect(disabled(view, /delete selection/i)).toBe(false);
  });

  it('reports which one was chosen, and closes', () => {
    const { view, onAction, onClose } = open();
    fireEvent.press(view.getByLabelText(/^clear$/i));
    expect(onAction).toHaveBeenCalledWith('clear');
    // Closed, so a second choice cannot be made against a stale selection.
    expect(onClose).toHaveBeenCalled();
  });

  it('disables everything that acts on a selection when there is none', () => {
    const { view } = open({ kind: null, count: 0 });
    for (const name of [/^copy$/i, /^cut$/i, /^clear$/i, /delete selection/i])
      expect(disabled(view, name)).toBe(true);
    // Select all needs no selection, by definition.
    expect(disabled(view, /select all/i)).toBe(false);
  });

  it('keeps Copy live while the transport plays, and nothing else', () => {
    // Copy only reads. The same exemption the edit lock makes everywhere else.
    const { view } = open({ canEdit: false });
    expect(disabled(view, /^copy$/i)).toBe(false);
    for (const name of [/^cut$/i, /^clear$/i, /delete selection/i])
      expect(disabled(view, name)).toBe(true);
  });

  it('offers Paste only when the clipboard holds the same kind of thing', () => {
    expect(disabled(open({ canPaste: false }).view, /^paste$/i)).toBe(true);
    expect(disabled(open({ canPaste: true }).view, /^paste$/i)).toBe(false);
  });
});
