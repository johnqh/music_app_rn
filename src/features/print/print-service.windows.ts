import { isSupported, printPages } from '@moosiac/print';
import { printPlan } from '@sudobility/music_drawing';
import type { PrintPlanOptions } from '@sudobility/music_drawing';
import type { Score } from '@sudobility/music_types';
import type { PrintHooks, PrintResult } from './print-service';
import { renderPrintPages } from './print-pages.windows';

export function canPrint(): boolean {
  return isSupported();
}

export async function printScore(
  score: Score,
  options: PrintPlanOptions = {},
  hooks: PrintHooks = {},
): Promise<PrintResult> {
  const plan = printPlan(score, options);
  const pages = plan ? renderPrintPages(plan) : [];
  if (hooks.isCancelled?.()) return 'cancelled';
  if (pages.length === 0) throw new Error('There was nothing to print.');
  await hooks.beforeDialog?.();
  const jobName = score.metadata.title?.trim() || 'Score';
  const printed = await printPages(jobName, pages);
  return printed ? 'printed' : 'cancelled';
}
