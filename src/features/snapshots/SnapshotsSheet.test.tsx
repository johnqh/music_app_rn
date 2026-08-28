/**
 * The snapshot sheet's one job beyond mounting the panel: saying so when there
 * is no server.
 *
 * A panel that renders its controls and fails every one of them is worse than a
 * sentence explaining why they are absent — the reader taps three times before
 * concluding something is broken.
 */
import { jest } from '@jest/globals';
import { createEmptyScore } from '@sudobility/music_types';
import { createDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';

const mockClient = jest.fn<() => unknown>();
jest.mock('@/config/server', () => ({ getMusicClient: () => mockClient() }));

const { SnapshotsSheet } =
  require('./SnapshotsSheet') as typeof import('./SnapshotsSheet');

function projectDoc() {
  return createDocument({
    id: 'p',
    title: 'Quartet',
    score: createEmptyScore({ title: 'Quartet' }),
    origin: { kind: 'project', projectId: 'p1' },
  });
}

describe('SnapshotsSheet', () => {
  it('explains itself when this build has no server', () => {
    mockClient.mockReturnValue(null);
    const view = renderWithApp(
      <SnapshotsSheet
        open
        document={projectDoc()}
        getToken={async () => 'tok'}
        onClose={jest.fn()}
      />,
    );
    expect(view.getByText(/server/i)).toBeTruthy();
    expect(view.queryByText('New snapshot')).toBeNull();
  });

  it('has no bottom bar, because everything here acts immediately', () => {
    // A Save button over controls that have already saved does nothing.
    mockClient.mockReturnValue(null);
    const view = renderWithApp(
      <SnapshotsSheet
        open
        document={projectDoc()}
        getToken={async () => 'tok'}
        onClose={jest.fn()}
      />,
    );
    expect(view.queryByText('Save')).toBeNull();
  });
});
