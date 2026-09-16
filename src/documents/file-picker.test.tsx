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
 *   - the filter is whatever *the device* calls the extension — a UTType
 *     identifier on iOS, a MIME type on Android — and it **widens to every
 *     file** the moment one extension has no such name. That is `.moo`: this
 *     app's own document, registered nowhere, so a filter listing only its
 *     siblings greys out the exact file Import was tapped for;
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

/**
 * What the device says each extension is called, per platform.
 *
 * The two answer *differently shaped* results and that is the point of having
 * both here: iOS fills in `UTType` **and** `mimeType` (it builds a `UTType` and
 * reads `preferredMIMEType` off it), Android fills in `mimeType` alone and
 * leaves `UTType` null. Reading the MIME type first therefore works on Android
 * and silently breaks iOS, where `UTType('audio/midi')` is not an identifier
 * and gets dropped exactly as a bare `.mid` was.
 *
 * `moo` is in neither, because it is in neither on a real device — it is this
 * app's own document — and that is the case these tests exist for.
 */
const KNOWN: Record<string, { mime: string; uti: string }> = {
  mid: { mime: 'audio/midi', uti: 'public.midi-audio' },
  midi: { mime: 'audio/midi', uti: 'public.midi-audio' },
  xml: { mime: 'text/xml', uti: 'public.xml' },
};

/**
 * Which platform the mocked picker is pretending to be.
 *
 * `mock`-prefixed because the `jest.mock` factory below closes over it, and
 * jest hoists that factory above every declaration in the file — only a name it
 * can prove is a mock is allowed through. Same rule as `mockPick`.
 */
let mockPlatform: 'ios' | 'android' = 'android';

jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: unknown[]) => mockPick(...args),
  keepLocalCopy: (...args: unknown[]) => mockKeepLocalCopy(...args),
  types: { allFiles: '*/*' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e,
  isKnownType: ({ value }: { kind: string; value: string }) => {
    const known = KNOWN[value];
    if (!known) {
      return {
        isKnown: false,
        mimeType: null,
        UTType: null,
        preferredFilenameExtension: null,
      };
    }
    return {
      isKnown: true,
      mimeType: known.mime,
      // The whole asymmetry, in one line.
      UTType: mockPlatform === 'ios' ? known.uti : null,
      preferredFilenameExtension: value,
    };
  },
}));

// Imported after the mock is registered.
const { createFilePicker } =
  require('./file-picker') as typeof import('./file-picker');

beforeEach(() => {
  mockPick.mockReset();
  mockKeepLocalCopy.mockReset();
  mockPlatform = 'android';
});

/** The options the picker was opened with. */
function pickOptions() {
  return mockPick.mock.calls[0]![0] as {
    type: string[];
    allowMultiSelection: boolean;
  };
}

describe('createFilePicker', () => {
  it('reports that this build can ask for a file', () => {
    expect(createFilePicker().isSupported()).toBe(true);
  });

  it('filters on what the device calls the extension, never the extension', async () => {
    // A bare `.mid` is dropped by iOS's `UTType(identifier)` and matched
    // against nothing by Android's MIME filter — in both cases silently.
    mockPick.mockResolvedValue([] as never);
    await createFilePicker().pickFile(['mid', 'midi']);
    expect(mockPick).toHaveBeenCalledTimes(1);
    expect(pickOptions().type).toEqual(['audio/midi', 'audio/midi']);
    expect(pickOptions().type).not.toContain('.mid');
    expect(pickOptions().allowMultiSelection).toBe(false);
  });

  it('gives iOS the UTType identifier, not the MIME type beside it', async () => {
    /*
      iOS answers with both fields; Android answers with the MIME type alone.
      So "whichever is non-null" has to try `UTType` **first** — the other
      order reads right, passes on Android, and on iOS hands the picker
      `audio/midi`, which is not an identifier and is dropped exactly as the
      bare extension was. Same silent failure, one field along.
    */
    mockPlatform = 'ios';
    mockPick.mockResolvedValue([] as never);
    await createFilePicker().pickFile(['mid', 'midi']);
    expect(pickOptions().type).toEqual([
      'public.midi-audio',
      'public.midi-audio',
    ]);
  });

  it('widens to every file on iOS too when an extension is unknown there', async () => {
    mockPlatform = 'ios';
    mockPick.mockResolvedValue([] as never);
    await createFilePicker().pickFile(['moo', 'moosiac', 'json']);
    expect(pickOptions().type).toEqual(['*/*']);
  });

  it('shows every file when an extension has no name on this device', async () => {
    // `.moo` is this app's own document: no UTI, no MIME, nothing to filter
    // on. Listing its siblings alone would grey out the one file the reader
    // chose Import → project file in order to open.
    mockPick.mockResolvedValue([] as never);
    await createFilePicker().pickFile(['moo', 'moosiac', 'json']);
    expect(pickOptions().type).toEqual(['*/*']);
  });

  it('widens the whole filter, not just the unknown entry', async () => {
    // Dropping the unknown one leaves a filter that looks right and still
    // greys out the file it was widened for.
    mockPick.mockResolvedValue([] as never);
    await createFilePicker().pickFile(['xml', 'moo']);
    expect(pickOptions().type).toEqual(['*/*']);
  });

  it('resolves null when the user cancels, rather than throwing', async () => {
    /*
      Cancelling arrives as a **rejection**, not an empty array — the module
      throws `OPERATION_CANCELED`. This test used to mock an empty resolve,
      which is not what the real picker does, so the contract read as kept
      while production reported *"user canceled the document picker"* in a
      dialog titled "Could not import" on every backed-out import.
    */
    mockPick.mockRejectedValue(
      Object.assign(new Error('user canceled the document picker'), {
        code: 'OPERATION_CANCELED',
      }) as never,
    );
    await expect(createFilePicker().pickFile(['mid'])).resolves.toBeNull();
    // The loan-copy step must not run for a file that was never chosen.
    expect(mockKeepLocalCopy).not.toHaveBeenCalled();
  });

  it('still throws a failure that is not a cancellation', async () => {
    // Swallowing everything would make an unopenable file look like a change
    // of mind: nothing happens, and nothing says why.
    mockPick.mockRejectedValue(
      Object.assign(new Error('cannot open that'), {
        code: 'UNABLE_TO_OPEN_FILE_TYPE',
      }) as never,
    );
    await expect(createFilePicker().pickFile(['mid'])).rejects.toThrow(
      'cannot open that',
    );
  });

  it('resolves null for an empty result too', async () => {
    mockPick.mockResolvedValue([] as never);
    await expect(createFilePicker().pickFile(['mid'])).resolves.toBeNull();
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
