/**
 * Sending a score to the printer.
 *
 * Two steps, and the split matters: `renderPrintPages` produces the page
 * images with the renderer the editor already uses, and the native module
 * hands them to the platform's print service. Neither step writes a PDF —
 * every one of the three services takes a drawing and produces the document
 * itself.
 *
 * Rendering is synchronous and can take a moment on a long score, so callers
 * should show that something is happening before calling this.
 */
import { isSupported, printPages } from '@moosiac/print';
import { renderPrintPages } from './print-pages';
import type { PrintOptions } from './print-plan';
import type { Score } from '@sudobility/music_types';

export type PrintResult = 'printed' | 'cancelled';

/** True when this build has a print service to talk to. */
export function canPrint(): boolean {
  return isSupported();
}

/**
 * Prints `score`, resolving how it ended.
 *
 * Cancelling resolves `'cancelled'` rather than rejecting: changing your mind
 * at the print dialog is an ordinary outcome, and making it an exception would
 * put a `try` around every call site for something that is not an error.
 */
export async function printScore(
  score: Score,
  options: PrintOptions = {},
): Promise<PrintResult> {
  const pages = renderPrintPages(score, options);
  if (pages.length === 0) throw new Error('There was nothing to print.');
  const jobName = score.metadata.title?.trim() || 'Score';
  const printed = await printPages(jobName, [...pages]);
  return printed ? 'printed' : 'cancelled';
}
