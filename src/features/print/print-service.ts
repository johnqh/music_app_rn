/**
 * Sending a score to the printer.
 *
 * Three steps, and the split matters: music_drawing's `printPlan` decides what
 * reaches paper (shared with the web print view), `renderPrintPages` draws each
 * page with the renderer the editor already uses, and the native module hands
 * the images to the platform's print service. Nothing writes a PDF — every one
 * of the three services takes a drawing and produces the document itself.
 *
 * Rendering is synchronous and can take a moment on a long score, so callers
 * should show that something is happening before calling this.
 */
import { isSupported, printPages } from '@moosiac/print';
import { printPlan } from '@sudobility/music_drawing';
import type { PrintPlanOptions } from '@sudobility/music_drawing';
import type { Score } from '@sudobility/music_types';
import { renderPrintPages } from './print-pages';

export type PrintResult = 'printed' | 'cancelled';

/** True when this build has a print service to talk to. */
export function canPrint(): boolean {
  return isSupported();
}

/**
 * Prints `score` (the stored score) with the reader's choices, resolving how
 * it ended.
 *
 * Cancelling resolves `'cancelled'` rather than rejecting: changing your mind
 * at the print dialog is an ordinary outcome, and making it an exception would
 * put a `try` around every call site for something that is not an error.
 */
export async function printScore(
  score: Score,
  options: PrintPlanOptions = {},
): Promise<PrintResult> {
  const plan = printPlan(score, options);
  const pages = plan ? renderPrintPages(plan) : [];
  if (pages.length === 0) throw new Error('There was nothing to print.');
  const jobName = score.metadata.title?.trim() || 'Score';
  const printed = await printPages(jobName, [...pages]);
  return printed ? 'printed' : 'cancelled';
}
