/**
 * Exporting a document.
 *
 * **What an export writes is music_editing's `planExport`.** The formats, their
 * order, their extensions, their labels and which score a scope means are facts
 * about the product, and the web app's export menu reads the same
 * `WRITABLE_EXPORT_FORMATS` — this file used to hold its own `EXPORT_FORMATS`
 * and extension table beside it, which is how the native app came to offer
 * five formats where the web offered six (it had no project file). What stays
 * here is only what that package may not reach: the filename (music_codecs'
 * keep-the-title rule, through music_lib), rendering audio (a live synth in
 * music_player, injected), fitting a tracker module (music_lib's
 * `scoreToTracker`) and the write itself (music_io, injected).
 *
 * **Audio and the tracker module are the deliberate exceptions to "one codec
 * call".** Audio is rendered and only then handed over as PCM, because a codec
 * is a pure function music_io may call while a synth is not. A tracker module
 * is built here because the *fit report* has to be shown before anything is
 * written — a clean fit costs no extra tap, anything lost shows the numbers
 * first (see `ExportSheet`).
 *
 * **The project file is `.moo`**, the document format this app opens and saves
 * — not the plan's `json`, which is what the shared list still says. It carries
 * the document's title, as the web's carries the project's name, so opening it
 * back names it what it was.
 *
 * The filename of every other format comes from the **score's** title, not the
 * document's. `metadata.title` is what the piece is called; a document's title
 * is what the row on disk is called. Renaming a file should not rename the music.
 */
import {
  DOCUMENT_EXTENSION,
  exportFilename,
  scoreToTracker,
  serializeProjectFile,
} from '@sudobility/music_lib';
import type { TrackerFitReport } from '@sudobility/music_lib';
import { planExport } from '@sudobility/music_editing';
import type {
  ExportFormatId,
  ExportPlan,
  ExportScope,
} from '@sudobility/music_editing';
import type { Score, TrackerModule } from '@sudobility/music_types';
import type { MusicDocument } from './document';

export type ExportFormat = ExportFormatId;

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
  fileExporter: {
    save(name: string, data: Uint8Array | string, mime: string): Promise<void>;
  };
};

/** Renders a score to PCM; injected because it is a live synth, not a codec. */
export type AudioRenderer = (
  score: Score,
) => Promise<{ samples: Float32Array; sampleRate: number }>;

/**
 * The file a plan writes: the title kept as written, with only the characters
 * a filesystem reserves replaced — and `.moo` for a project.
 */
export function planFilename(plan: ExportPlan): string {
  return exportFilename(
    plan.title,
    plan.route === 'project' ? DOCUMENT_EXTENSION : plan.extension,
  );
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

/**
 * Writes `format` at `scope` and resolves the file name written.
 *
 * `scope` is the reader's answer about hidden tracks — only the screen can ask
 * it, so it is passed in; `'all'` is what an export with nothing hidden means.
 * A project ignores it inside `planExport`: hiding a track is a view
 * preference, and saving the project must not throw a part away.
 */
export async function exportDocument(
  document: MusicDocument,
  exporter: ScoreExporter,
  format: ExportFormat,
  renderAudio?: AudioRenderer,
  scope: ExportScope = 'all',
): Promise<string> {
  const plan = planExport(document.store, format, scope);
  if (!plan) throw new Error('Cannot export a document with no score.');
  const filename = planFilename(plan);
  const { target } = plan;

  switch (plan.route) {
    case 'notation':
      if (plan.format === 'midi') await exporter.saveMidi(target, filename);
      else await exporter.saveMusicXml(target, filename);
      break;
    case 'tracker':
      await exporter.saveTracker(prepareTrackerExport(target).module, filename);
      break;
    case 'audio': {
      if (!renderAudio) {
        throw new Error(`Exporting ${plan.format} needs an audio renderer.`);
      }
      const audio = await renderAudio(target);
      await exporter.saveAudio(
        audio.samples,
        audio.sampleRate,
        plan.format as 'wav' | 'mp3',
        filename,
      );
      break;
    }
    case 'project':
      await exporter.fileExporter.save(
        filename,
        serializeProjectFile({
          title: document.store.getState().title || plan.title,
          score: target,
        }),
        'application/json',
      );
      break;
  }
  return filename;
}
