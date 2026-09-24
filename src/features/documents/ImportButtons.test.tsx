/**
 * Importing a file.
 *
 * Three rules matter and none is visible to types. **Cancelling is not a
 * failure** — a picker dismissed without a choice must produce no document and
 * no error dialog, or changing your mind reads as something going wrong.
 * **Warnings are shown rather than swallowed**: a MusicXML file can carry
 * things this model does not hold, and a silent import that quietly drops a
 * third of the markings is worse than one that says what it left behind. And
 * **MIDI asks before it imports** — bar lines, clefs and key are all guesses
 * there, so the file is analysed and the wizard opened rather than a set of
 * assumptions applied silently.
 */
import { jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { renderWithApp } from '@/test/render';
import { installTestAppServices } from '@/config/initialize';

/*
  Prefixed `mock`, which jest requires: a factory may not close over an
  arbitrary outer variable, because it runs before the module body and would
  otherwise capture an uninitialised one.
*/
const mockPickFile = jest.fn<() => Promise<string | null>>();
const mockImportDocument =
  jest.fn<() => Promise<{ warnings: readonly string[] }>>();

jest.mock('@/documents/file-picker', () => ({
  createFilePicker: () => ({
    isSupported: () => true,
    pickFile: () => mockPickFile(),
    pickSaveLocation: async () => null,
  }),
}));
jest.mock('@/documents/import', () => ({
  IMPORT_EXTENSIONS: {
    midi: ['mid'],
    musicxml: ['xml'],
    tracker: ['xm'],
    project: ['moo', 'moosiac', 'json'],
  },
  importDocument: () => mockImportDocument(),
}));
/*
  The bytes a MIDI import reads before it can be analysed. Mocked because the
  real one goes through `react-native-fs`, which has no filesystem here — and
  the point of the MIDI test below is the *asking*, not the reading.
*/
jest.mock('@/documents/rn-storage', () => ({
  createImportSource: () => ({
    readText: async () => '',
    readBytes: async () => new ArrayBuffer(0),
  }),
}));
/*
  No mock for `@/config/initialize`: `renderWithApp` installs stand-in
  services, and `importDocument` is mocked anyway so `io` is never touched. A
  wholesale factory here silently dropped every *other* export of that module,
  which is how the shared render helper lost `appServicesInstalled` and every
  test in this file failed on a function it does not mention.
*/

const { ImportButtons } =
  require('./ImportButtons') as typeof import('./ImportButtons');

function setup() {
  const list = new DocumentList();
  const view = renderWithApp(
    <DocumentsProvider list={list}>
      <ImportButtons />
    </DocumentsProvider>,
  );
  return { view, list };
}

/**
 * Opens the Import menu.
 *
 * Four buttons became one Select, so a format's label only exists once this has
 * run. It is separate from choosing because opening is a state update: inside
 * an `act` block it would not have flushed by the time the option is looked up,
 * so the menu is opened first and the choice made inside.
 */
function openImportMenu(view: ReturnType<typeof setup>['view']) {
  fireEvent.press(view.getByLabelText('Import a file'));
}

function choose(view: ReturnType<typeof setup>['view'], label: string) {
  openImportMenu(view);
  fireEvent.press(view.getByText(label));
}

beforeEach(() => {
  mockPickFile.mockReset();
  mockImportDocument.mockReset();
});

describe('ImportButtons', () => {
  it('offers every format from one control', () => {
    // Four buttons that differed by a word were one decision — which file —
    // spread across four controls.
    const { view } = setup();
    fireEvent.press(view.getByLabelText('Import a file'));
    for (const label of [
      'Import MIDI',
      'Import MusicXML',
      'Import Tracker Module',
      'Import Audio',
      // A `.moo` could be written from the export sheet and never read back:
      // Open lives on the macOS File menu, which touch platforms have not got.
      'Import project file',
    ]) {
      expect(view.getByText(label)).toBeTruthy();
    }
  });

  it('keeps reading "Import" rather than becoming the last format chosen', () => {
    // A menu, not a value. Held with no `value`, so the trigger goes on saying
    // what the control does.
    const { view } = setup();
    choose(view, 'Import Tracker Module');
    expect(view.getByText('Import')).toBeTruthy();
  });

  it('imports nothing and says nothing when the picker is cancelled', async () => {
    mockPickFile.mockResolvedValue(null);
    const { view } = setup();
    openImportMenu(view);
    await act(async () => {
      fireEvent.press(view.getByText('Import MIDI'));
    });
    expect(mockImportDocument).not.toHaveBeenCalled();
    expect(view.queryByText('Could not import')).toBeNull();
  });

  it('shows the decoder warnings rather than swallowing them', async () => {
    // Through MusicXML, which goes straight in: MIDI stops at the wizard now,
    // and the warning plumbing is the same for every format.
    mockPickFile.mockResolvedValue('/tmp/a.xml');
    mockImportDocument.mockResolvedValue({ warnings: ['a track was empty'] });
    const { view } = setup();
    openImportMenu(view);
    await act(async () => {
      fireEvent.press(view.getByText('Import MusicXML'));
    });
    await waitFor(() =>
      expect(view.getByText('a track was empty')).toBeTruthy(),
    );
  });

  it('says nothing at all when there was nothing to report', async () => {
    // A dialog that always appears is one people dismiss without reading.
    mockPickFile.mockResolvedValue('/tmp/a.xml');
    mockImportDocument.mockResolvedValue({ warnings: [] });
    const { view } = setup();
    openImportMenu(view);
    await act(async () => {
      fireEvent.press(view.getByText('Import MusicXML'));
    });
    expect(view.queryByText('Imported, with notes')).toBeNull();
  });

  it('reports a failure as a failure', async () => {
    mockPickFile.mockResolvedValue('/tmp/a.xml');
    mockImportDocument.mockRejectedValue(new Error('not a MusicXML file'));
    const { view } = setup();
    openImportMenu(view);
    await act(async () => {
      fireEvent.press(view.getByText('Import MusicXML'));
    });
    await waitFor(() =>
      expect(view.getByText('not a MusicXML file')).toBeTruthy(),
    );
  });

  it('reports a refused audio upload instead of dropping it', async () => {
    /*
      The sheet calls the upload fire-and-forget, so a rejection used to vanish
      as an unhandled promise: the spinner stopped and nothing said why.
    */
    mockPickFile.mockResolvedValue('/tmp/take.wav');
    const onTranscribeAudio = jest.fn(async () => {
      throw new Error('recording too long');
    });
    const list = new DocumentList();
    const view = renderWithApp(
      <DocumentsProvider list={list}>
        <ImportButtons onTranscribeAudio={onTranscribeAudio} />
      </DocumentsProvider>,
    );
    openImportMenu(view);
    // The sheet opens the OS picker itself the moment it opens — there is no
    // "Choose a recording" step to press any more, see `AudioImportSheet`.
    await act(async () => {
      fireEvent.press(view.getByText('Import Audio'));
    });
    await act(async () => {
      fireEvent.press(view.getByText('Transcribe'));
    });
    expect(onTranscribeAudio).toHaveBeenCalled();
    await waitFor(() =>
      expect(view.getByText('recording too long')).toBeTruthy(),
    );
  });

  /*
    MIDI is the one format that cannot be imported without deciding things — a
    performance has no bar lines, no clefs and no key. Importing it blind
    applied a set of guesses nobody was shown and nobody could correct, which
    is what this stops.
  */
  it('asks before importing a MIDI file rather than guessing silently', async () => {
    mockPickFile.mockResolvedValue('/tmp/a.mid');
    // One track, so the wizard has something to list. The summary is the whole
    // input to the wizard, which is why a stub of it is enough.
    installTestAppServices({
      io: {
        analyzeMidi: () => ({
          ppq: 480,
          durationSeconds: 12,
          tracks: [
            {
              index: 0,
              name: 'Piano',
              channel: 0,
              program: 0,
              instrumentName: 'Acoustic Grand Piano',
              noteCount: 42,
              durationSeconds: 12,
              isPercussion: false,
              averageMidi: 60,
            },
          ],
          tempoEvents: [],
          timeSignatures: [],
          detectedGrid: { grid: 'sixteenth', confident: true },
        }),
      } as never,
    });
    const { view } = setup();
    openImportMenu(view);
    await act(async () => {
      fireEvent.press(view.getByText('Import MIDI'));
    });
    // Analysed and offered, not imported: the wizard is open and the importer
    // has not been called.
    expect(mockImportDocument).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(view.getByText(/choose which tracks/i)).toBeTruthy(),
    );
  });
});
