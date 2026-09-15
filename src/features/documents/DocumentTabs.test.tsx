/**
 * The open documents, as tabs.
 *
 * Three rules. A document with unsaved work says so, because closing it is
 * destructive and the tab is the only place that warning can live. Closing one
 * **asks first** when work would be lost, and closes straight away when none
 * would. And activating a tab must not close it — the two controls sit on top
 * of each other, and getting them the wrong way round loses somebody's work
 * with one mis-tap.
 */
import { act, fireEvent } from '@testing-library/react-native';
import { createDocumentStore } from '@sudobility/music_lib';
import {
  changeMetadataCommand,
  createEmptyScore,
  MusicPosition,
} from '@sudobility/music_types';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { asDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import { DocumentTabs } from './DocumentTabs';

function doc(id: string, title: string) {
  return asDocument(
    createDocumentStore({ title, score: createEmptyScore({ title }) }),
    id,
  );
}

function setup(count = 2) {
  const position = new MusicPosition();
  const list = new DocumentList({ position: () => position });
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

  it('is a tab assistive technology can find by name and press', () => {
    // It had no label and no accessibility action: VoiceOver on the Mac found
    // the close button inside it and not the tab itself.
    const { view, list } = setup(2);
    const tab = view.getByLabelText('Score 0');
    expect(tab.props.accessibilityRole).toBe('tab');
    fireEvent(tab, 'accessibilityTap');
    expect(list.state.activeId).toBe('d0');
  });

  it('does not close a document when activating it', () => {
    // The close control sits on the tab; a mis-wire loses work on one tap.
    const { view, list } = setup(2);
    fireEvent.press(view.getByText('Score 1'));
    expect(list.state.documents).toHaveLength(2);
  });

  it("marks unsaved work from the document's own store, as it happens", () => {
    const { view, list } = setup(2);
    act(() => {
      list.openDocuments[0]!.store.getState().dispatchCommand(
        changeMetadataCommand({ title: 'X' }, 'Set title'),
      );
    });
    expect(view.getByText('• Score 0')).toBeTruthy();
  });

  it('closes a clean document without asking', () => {
    const { view, list } = setup(2);
    fireEvent.press(view.getByLabelText('Close Score 1'));
    expect(list.state.documents).toHaveLength(1);
  });

  it('asks before closing a document with unsaved work', () => {
    const { view, list } = setup(2);
    act(() => {
      list.openDocuments[1]!.store.getState().dispatchCommand(
        changeMetadataCommand({ title: 'X' }, 'Set title'),
      );
    });
    fireEvent.press(view.getByLabelText('Close Score 1'));
    expect(list.state.documents).toHaveLength(2);
    fireEvent.press(view.getByText('Close without saving'));
    expect(list.state.documents).toHaveLength(1);
  });
});
