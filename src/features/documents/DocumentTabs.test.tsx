/**
 * The open documents, as tabs.
 *
 * Two rules. A document with unsaved work says so, because closing it is
 * destructive and the tab is the only place that warning can live. And
 * activating a tab must not close it — the two controls sit on top of each
 * other, and getting them the wrong way round loses somebody's work with one
 * mis-tap.
 */
import { fireEvent } from '@testing-library/react-native';
import { createEmptyScore } from '@sudobility/music_types';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { createDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import { DocumentTabs } from './DocumentTabs';

function doc(id: string, title: string) {
  return createDocument({
    id,
    title,
    score: createEmptyScore({ title }),
  });
}

function setup(count = 2) {
  const list = new DocumentList();
  for (let i = 0; i < count; i += 1) list.open(doc(`d${i}`, `Score ${i}`));
  const view = renderWithApp(
    <DocumentsProvider list={list}>
      <DocumentTabs />
    </DocumentsProvider>,
  );
  return { view, list };
}

describe('DocumentTabs', () => {
  it('shows one tab per open document', () => {
    const { view } = setup(3);
    expect(view.getByText('Score 0')).toBeTruthy();
    expect(view.getByText('Score 2')).toBeTruthy();
  });

  it('activates the tab that was tapped', () => {
    const { view, list } = setup(2);
    fireEvent.press(view.getByText('Score 0'));
    expect(list.state.activeId).toBe('d0');
  });

  it('does not close a document when activating it', () => {
    // The close control sits on the tab; a mis-wire loses work on one tap.
    const { view, list } = setup(2);
    fireEvent.press(view.getByText('Score 1'));
    expect(list.state.documents).toHaveLength(2);
  });
});
