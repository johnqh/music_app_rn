/**
 * The editor's row order, which is the one thing about this layout that has to
 * match the web app exactly.
 *
 * Somebody who knows where the transport is should not have to look for it, and
 * the order is not something either app can check for itself — each is
 * internally consistent whichever way round these two sit.
 */
import { jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { renderWithApp, testDocument } from '@/test/render';

/*
  The tab strip reads the open-document list from a provider this test has no
  reason to stand up — it is a sibling of the rows under test, not part of them.
*/
jest.mock('@/features/documents/DocumentTabs', () => ({
  DocumentTabs: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppLayout } = require('./AppLayout') as typeof import('./AppLayout');

describe('AppLayout', () => {
  it('puts the transport above the keyboard', () => {
    /*
      The keyboard is the only row down there whose height changes — it
      collapses, and it is optional. With it in between, opening or closing it
      moved the transport, which is the row a thumb goes to without looking.

      Asserted on the rendered tree's order rather than on a snapshot: what is
      being pinned is which comes first, not the markup around either.
    */
    const view = renderWithApp(
      <AppLayout
        document={testDocument()}
        onSave={jest.fn()}
        onExport={jest.fn()}
        onMeasureTap={jest.fn()}
      />,
    );

    // Opened first: collapsed it draws nothing, so there would be no order to
    // assert. The control that opens it is the transport's last button.
    fireEvent.press(view.getByLabelText('Show keyboard'));

    const marks = view
      .UNSAFE_getAllByProps({})
      .map(node => node.props.accessibilityLabel ?? node.props.testID)
      .filter(
        (mark): mark is string =>
          mark === 'Playback transport' || mark === 'piano-keyboard-panel',
      );

    expect(marks[0]).toBe('Playback transport');
    expect(marks).toContain('piano-keyboard-panel');
  });
});
