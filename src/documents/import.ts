/**
 * Bringing a file in as a new document: MIDI, MusicXML, a tracker module, or a
 * Moosiac project file.
 *
 * The project file is here rather than behind an Open of its own because iOS
 * and Android have no File menu: `file.open` exists only on the macOS menu bar,
 * which is how a `.moo` came to be a document those two platforms could write
 * and then never read back. Importing one makes a project like every other
 * import does, which is also what the web app does with the same file.
 *
 * Each is one call on `music_io` — it owns both the codec and the file layer,
 * so nothing here pairs a decode with a read. What this module owns is the
 * decision *after* the decode: an import makes a **new document**, never an
 * edit to the open one. That is the same rule the web app follows, where every
 * import ends in `newProject`, and it is what stops an import from silently
 * replacing music somebody was working on.
 *
 * The file itself comes from `FilePicker`, which is a different control on
 * every platform — a `UIDocumentPickerViewController`, the Storage Access
 * Framework, or an `NSOpenPanel`. On a sandboxed build that panel is where the
 * *permission* comes from, not just the path.
 *
 * Signed in, the import becomes a new server project; signed out or offline, a
 * local document with no file origin. It came from a `.mid`, and writing a
 * Moosiac document back over a MIDI file would destroy everything the format
 * cannot hold — so a local import is unsaved until somebody says where it goes.
 */
import { ApiError } from '@sudobility/music_client';
import {
  authorizedServer,
  AuthRequiredError,
  defaultMidiImportOptions,
  DOCUMENT_EXTENSIONS,
  hasServer,
  importedTitle,
  parseProjectFile,
  projectScoreForServer,
} from '@sudobility/music_lib';
import type { MidiImportOptions, MidiSummary } from '@sudobility/music_lib';
import type { Score } from '@sudobility/music_types';
import { newDocument } from './document';
import type { DocumentServices, MusicDocument } from './document';
import type { DocumentList } from './document-list';

export const IMPORT_FORMATS = [
  'midi',
  'musicxml',
  'tracker',
  'project',
] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/**
 * The extensions a picker offers for each format.
 *
 * Tracker modules are six formats read by one decoder, chosen by magic bytes
 * rather than by extension — so a mis-named module still imports, and this list
 * only decides what the picker greys out.
 *
 * `project` is `DOCUMENT_EXTENSIONS` rather than three strings typed out again:
 * `.moo` is what this build writes, `.moosiac` and `.json` are what earlier
 * ones wrote, and `parseProjectFile` reads all three — a picker offering fewer
 * would grey out a document this app can open perfectly well.
 */
export const IMPORT_EXTENSIONS: Record<ImportFormat, readonly string[]> = {
  midi: ['mid', 'midi'],
  musicxml: ['musicxml', 'xml', 'mxl'],
  tracker: ['mod', 'dsm', 's3m', 'xm', 'it', 'mptm'],
  project: DOCUMENT_EXTENSIONS,
};

/** What music_io provides for reading a notation file. */
export type ScoreImporter = {
  /**
   * Reads the file's shape without importing it.
   *
   * MIDI is the one format that cannot be imported without deciding things: a
   * performance has no bar lines, no clefs and no key, and every one of those
   * is a guess somebody may want to correct. `defaultMidiImportOptions` turns
   * the summary into an answer, which is what makes an import possible with no
   * wizard at all — and what the wizard opens pre-filled with.
   */
  analyzeMidi(bytes: ArrayBuffer): MidiSummary;
  openMidi(
    bytes: ArrayBuffer,
    options: MidiImportOptions,
  ): { score: Score; warnings: readonly string[] };
  openMusicXml(
    text: string,
    warnings: Record<string, unknown>,
  ): Promise<{ score: Score; warnings: readonly string[] }>;
  /**
   * Reads a tracker module.
   *
   * No warnings, and that is not an omission: a module states every note and
   * instrument outright, so unlike MIDI or audio there is nothing to estimate
   * and nothing to report having guessed. The format is chosen by magic bytes
   * rather than by extension, so a mis-named file still imports.
   */
  openTracker(bytes: ArrayBuffer): { score: Score };
};

export type ImportResult = {
  document: MusicDocument;
  warnings: readonly string[];
};

/** Reads the bytes an import needs; the same seam `DocumentFileStorage` is. */
export type ImportSource = {
  readText(uri: string): Promise<string>;
  readBytes(uri: string): Promise<ArrayBuffer>;
};

