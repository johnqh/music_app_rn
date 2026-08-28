/**
 * Importing a file.
 *
 * Two rules matter and neither is visible to types. **Cancelling is not a
 * failure** — a picker dismissed without a choice must produce no document and
 * no error dialog, or changing your mind reads as something going wrong. And
 * **warnings are shown rather than swallowed**: a MusicXML file can carry
 * things this model does not hold, and a silent import that quietly drops a
 * third of the markings is worse than one that says what it left behind.
 */
import { jest } from '@jest/globals';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { DocumentList } from '@/documents/document-list';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { renderWithApp } from '@/test/render';

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
  IMPORT_EXTENSIONS: { midi: ['mid'], musicxml: ['xml'], tracker: ['xm'] },
  importDocument: () => mockImportDocument(),
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

beforeEach(() => {
  mockPickFile.mockReset();
  mockImportDocument.mockReset();
});

describe('ImportButtons', () => {
  it('offers one entry point per format', () => {
    const { view } = setup();
    expect(view.getByText('Import MIDI')).toBeTruthy();
    expect(view.getByText('Import MusicXML')).toBeTruthy();
    expect(view.getByText('Import module')).toBeTruthy();
  });

  it('imports nothing and says nothing when the picker is cancelled', async () => {
    mockPickFile.mockResolvedValue(null);
    const { view } = setup();
    await act(async () => {
      fireEvent.press(view.getByText('Import MIDI'));
    });
    expect(mockImportDocument).not.toHaveBeenCalled();
    expect(view.queryByText('Could not import')).toBeNull();
  });

  it('shows the decoder warnings rather than swallowing them', async () => {
    mockPickFile.mockResolvedValue('/tmp/a.mid');
    mockImportDocument.mockResolvedValue({ warnings: ['a track was empty'] });
    const { view } = setup();
    await act(async () => {
      fireEvent.press(view.getByText('Import MIDI'));
    });
    await waitFor(() =>
      expect(view.getByText('a track was empty')).toBeTruthy(),
    );
  });

  it('says nothing at all when there was nothing to report', async () => {
    // A dialog that always appears is one people dismiss without reading.
    mockPickFile.mockResolvedValue('/tmp/a.mid');
    mockImportDocument.mockResolvedValue({ warnings: [] });
    const { view } = setup();
    await act(async () => {
      fireEvent.press(view.getByText('Import MIDI'));
    });
    expect(view.queryByText('Imported, with notes')).toBeNull();
  });

  it('reports a failure as a failure', async () => {
    mockPickFile.mockResolvedValue('/tmp/a.mid');
    mockImportDocument.mockRejectedValue(new Error('not a MIDI file'));
    const { view } = setup();
    await act(async () => {
      fireEvent.press(view.getByText('Import MIDI'));
    });
    await waitFor(() => expect(view.getByText('not a MIDI file')).toBeTruthy());
  });
});
