/**
 * `Moosiac - Music1`: the window title tracks the active document, live.
 */
import { jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { createDocumentStore } from '@sudobility/music_lib';
import { createEmptyScore, MusicPosition } from '@sudobility/music_types';
import { asDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';

const mockApplyWindowTitle = jest.fn();
jest.mock('@/platform/windowTitle', () => ({
  applyWindowTitle: (title: string) => mockApplyWindowTitle(title),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WindowTitleSync } =
  require('./WindowTitleSync') as typeof import('./WindowTitleSync');

function doc(id: string, title: string) {
  return asDocument(
    createDocumentStore({ title, score: createEmptyScore({ title }) }),
    id,
  );
}

describe('WindowTitleSync', () => {
  beforeEach(() => mockApplyWindowTitle.mockClear());

  it('sets the app name and the active document title on mount', () => {
    const list = new DocumentList({ position: () => new MusicPosition() });
    list.open(doc('d0', 'Music1'));
    renderWithApp(
      <DocumentsProvider list={list}>
        <WindowTitleSync />
      </DocumentsProvider>,
    );
    expect(mockApplyWindowTitle).toHaveBeenLastCalledWith('Moosiac - Music1');
  });

  it('follows switching the active tab', () => {
    const list = new DocumentList({ position: () => new MusicPosition() });
    list.open(doc('d0', 'Music1'));
    list.open(doc('d1', 'Music2'));
    renderWithApp(
      <DocumentsProvider list={list}>
        <WindowTitleSync />
      </DocumentsProvider>,
    );
    expect(mockApplyWindowTitle).toHaveBeenLastCalledWith('Moosiac - Music2');
    act(() => list.activate('d0'));
    expect(mockApplyWindowTitle).toHaveBeenLastCalledWith('Moosiac - Music1');
  });
});