/**
 * Where an import lands: a new server project when somebody is signed in, a
 * local document otherwise (decision 2 of the parity plan, shared with the
 * web, where every import already ends in a new project).
 *
 * **Offline falls back to local rather than failing.** A phone on a train is
 * signed in and has no server, and refusing to open a file it can decode
 * perfectly well would be the app punishing somebody for the network. The
 * fall-back is taken for a failure to *reach* the server; a server that answers
 * and refuses (an `ApiError`) is reported, because that is a real answer and
 * quietly keeping the score local would hide it.
 *
 * A project is built from the create response rather than re-read: writes
 * return metadata about the score, the score is the one just sent, and a
 * second request would download it straight back.
 */
async function place(
  services: DocumentServices,
  score: Score,
  title: string,
): Promise<MusicDocument> {
  const { context } = services;
  if (hasServer(context) && (await context.getToken()) !== null) {
    try {
      const { client, token } = await authorizedServer(context);
      const saved = await client.createProject(
        { name: title, score: projectScoreForServer(score) },
        token,
      );
      return newDocument(services, {
        score,
        title,
        origin: { kind: 'project', projectId: saved.id },
        serverUpdatedAt: saved.updatedAt,
      });
    } catch (error) {
      if (error instanceof ApiError || error instanceof AuthRequiredError) {
        throw error;
      }
      // Unreachable: keep the work, locally.
    }
  }
  return newDocument(services, {
    score,
    title,
    // Deliberately unsaved: this came from a .mid, .musicxml or a tracker
    // module, and writing a Moosiac document back over it would lose
    // everything that format cannot hold.
  });
}

export async function importDocument(
  list: DocumentList,
  services: DocumentServices,
  source: ImportSource,
  importer: ScoreImporter,
  format: ImportFormat,
  uri: string,
  warningCopy: Record<string, unknown> = {},
  /**
   * The MIDI options the reader chose, if they were asked.
   *
   * Omitted, the defaults derived from the file's own analysis are used — which
   * is what makes "import this file" a single tap for somebody who does not
   * want to think about quantization grids.
   */
  midiOptions?: MidiImportOptions,
): Promise<ImportResult> {
  let score: Score;
  let warnings: readonly string[];
  /**
   * A name the file itself stated, where the format has one.
   *
   * Only a project file does. Everything else is named by `importedTitle` off
   * the score and the file name, which is the right answer for a `.mid` — but a
   * `.moo` carries the name the reader gave it, and deriving one over the top
   * would rename somebody's document on the way in.
   */
  let statedTitle: string | null = null;

  if (format === 'midi') {
    const bytes = await source.readBytes(uri);
    const options =
      midiOptions ?? defaultMidiImportOptions(importer.analyzeMidi(bytes));
    const result = importer.openMidi(bytes, options);
    score = result.score;
    warnings = result.warnings;
  } else if (format === 'tracker') {
    const bytes = await source.readBytes(uri);
    score = importer.openTracker(bytes).score;
    warnings = [];
  } else if (format === 'project') {
    /*
      A Moosiac document, read by music_codecs' own parser (through music_lib,
      which re-exports it — this app may not depend on music_codecs directly).
      It is not a call on `music_io` like the other three, because a project
      file is not a *notation* format: it is this app's own document, and
      `parseProjectFile` is the same reader the macOS File → Open uses and the
      same one that reads a `moosiac://` link.

      Text, not bytes: it is JSON. A file this parser refuses throws a
      `ProjectFileError` carrying a `reason`, which the caller words — a
      newer-version document is refused rather than read hopefully, because
      losing half a score on the next save is worse than not opening it.

      No warnings: the format holds everything this app can express, so unlike
      MIDI or MusicXML there is nothing that had to be dropped to get it in.
    */
    const file = parseProjectFile(await source.readText(uri));
    score = file.score;
    statedTitle = file.title;
    warnings = [];
  } else {
    const text = await source.readText(uri);
    const result = await importer.openMusicXml(text, warningCopy);
    score = result.score;
    warnings = result.warnings;
  }

  const fileName = uri.split('/').pop() ?? '';
  const document = list.open(
    await place(services, score, statedTitle || importedTitle(score, fileName)),
  );
  return { document, warnings };
}
