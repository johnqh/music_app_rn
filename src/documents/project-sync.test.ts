import { describe, expect, it, vi } from 'vitest';
import { createEmptyScore } from '@sudobility/music_types';
import { DocumentList } from './document-list.js';
import { createDocument } from './document.js';
import {
  openProjectDocument,
  reloadProjectDocument,
  saveProjectDocument,
  syncDocumentToServer,
} from './project-sync.js';
import type { ProjectGateway } from './project-sync.js';

function gateway(overrides: Partial<ProjectGateway> = {}) {
  const score = createEmptyScore({ title: 'From Server' });
  return {
    getProject: vi.fn(async () => ({
      id: 'p1',
      name: 'Server Copy',
      score,
      updatedAt: '2026-01-02T00:00:00.000Z',
    })),
    updateProject: vi.fn(async () => ({
      updatedAt: '2026-01-03T00:00:00.000Z',
    })),
    createProject: vi.fn(async () => ({
      id: 'new-1',
      updatedAt: '2026-01-04T00:00:00.000Z',
    })),
    ...overrides,
  } as unknown as ProjectGateway;
}

const token = async () => 'tok';

function localDocument(title = 'Local') {
  return createDocument({
    id: 'local',
    title,
    score: createEmptyScore({ title }),
  });
}

describe('opening a project', () => {
  it('raises the one already open rather than opening a second copy', async () => {
    // Two documents over one project would diverge the moment either was
    // edited, and both would claim to be the project.
    const list = new DocumentList();
    const g = gateway();
    const first = await openProjectDocument(list, g, token, 'p1');
    const second = await openProjectDocument(list, g, token, 'p1');
    expect(second).toBe(first);
    expect(list.state.documents).toHaveLength(1);
    expect(g.getProject).toHaveBeenCalledTimes(1);
  });

  it('records where the server was, so the next poll has something to compare', async () => {
    const list = new DocumentList();
    const document = await openProjectDocument(list, gateway(), token, 'p1');
    expect(document.serverUpdatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('opens clean, because adopting a score is not an edit', async () => {
    const list = new DocumentList();
    const document = await openProjectDocument(list, gateway(), token, 'p1');
    expect(document.dirty).toBe(false);
  });
});

describe('saving a project', () => {
  it('records the stamp the write left behind', async () => {
    /*
      The bug this exists for: without recording it, the next poll compares
      against a stamp older than this app's own save, reads it as somebody
      else's change, and re-downloads the project it just uploaded — resetting
      the undo history a few seconds after every edit.
    */
    const list = new DocumentList();
    const g = gateway();
    const document = await openProjectDocument(list, g, token, 'p1');
    await saveProjectDocument(document, g, token);
    expect(document.serverUpdatedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('does nothing for a document that is not a project', async () => {
    const g = gateway();
    await saveProjectDocument(localDocument(), g, token);
    expect(g.updateProject).not.toHaveBeenCalled();
  });
});

describe('reloading after a generation', () => {
  it('adopts the server score and clears the dirty flag', async () => {
    const list = new DocumentList();
    const g = gateway();
    const document = await openProjectDocument(list, g, token, 'p1');
    document.dirty = true;
    await reloadProjectDocument(document, g, token);
    expect(document.dirty).toBe(false);
    expect(document.store.getState().score?.metadata.title).toBe('From Server');
  });

  it('resets the history, so undo cannot reach music the server no longer has', async () => {
    const list = new DocumentList();
    const g = gateway();
    const document = await openProjectDocument(list, g, token, 'p1');
    await reloadProjectDocument(document, g, token);
    expect(document.store.getState().canUndo).toBe(false);
  });
});

describe('syncing a local document to the server', () => {
  it('changes where it is stored without opening a second document', async () => {
    // The identity, the undo history and the tab all survive: only the
    // destination changed.
    const document = localDocument();
    const g = gateway();
    const id = await syncDocumentToServer(document, g, token);
    expect(id).toBe('new-1');
    expect(document.origin).toEqual({ kind: 'project', projectId: 'new-1' });
    expect(document.serverUpdatedAt).toBe('2026-01-04T00:00:00.000Z');
  });

  it('refuses without a token rather than creating an anonymous project', async () => {
    const document = localDocument();
    await expect(
      syncDocumentToServer(document, gateway(), async () => null),
    ).rejects.toThrow(/signed in/i);
    expect(document.origin.kind).toBe('unsaved');
  });
});
