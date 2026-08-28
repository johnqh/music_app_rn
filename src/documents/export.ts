/**
 * Exporting a document.
 *
 * Every notation format is a single call on `music_io` — `saveMidi`,
 * `saveMusicXml`, `saveTracker` — which pairs the codec with the file write on
 * the other side of that boundary. The web app used to pair them itself and
 * grew four near-identical handlers doing it; this app does not repeat that.
 *
 * **Audio is the deliberate exception, and so is the tracker module.** Audio is
 * rendered by a live synth in `music_player` and only then handed over as PCM,
 * because a codec is a pure function music_io may call while a synth is not;
 * that is what keeps the two platform packages from depending on each other. A
 * tracker module is built here because the *fit report* has to be shown before
 * anything is written — a clean fit costs no extra tap, anything lost shows the
 * numbers first.
 *
 * The filename comes from the **score's** title, not the document's. They are
 * different things on purpose: `metadata.title` is what the piece is called and
 * is what every exported file is named after, where a document's title is what
 * the row on disk is called. Renaming a file should not rename the music.
 */
import { scoreToTracker } from '@sudobility/music_lib';
import type { TrackerFitReport } from '@sudobility/music_lib';
import type { Score, TrackerModule } from '@sudobility/music_types';
import type { MusicDocument } from './document';

export const EXPORT_FORMATS = ['midi', 'musicxml', 'xm', 'wav', 'mp3'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * The extension each format is written with.
 *
 * A `Record` keyed by the vocabulary rather than a parallel list: adding a
 * format fails to compile until it has an extension, where a list would
 * silently write the wrong one.
 */
const EXTENSIONS: Record<ExportFormat, string> = {
  midi: 'mid',
  musicxml: 'musicxml',
  xm: 'xm',
  wav: 'wav',
  mp3: 'mp3',
};

/** What music_io needs to write a file; injected so this is testable. */
export type ScoreExporter = {
  saveMidi(score: Score, filename: string): Promise<void>;
  saveMusicXml(score: Score, filename: string): Promise<void>;
  saveTracker(module: TrackerModule, filename: string): Promise<void>;
  saveAudio(
    samples: Float32Array,
    sampleRate: number,
    format: 'wav' | 'mp3',
    filename: string,
  ): Promise<void>;
};

/** Renders a score to PCM; injected because it is a live synth, not a codec. */
export type AudioRenderer = (
  score: Score,
) => Promise<{ samples: Float32Array; sampleRate: number }>;

export function exportFilename(score: Score, format: ExportFormat): string {
  const title = (score.metadata.title || 'Untitled').replace(
    /[/\\:*?"<>|]/g,
    '-',
  );
  return `${title.trim() || 'Untitled'}.${EXTENSIONS[format]}`;
}

/**
 * Builds the tracker module and reports what a write would cost.
 *
 * Separate from writing it, because the numbers have to be offered *before*
 * anything lands on disk — the row grid, the channel count and the note range
 * are all lossy, and a reader who is about to lose a bassline's bottom octave
 * should be told rather than shown afterwards.
 */
export function prepareTrackerExport(score: Score): {
  module: TrackerModule;
  report: TrackerFitReport;
} {
  return scoreToTracker(score, { format: 'xm' });
}

export async function exportDocument(
  document: MusicDocument,
  exporter: ScoreExporter,
  format: ExportFormat,
  renderAudio?: AudioRenderer,
): Promise<string> {
  const score = document.store.getState().score;
  if (!score) throw new Error('Cannot export a document with no score.');
  const filename = exportFilename(score, format);

  if (format === 'midi') {
    await exporter.saveMidi(score, filename);
  } else if (format === 'musicxml') {
    await exporter.saveMusicXml(score, filename);
  } else if (format === 'xm') {
    await exporter.saveTracker(prepareTrackerExport(score).module, filename);
  } else {
    if (!renderAudio) {
      throw new Error(`Exporting ${format} needs an audio renderer.`);
    }
    const audio = await renderAudio(score);
    await exporter.saveAudio(audio.samples, audio.sampleRate, format, filename);
  }
  return filename;
}
