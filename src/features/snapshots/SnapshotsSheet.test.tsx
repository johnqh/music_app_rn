/**
 * The snapshot sheet's one job beyond mounting the panel: saying so when there
 * is no server.
 *
 * A panel that renders its controls and fails every one of them is worse than a
 * sentence explaining why they are absent — the reader taps three times before
 * concluding something is broken.
 */
import { jest } from '@jest/globals';
import { createDocumentStore } from '@sudobility/music_lib';
import { createEmptyScore } from '@sudobility/music_types';
import { asDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';

const mockContext = jest.fn<() => unknown>();
jest.mock('@/config/useServerContext', () => ({
  useServerContext: () => mockContext(),
}));

const { SnapshotsSheet } =
  require('./SnapshotsSheet') as typeof import('./SnapshotsSheet');

function projectDoc() {
  return asDocument(
    createDocumentStore({
      title: 'Quartet',
      score: createEmptyScore({ title: 'Quartet' }),
      origin: { kind: 'project', projectId: 'p1' },
    }),
  );
}

describe('SnapshotsSheet', () => {
  it('explains itself when this build has no server', () => {
    mockContext.mockReturnValue(null);
    const view = renderWithApp(
      <SnapshotsSheet open document={projectDoc()} onClose={jest.fn()} />,
    );
    expect(view.getByText(/server/i)).toBeTruthy();
    expect(view.queryByText('New snapshot')).toBeNull();
  });

  it('has no bottom bar, because everything here acts immediately', () => {
    // A Save button over controls that have already saved does nothing.
    mockContext.mockReturnValue(null);
    const view = renderWithApp(
      <SnapshotsSheet open document={projectDoc()} onClose={jest.fn()} />,
    );
    expect(view.queryByText('Save')).toBeNull();
  });
});
