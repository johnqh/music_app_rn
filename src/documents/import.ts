/**
 * Bringing a MIDI or MusicXML file in as a new document.
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
 * The imported document has no file origin. It came from a `.mid`, and writing
 * a Moosiac document back over a MIDI file would destroy everything the format
 * cannot hold — so it is unsaved until somebody says where it goes.
 */
import { defaultMidiImportOptions } from '@sudobility/music_lib';
import type { MidiImportOptions, MidiSummary } from '@sudobility/music_lib';
import type { Score } from '@sudobility/music_types';
import { createDocument } from './document';
import type { MusicDocument } from './document';
import type { DocumentList } from './document-list';

export const IMPORT_FORMATS = ['midi', 'musicxml', 'tracker'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/**
 * The extensions a picker offers for each format.
 *
 * Tracker modules are six formats read by one decoder, chosen by magic bytes
 * rather than by extension — so a mis-named module still imports, and this list
 * only decides what the picker greys out.
 */
export const IMPORT_EXTENSIONS: Record<ImportFormat, readonly string[]> = {
  midi: ['mid', 'midi'],
  musicxml: ['musicxml', 'xml', 'mxl'],
  tracker: ['mod', 'dsm', 's3m', 'xm', 'it', 'mptm'],
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

/** Reads the bytes an import needs; the same seam `DocumentStorage` uses. */
export type ImportSource = {
  readText(uri: string): Promise<string>;
  readBytes(uri: string): Promise<ArrayBuffer>;
};

function titleFor(score: Score, uri: string): string {
  const stored = score.metadata.title?.trim();
  if (stored) return stored;
  // Falling back to the filename, minus its extension — a MIDI file often
  // carries no title at all, and "Untitled" tells the reader less than the
  // name they picked the file by.
  const base = uri.split('/').pop() ?? 'Untitled';
  return base.replace(/\.[^.]+$/, '') || 'Untitled';
}

let nextId = 0;

export async function importDocument(
  list: DocumentList,
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
  } else {
    const text = await source.readText(uri);
    const result = await importer.openMusicXml(text, warningCopy);
    score = result.score;
    warnings = result.warnings;
  }

  nextId += 1;
  const document = list.open(
    createDocument({
      id: `import-${nextId}`,
      title: titleFor(score, uri),
      score,
      // Deliberately unsaved: this came from a .mid, .musicxml or a tracker
      // module, and writing a Moosiac document back over it would lose
      // everything that format cannot hold.
      origin: { kind: 'unsaved' },
    }),
  );
  return { document, warnings };
}
