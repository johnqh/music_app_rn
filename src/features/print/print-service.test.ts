/**
 * What printing resolves to.
 *
 * Cancelling at the print dialog is an ordinary outcome, not an error. Making
 * it a rejection would put a `try` around every call site for somebody
 * changing their mind — and the two are told apart nowhere else, so if this
 * is wrong the caller reports a failure that did not happen.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEmptyScore } from '@sudobility/music_types';

const printPages =
  vi.fn<(name: string, pages: unknown[]) => Promise<boolean>>();
const renderPrintPages = vi.fn(() => [
  { base64: 'AAA', width: 1000, height: 1400 },
]);

vi.mock('@moosiac/print', () => ({
  isSupported: () => true,
  printPages: (name: string, pages: unknown[]) => printPages(name, pages),
}));
vi.mock('./print-pages.js', () => ({
  renderPrintPages: () => renderPrintPages(),
}));

const { printScore } = await import('./print-service.js');

beforeEach(() => {
  printPages.mockReset();
  renderPrintPages.mockClear();
});

describe('printScore', () => {
  it('reports a cancelled dialog as cancelled, not as a failure', async () => {
    printPages.mockResolvedValue(false);
    await expect(printScore(createEmptyScore({ title: 'A' }))).resolves.toBe(
      'cancelled',
    );
  });

  it('reports a submitted job as printed', async () => {
    printPages.mockResolvedValue(true);
    await expect(printScore(createEmptyScore({ title: 'A' }))).resolves.toBe(
      'printed',
    );
  });

  it('names the job after the score, which is what appears in the queue', async () => {
    printPages.mockResolvedValue(true);
    await printScore(createEmptyScore({ title: 'String Quartet' }));
    expect(printPages).toHaveBeenCalledWith(
      'String Quartet',
      expect.any(Array),
    );
  });

  it('falls back to a name rather than sending an empty one', async () => {
    // An untitled score would otherwise appear in the print queue as "".
    printPages.mockResolvedValue(true);
    await printScore(createEmptyScore({ title: '' }));
    expect(printPages).toHaveBeenCalledWith('Score', expect.any(Array));
  });

  it('refuses when there is nothing to print', async () => {
    renderPrintPages.mockReturnValueOnce([]);
    printPages.mockResolvedValue(true);
    await expect(printScore(createEmptyScore({ title: 'A' }))).rejects.toThrow(
      /nothing to print/i,
    );
    expect(printPages).not.toHaveBeenCalled();
  });
});
