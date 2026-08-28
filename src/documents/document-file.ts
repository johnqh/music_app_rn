/**
 * A `.moosiac` file: the score, plus the little the app needs beside it.
 *
 * JSON, and versioned from the first release rather than when it first has to
 * change — a file with no version is one nobody can safely read later. The
 * score itself is validated with music_types' own `parseScore` on the way in,
 * because a file on disk is exactly as untrusted as a network response: it may
 * have been written by an older build, edited by hand, or truncated by a crash.
 *
 * Serialization lives in the app rather than music_io for now. music_io owns
 * *notation formats* — MIDI, MusicXML, tracker — where this is the app's own
 * document, and the interesting part of putting it behind that interface is the
 * file dialogs and macOS security-scoped bookmarks, not the JSON.
 */
import { parseScore } from '@sudobility/music_types';
import type { Score } from '@sudobility/music_types';

export const DOCUMENT_FORMAT_VERSION = 1;
export const DOCUMENT_EXTENSION = 'moosiac';

export type DocumentFile = {
  version: number;
  title: string;
  score: Score;
};

export function serializeDocument(file: {
  title: string;
  score: Score;
}): string {
  const payload: DocumentFile = {
    version: DOCUMENT_FORMAT_VERSION,
    title: file.title,
    score: file.score,
  };
  return JSON.stringify(payload);
}

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

/**
 * Reads a document, refusing anything it cannot vouch for.
 *
 * A version from the future is refused outright rather than read hopefully: a
 * newer file may say something this build would silently drop, and losing half
 * a score on the next save is worse than not opening it.
 */
export function parseDocument(text: string): DocumentFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DocumentParseError('Not a Moosiac document: invalid JSON.');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new DocumentParseError('Not a Moosiac document.');
  }
  const record = raw as Record<string, unknown>;
  const version = record.version;
  if (typeof version !== 'number') {
    throw new DocumentParseError('Not a Moosiac document: no format version.');
  }
  if (version > DOCUMENT_FORMAT_VERSION) {
    throw new DocumentParseError(
      `This document was written by a newer version of Moosiac (format ${version}).`,
    );
  }
  const title = typeof record.title === 'string' ? record.title : 'Untitled';
  let score: Score;
  try {
    score = parseScore(record.score);
  } catch (error) {
    throw new DocumentParseError(
      `The score in this document could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return { version, title, score };
}

/** `Wedding March` -> `Wedding March.moosiac`, safe on every platform we ship. */
export function documentFilename(title: string): string {
  const cleaned = title.replace(/[/\\:*?"<>|]/g, '-').trim() || 'Untitled';
  return `${cleaned}.${DOCUMENT_EXTENSION}`;
}
