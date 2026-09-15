/**
 * Opening a file from outside the app: `moosiac://open?path=…` and Finder.
 *
 * Two ways in, one route. A link — typed into a terminal (`open
 * "moosiac://open?path=…"`), clicked in another app, or used by a test to load
 * a file without driving a file panel — names a path; double-clicking a `.moo`
 * in Finder hands the app a `file://` URL, which `AppDelegate.mm` forwards as
 * the same kind of link. Both arrive through React Native's `Linking`, and both
 * are decided here.
 *
 * **Only what the app can open is opened.** The path must be absolute and its
 * extension one the app reads: a document (`.moo`, or `.moosiac` from before
 * the extension was shortened) opens as a document; a file the importers read
 * goes through the same import the File menu runs, MIDI wizard included.
 * Anything else is refused rather than guessed at, because a link is something
 * another program can send.
 */
import { DOCUMENT_EXTENSIONS } from '@/documents/document-file';
import { IMPORT_EXTENSIONS, IMPORT_FORMATS } from '@/documents/import';
import type { ImportFormat } from '@/documents/import';

export const OPEN_LINK_SCHEME = 'moosiac';

export type OpenLink =
  | { kind: 'document'; path: string }
  | { kind: 'import'; format: ImportFormat; path: string };

/** The link that opens `path`: what `AppDelegate.mm` builds for a Finder open. */
export function openLinkUrl(path: string): string {
  return `${OPEN_LINK_SCHEME}://open?path=${encodeURIComponent(path)}`;
}

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text.replace(/\+/g, '%20'));
  } catch {
    return null;
  }
}

/** The path a URL names, or null when it names none the app accepts. */
function pathFrom(url: string): string | null {
  const fileMatch = /^file:\/\/(?:localhost)?(\/[^?#]*)$/i.exec(url);
  if (fileMatch) return decode(fileMatch[1]!);

  const linkMatch = new RegExp(
    `^${OPEN_LINK_SCHEME}://open/?\\?(.*)$`,
    'i',
  ).exec(url);
  if (!linkMatch) return null;
  for (const pair of linkMatch[1]!.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key === 'path') return decode(value);
  }
  return null;
}

/** What a URL asks the app to open, or null to ignore it. */
export function openLinkFor(url: string): OpenLink | null {
  const path = pathFrom(url.trim());
  if (!path || !path.startsWith('/')) return null;
  const dot = path.lastIndexOf('.');
  if (dot < 0 || dot < path.lastIndexOf('/')) return null;
  const extension = path.slice(dot + 1).toLowerCase();

  if ((DOCUMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'document', path };
  }
  const format = IMPORT_FORMATS.find(candidate =>
    IMPORT_EXTENSIONS[candidate].includes(extension),
  );
  return format ? { kind: 'import', format, path } : null;
}
