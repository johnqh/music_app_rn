/**
 * Sending a score to the printer.
 *
 * Three steps, and the split matters: music_drawing's `printPlan` decides what
 * reaches paper (shared with the web print view), `renderPrintPages` draws each
 * page with the renderer the editor already uses, and the native module hands
 * the images to the platform's print service. Nothing writes a PDF — every one
 * of the three services takes a drawing and produces the document itself.
 *
 * Rendering a long score takes a while — seconds on a phone — so it yields
 * between pages, and the caller shows a spinner on the CTA that started it.
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

export type PrintHooks = {
  /**
   * Runs after the pages are drawn and before the print dialog is asked for.
   * The caller closes its print-options sheet here and resolves once it is
   * gone: the dialog must never be presented over a sheet that is about to
   * leave, which takes the dialog down with it (see `MoosiacPrint.mm`).
   */
  beforeDialog?: () => Promise<void> | void;
  /** Asked between pages; true abandons the print as `'cancelled'`. */
  isCancelled?: () => boolean;
};

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
  hooks: PrintHooks = {},
): Promise<PrintResult> {
  const plan = printPlan(score, options);
  const pages = plan ? await renderPrintPages(plan, hooks.isCancelled) : [];
  if (pages === null) return 'cancelled';
  if (pages.length === 0) throw new Error('There was nothing to print.');
  await hooks.beforeDialog?.();
  const jobName = score.metadata.title?.trim() || 'Score';
  const printed = await printPages(jobName, pages);
  return printed ? 'printed' : 'cancelled';
}
