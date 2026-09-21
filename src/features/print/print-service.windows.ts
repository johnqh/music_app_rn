/** Windows has no native print bridge in this app yet. */
import type { PrintPlanOptions } from '@sudobility/music_drawing';
import type { Score } from '@sudobility/music_types';
import type { PrintResult } from './print-service';

export function canPrint(): boolean {
  return false;
}

export async function printScore(
  _score: Score,
  _options: PrintPlanOptions = {},
): Promise<PrintResult> {
  throw new Error('Printing is not supported on Windows yet.');
}
