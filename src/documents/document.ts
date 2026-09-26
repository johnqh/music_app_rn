/**
 * An open document: an id for its tab, and the store that is the document.
 *
 * The native app edits several scores at once — tabs on a desktop — so the
 * store is **per document** rather than app-wide. That store is music_lib's
 * `createDocumentStore`: the same editing slices, saver and project write the
 * web app's project runs on, composed once per document. Everything a document
 * *is* lives in its state — the title, the origin (unsaved, a `.moo` file, a
 * server project), `dirty`, `saveState`, `serverUpdatedAt`, `lastGeneration`.
 *
 * It used to be otherwise. This file wrapped a bare editing store in a mutable
 * record whose `dirty` and `serverUpdatedAt` sat *beside* the store, saved by an
 * autosaver of this app's own and a second set of project calls. That copy had
 * drifted from the web's in exactly the ways that lose work quietly: a write
 * that raced an edit marked the document clean, every project save PUT the
 * whole score, and nothing reported a save state a generation poll could read.
 * Those rules exist once now, in music_lib, and nothing here restates them.
 *
 * What stays here is what a store cannot hold: which tab it is, and the
 * services every store in this app is built with. A store has no identity of
 * its own to key a tab or a React subtree by.
 */
import {
  createDocumentStore,
  openFileDocument,
  openProjectDocument,
} from '@sudobility/music_lib';
import type {
  CreateDocumentStoreOptions,
  DocumentFileStorage,
  DocumentOrigin,
  DocumentStore,
  StoreContext,
} from '@sudobility/music_lib';
import type { ProjectOrigin } from '@sudobility/music_types';

export type MusicDocument = {
  readonly id: string;
  readonly store: DocumentStore;
};

let nextId = 0;

/** A fresh tab id. Never reused within a process, so a key cannot collide. */
export function nextDocumentId(): string {
  nextId += 1;
  return `doc-${nextId}`;
}

/** Gives a store a tab. */
export function asDocument(
  store: DocumentStore,
  id: string = nextDocumentId(),
): MusicDocument {
  return { id, store };
}

/**
 * What every document store in this app is built with.
 *
 * One object rather than three arguments threaded through every menu and
 * screen that can make a document: a document created from the File menu used
 * to register no change callback at all and so never saved itself, because the
 * autosaver lived in the composition root and nothing below could reach it.
 * Now the composition root builds this once and the provider hands it down.
 */
export type DocumentServices = {
  /** The server, the token getter and the toast sink. `{}` with no server. */
  context: StoreContext;
  /** How a `.moo` is read and written on this platform. */
  files: DocumentFileStorage;
  /** Told after every successful write — the recent-documents list. */
  onSaved?: CreateDocumentStoreOptions['onSaved'];
};

/**
 * Services for a host with no filesystem and no server — every component test.
 *
 * A read or write rejects rather than resolving empty: a test that reaches the
 * disk without saying so should fail where it happened.
 */
export const OFFLINE_DOCUMENT_SERVICES: DocumentServices = {
  context: {},
  files: {
    readText: async uri => {
      throw new Error(`No file storage in this host (read ${uri}).`);
    },
    writeText: async uri => {
      throw new Error(`No file storage in this host (write ${uri}).`);
    },
  },
};

function storeOptions(services: DocumentServices) {
  return {
    context: services.context,
    files: services.files,
    ...(services.onSaved ? { onSaved: services.onSaved } : {}),
  };
}

/** A new document that has never been written: New, an import, first launch. */
export function newDocument(
  services: DocumentServices,
  input: {
    score: CreateDocumentStoreOptions['score'];
    title: string;
    origin?: DocumentOrigin;
    /** For a project just created: where the create left the server. */
    serverUpdatedAt?: string;
    /** For a project just created: where the server recorded it came from. */
    projectOrigin?: ProjectOrigin | null;
  },
): MusicDocument {
  return asDocument(
    createDocumentStore({
      ...storeOptions(services),
      score: input.score,
      title: input.title,
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.serverUpdatedAt
        ? { serverUpdatedAt: input.serverUpdatedAt }
        : {}),
      ...(input.projectOrigin !== undefined
        ? { projectOrigin: input.projectOrigin }
        : {}),
    }),
  );
}

/** Reads a `.moo` — or the web's JSON export — into a document. */
export async function openFile(
  services: DocumentServices,
  uri: string,
): Promise<MusicDocument> {
  return asDocument(
    await openFileDocument(services.files, uri, {
      context: services.context,
      ...(services.onSaved ? { onSaved: services.onSaved } : {}),
    }),
  );
}

/** Reads a server project into a document. */
export async function openProject(
  services: DocumentServices,
  projectId: string,
): Promise<MusicDocument> {
  return asDocument(
    await openProjectDocument(services.context, projectId, {
      files: services.files,
      ...(services.onSaved ? { onSaved: services.onSaved } : {}),
    }),
  );
}

/** The part of the open-document list opening a document needs. */
type OpenInto = {
  findOpen(origin: DocumentOrigin): MusicDocument | null;
  activate(id: string): void;
  open(document: MusicDocument): MusicDocument;
};

/**
 * Opens a `.moo` into the list, or raises the tab already holding it —
 * checked **before** reading, so reopening an open file neither reads the disk
 * nor builds a second store over the same path.
 */
export async function openFileInto(
  list: OpenInto,
  services: DocumentServices,
  uri: string,
): Promise<MusicDocument> {
  const existing = list.findOpen({ kind: 'file', uri });
  if (existing) {
    list.activate(existing.id);
    return existing;
  }
  return list.open(await openFile(services, uri));
}

/** The same for a server project: the open tab, or one fresh read. */
export async function openProjectInto(
  list: OpenInto,
  services: DocumentServices,
  projectId: string,
): Promise<MusicDocument> {
  const existing = list.findOpen({ kind: 'project', projectId });
  if (existing) {
    list.activate(existing.id);
    return existing;
  }
  return list.open(await openProject(services, projectId));
}

/** Whether two origins name the same place. Two unsaved documents never do. */
export function sameOrigin(a: DocumentOrigin, b: DocumentOrigin): boolean {
  if (a.kind === 'file' && b.kind === 'file') return a.uri === b.uri;
  if (a.kind === 'project' && b.kind === 'project')
    return a.projectId === b.projectId;
  return false;
}
