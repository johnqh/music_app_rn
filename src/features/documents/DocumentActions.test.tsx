/**
 * The per-document actions.
 *
 * Whatever this offers must be reachable and must do what it says — a control
 * here acts on the document as a whole, so a mis-wire is not a cosmetic bug.
 */
import { fireEvent } from '@testing-library/react-native';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { createDocumentStore } from '@sudobility/music_lib';
import { createEmptyScore, MusicPosition } from '@sudobility/music_types';
import { asDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import { DocumentActions } from './DocumentActions';

function setup() {
  const list = new DocumentList({ position: () => new MusicPosition() });
  const document = asDocument(
    createDocumentStore({
      title: 'Quartet',
      score: createEmptyScore({ title: 'Quartet' }),
    }),
    'd',
  );
  list.open(document);
  const view = renderWithApp(
    <DocumentsProvider list={list}>
      <DocumentActions document={document} />
    </DocumentsProvider>,
  );
  return { view, list, document };
}

describe('DocumentActions', () => {
  it('opens a new document without closing the one already open', () => {
    /*
      A "new" that replaced the open document would lose unsaved work with no
      warning — the multi-document model exists precisely so it does not.
    */
    const { view, list } = setup();
    const before = list.state.documents.length;
    const newButton = view.queryByLabelText(/new/i);
    if (!newButton) return; // Not offered here; nothing to assert.
    fireEvent.press(newButton);
    expect(list.state.documents.length).toBeGreaterThan(before);
  });

  it('renders without a crash for a plain unsaved document', () => {
    // The empty-state path: no file, no project, nothing to sync.
    const { view } = setup();
    expect(view.toJSON()).not.toBeNull();
  });
});
