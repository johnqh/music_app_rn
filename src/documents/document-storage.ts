/**
 * Reading and writing documents, with the filesystem injected.
 *
 * Structurally typed rather than importing `react-native-fs` here, for the
 * reason every adapter in this family is: the rules worth testing — what a save
 * does to a document's origin, what happens when a write fails — are testable
 * against a fake, and this package's tests then need no device.
 *
 * It is also what lets macOS behave differently later without this file
 * changing. A sandboxed Mac App Store build cannot open a path it was merely
 * given; it needs the document picker and a security-scoped bookmark. That is a
 * different `DocumentStorage`, not a different document.
 */
import { createDocument, markSaved } from './document';
import type { MusicDocument } from './document';
import {
  documentFilename,
  parseDocument,
  serializeDocument,
} from './document-file';
import type { DocumentList } from './document-list';

/** Told about every open and save, so a recent list can exist. */
export type OpenObserver = (document: MusicDocument) => void;

export type DocumentStorage = {
  readText(uri: string): Promise<string>;
  writeText(uri: string, text: string): Promise<void>;
  /** Where a new document goes when the user has not chosen a place. */
  defaultDirectory(): string;
  /** Joins a directory and a filename the way the platform spells paths. */
  join(directory: string, filename: string): string;
};

let nextId = 0;
function documentId(): string {
  nextId += 1;
  return `doc-${nextId}`;
}

/** Opens a file into the list, or raises the tab already holding it. */
export async function openDocument(
  list: DocumentList,
  storage: DocumentStorage,
  uri: string,
  onChanged?: (document: MusicDocument) => void,
  onOpened?: OpenObserver,
): Promise<MusicDocument> {
  const text = await storage.readText(uri);
  const file = parseDocument(text);
  const document = list.open(
    createDocument({
      id: documentId(),
      title: file.title,
      score: file.score,
      origin: { kind: 'file', uri },
      ...(onChanged ? { onChanged } : {}),
    }),
  );
  onOpened?.(document);
  return document;
}

/**
 * Writes a document, and only then records it as saved.
 *
 * The order is the whole point: marking it clean before the write means a
 * failed save leaves a document that looks safe to close.
 */
export async function saveDocument(
  document: MusicDocument,
  storage: DocumentStorage,
  onSaved?: OpenObserver,
): Promise<string> {
  const uri =
    document.origin.kind === 'file'
      ? document.origin.uri
      : storage.join(
          storage.defaultDirectory(),
          documentFilename(document.title),
        );

  const score = document.store.getState().score;
  if (!score) throw new Error('Cannot save a document with no score.');

  await storage.writeText(
    uri,
    serializeDocument({ title: document.title, score }),
  );
  markSaved(document, { kind: 'file', uri });
  // Recorded after the write, never before: a file that failed to save is not
  // one worth offering to reopen.
  onSaved?.(document);
  return uri;
}

/** A new, empty document — an ordinary document that has never been written. */
export function newDocument(
  list: DocumentList,
  score: Parameters<typeof createDocument>[0]['score'],
  title: string,
  onChanged?: (document: MusicDocument) => void,
): MusicDocument {
  return list.open(
    createDocument({
      id: documentId(),
      title,
      score,
      ...(onChanged ? { onChanged } : {}),
    }),
  );
}
