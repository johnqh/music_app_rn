/**
 * A document that lives on the server.
 *
 * A project and a file are two origins for the same thing: the document model
 * already says which one a document has, and everything above it — editing,
 * playback, export — cannot tell the difference. What differs is only *where
 * the bytes go*, which is this module and `document-storage.ts` respectively.
 *
 * **Reads return the score; writes return metadata about it.** `PUT /projects/:id`
 * answers with a `ProjectSaveResult` and no `score` — the writer sent that score
 * a moment ago and still holds it, so echoing it back doubled the cost of every
 * save. Nothing here goes looking for `.score` on a write response.
 *
 * **`serverUpdatedAt` is how a client tells its own writes from somebody
 * else's.** Every read and write records where it left the server, and the
 * generation poll reloads only when the reported stamp is strictly newer than
 * that. Skipping the record after a write makes the next poll read this app's
 * own save as a foreign change and re-download the project it just uploaded.
 */
import type { MusicClient } from '@sudobility/music_client';
import type { Score } from '@sudobility/music_types';
import { createDocument, setDocumentOrigin } from './document';
import type { MusicDocument } from './document';
import type { DocumentList } from './document-list';

/** The calls this module makes. Narrowed so a test can stub three of them. */
export type ProjectGateway = Pick<
  MusicClient,
  'getProject' | 'updateProject' | 'createProject'
>;

export type ProjectAuth = () => Promise<string | null>;

async function tokenOrThrow(getToken: ProjectAuth): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('You must be signed in.');
  return token;
}

/**
 * Opens a server project as a document, or raises the one already open.
 *
 * Through the list rather than by constructing one directly, so opening the
 * same project twice cannot produce two documents that then diverge — the same
 * rule a file follows.
 */
export async function openProjectDocument(
  list: DocumentList,
  gateway: ProjectGateway,
  getToken: ProjectAuth,
  projectId: string,
): Promise<MusicDocument> {
  const existing = list.state.documents.find(
    d => d.origin.kind === 'project' && d.origin.projectId === projectId,
  );
  if (existing) {
    list.activate(existing.id);
    return existing;
  }

  const token = await tokenOrThrow(getToken);
  const project = await gateway.getProject(projectId, token);
  const document = list.open(
    createDocument({
      id: `project-${projectId}`,
      title: project.name,
      score: project.score as Score,
      origin: { kind: 'project', projectId },
    }),
  );
  noteServerVersion(document, project.updatedAt);
  return document;
}

/**
 * Replaces a document's score with the server's copy.
 *
 * Used after a generation lands: the job applied its result to the project
 * itself, so the score this app holds is the one it sent *before* the job ran.
 */
export async function reloadProjectDocument(
  document: MusicDocument,
  gateway: ProjectGateway,
  getToken: ProjectAuth,
): Promise<void> {
  if (document.origin.kind !== 'project') return;
  const token = await tokenOrThrow(getToken);
  const project = await gateway.getProject(document.origin.projectId, token);
  /*
    Through `setScore` with the history reset, not as an edit: this score did
    not come from a command, and leaving the old history in place would let
    undo step back to music the server no longer has.
  */
  document.store.getState().setScore(project.score as Score, {
    resetHistory: true,
  });
  document.dirty = false;
  noteServerVersion(document, project.updatedAt);
}

/** Writes the document's score back to its project. */
export async function saveProjectDocument(
  document: MusicDocument,
  gateway: ProjectGateway,
  getToken: ProjectAuth,
): Promise<void> {
  if (document.origin.kind !== 'project') return;
  const score = document.store.getState().score;
  if (!score) return;
  const token = await tokenOrThrow(getToken);
  const result = await gateway.updateProject(
    document.origin.projectId,
    { name: document.title, score },
    token,
  );
  document.dirty = false;
  // Recording where this write left the server is what stops the next poll
  // reading it as somebody else's change.
  noteServerVersion(document, result.updatedAt);
}

/**
 * Creates a project from a local document and adopts it.
 *
 * "Sync to server": the document keeps its identity and its undo history and
 * simply changes where it is stored, which is why the origin is swapped rather
 * than a second document being opened.
 */
export async function syncDocumentToServer(
  document: MusicDocument,
  gateway: ProjectGateway,
  getToken: ProjectAuth,
): Promise<string> {
  const score = document.store.getState().score;
  if (!score) throw new Error('Cannot sync a document with no score.');
  const token = await tokenOrThrow(getToken);
  const project = await gateway.createProject(
    { name: document.title, score },
    token,
  );
  setDocumentOrigin(document, {
    kind: 'project',
    projectId: project.id,
  });
  document.dirty = false;
  noteServerVersion(document, project.updatedAt);
  return project.id;
}

/**
 * Where this client last saw the server's copy.
 *
 * On the document rather than in the store, because the store is the *editing*
 * engine and knows nothing about a server. `useProjectGeneration` reads it
 * through the store shape it was given, so the document exposes it there.
 */
export function noteServerVersion(
  document: MusicDocument,
  updatedAt: string | undefined,
): void {
  if (updatedAt) document.serverUpdatedAt = updatedAt;
}
