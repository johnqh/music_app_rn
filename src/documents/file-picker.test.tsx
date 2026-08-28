/**
 * Asking the user for a file, on iOS/iPadOS and Android.
 *
 * Named `.test.tsx` despite testing no component: the runner split here is by
 * extension, and this module imports `@react-native-documents/picker`, whose
 * React Native source `node` cannot parse. Jest with the RN preset can; vitest
 * cannot, so a `.test.ts` here would not run at all.
 *
 * Three behaviours are worth pinning, and each fails silently rather than
 * loudly:
 *
 *   - **cancelling resolves null**, not a rejection, so no call site needs a
 *     `try` around an ordinary change of mind;
 *   - filters go out as bare **extensions**, never MIME types — `.mid` is
 *     served as at least three different ones in the wild, and filtering on one
 *     greys out files the app reads perfectly well;
 *   - a picked URI is a **loan**: on iOS it points inside the provider's
 *     sandbox and stops resolving once the picker closes, so the file is copied
 *     into the app's own space first. Skip that and it works on the simulator
 *     and fails on a real device with iCloud Drive — the worst possible split.
 */
import { jest } from '@jest/globals';

/*
  `mock`-prefixed on purpose: jest hoists the `jest.mock` factory above every
  import in the file, so any variable it closes over must be one jest can prove
  is a mock. A bare `pick` here fails the whole suite to run.
*/
const mockPick = jest.fn();
const mockKeepLocalCopy = jest.fn();

jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: unknown[]) => mockPick(...args),
  keepLocalCopy: (...args: unknown[]) => mockKeepLocalCopy(...args),
}));

// Imported after the mock is registered.
const { createFilePicker } =
  require('./file-picker') as typeof import('./file-picker');

beforeEach(() => {
  mockPick.mockReset();
  mockKeepLocalCopy.mockReset();
});

describe('createFilePicker', () => {
  it('reports that this build can ask for a file', () => {
    expect(createFilePicker().isSupported()).toBe(true);
  });

  it('filters on bare extensions rather than MIME types', () => {
    mockPick.mockResolvedValue([] as never);
    return createFilePicker()
      .pickFile(['mid', 'midi'])
      .then(() => {
        expect(mockPick).toHaveBeenCalledTimes(1);
        const options = mockPick.mock.calls[0][0] as {
          type: string[];
          allowMultiSelection: boolean;
        };
        expect(options.type).toEqual(['.mid', '.midi']);
        expect(options.allowMultiSelection).toBe(false);
      });
  });

  it('resolves null when the user cancels, rather than throwing', async () => {
    mockPick.mockResolvedValue([] as never);
    await expect(createFilePicker().pickFile(['mid'])).resolves.toBeNull();
    // The loan-copy step must not run for a file that was never chosen.
    expect(mockKeepLocalCopy).not.toHaveBeenCalled();
  });

  it('copies the picked file locally and returns that copy', async () => {
    mockPick.mockResolvedValue([
      { uri: 'content://loaned', name: 'a.mid' },
    ] as never);
    mockKeepLocalCopy.mockResolvedValue([
      { status: 'success', localUri: 'file:///caches/a.mid' },
    ] as never);
    await expect(createFilePicker().pickFile(['mid'])).resolves.toBe(
      'file:///caches/a.mid',
    );
    const copyArgs = mockKeepLocalCopy.mock.calls[0][0] as {
      files: Array<{ uri: string; fileName: string }>;
      destination: string;
    };
    expect(copyArgs.files[0]).toEqual({
      uri: 'content://loaned',
      fileName: 'a.mid',
    });
    expect(copyArgs.destination).toBe('cachesDirectory');
  });

  it('falls back to the original URI when the copy fails', async () => {
    // Better to hand back a URI that may still resolve than to fail the import
    // outright over a caching step.
    mockPick.mockResolvedValue([
      { uri: 'content://loaned', name: 'a.mid' },
    ] as never);
    mockKeepLocalCopy.mockResolvedValue([{ status: 'error' }] as never);
    await expect(createFilePicker().pickFile(['mid'])).resolves.toBe(
      'content://loaned',
    );
  });

  it('names an unnamed file rather than passing undefined along', async () => {
    mockPick.mockResolvedValue([{ uri: 'content://loaned' }] as never);
    mockKeepLocalCopy.mockResolvedValue([
      { status: 'success', localUri: 'file:///caches/import' },
    ] as never);
    await createFilePicker().pickFile(['mid']);
    const copyArgs = mockKeepLocalCopy.mock.calls[0][0] as {
      files: Array<{ fileName: string }>;
    };
    expect(copyArgs.files[0].fileName).toBe('import');
  });

  it('has no save panel, so the caller falls back to sharing', async () => {
    // iOS and Android hand a finished file to a share sheet instead; null means
    // "no location was chosen", which is what the export path expects.
    await expect(
      createFilePicker().pickSaveLocation('score.mid'),
    ).resolves.toBeNull();
  });
});
