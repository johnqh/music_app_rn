/**
 * "Save to the server", and the three states in which it must not appear.
 *
 * A control that is present and refuses is worse than one that is absent: it
 * invites a tap that can only fail. This is offered only when there is a
 * server, an account, and a document that is not already a project.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { createDocumentStore } from '@sudobility/music_lib';
import type { MusicClient } from '@sudobility/music_client';
import { createEmptyScore, MusicPosition } from '@sudobility/music_types';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { asDocument } from '@/documents/document';
import { renderWithApp } from '@/test/render';
import type { MusicDocument } from '@/documents/document';

const mockClient = jest.fn<() => unknown>();
const mockUser = jest.fn<() => unknown>();
const mockCreate = jest.fn<() => Promise<unknown>>();

jest.mock('@/config/server', () => ({ getMusicClient: () => mockClient() }));
jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser(), getToken: async () => 'tok' }),
}));

/** A store that can reach a server whose `createProject` is `mockCreate`. */
const serverContext = {
  client: { createProject: () => mockCreate() } as unknown as MusicClient,
  getToken: async () => 'tok',
};

const { SyncToServerButton } =
  require('./SyncToServerButton') as typeof import('./SyncToServerButton');

function setup(document: MusicDocument | null) {
  const list = new DocumentList({ position: () => new MusicPosition() });
  if (document) list.open(document);
  return renderWithApp(
    <DocumentsProvider list={list}>
      <SyncToServerButton />
    </DocumentsProvider>,
  );
}

function localDoc() {
  return asDocument(
    createDocumentStore({
      title: 'Local',
      score: createEmptyScore({ title: 'Local' }),
      context: serverContext,
    }),
    'local',
  );
}

function projectDoc() {
  return asDocument(
    createDocumentStore({
      title: 'Project',
      score: createEmptyScore({ title: 'Project' }),
      origin: { kind: 'project', projectId: 'p1' },
      context: serverContext,
    }),
    'p',
  );
}

beforeEach(() => {
  mockClient.mockReturnValue({});
  mockUser.mockReturnValue({ uid: 'u1' });
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({
    id: 'new-1',
    updatedAt: '2026-09-15T00:00:00.000Z',
  });
});

describe('SyncToServerButton', () => {
  it('is offered for a local document', () => {
    expect(setup(localDoc()).getByText('Save to the server')).toBeTruthy();
  });

  it('is absent for a document that is already a project', () => {
    // There is nothing to sync; it is already there.
    expect(setup(projectDoc()).queryByText('Save to the server')).toBeNull();
  });

  it('is absent with no account', () => {
    mockUser.mockReturnValue(null);
    expect(setup(localDoc()).queryByText('Save to the server')).toBeNull();
  });

  it('is absent when this build has no server', () => {
    mockClient.mockReturnValue(null);
    expect(setup(localDoc()).queryByText('Save to the server')).toBeNull();
  });

  it('is absent with no document open', () => {
    expect(setup(null).queryByText('Save to the server')).toBeNull();
  });

  it('moves the document to the project it made, keeping its store', async () => {
    const document = localDoc();
    const view = setup(document);
    await act(async () => {
      fireEvent.press(view.getByText('Save to the server'));
    });
    expect(document.store.getState().origin).toEqual({
      kind: 'project',
      projectId: 'new-1',
    });
    // Now a project, so there is nothing left to sync.
    expect(view.queryByText('Save to the server')).toBeNull();
  });

  it('reports a failure rather than swallowing it', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    const view = setup(localDoc());
    await act(async () => {
      fireEvent.press(view.getByText('Save to the server'));
    });
    expect(view.getByText('offline')).toBeTruthy();
  });
});
