/**
 * Opens the OS picker itself, the moment it is asked to — no "Choose a
 * recording" tap standing between selecting Audio and the file dialog.
 */
import { jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { renderWithApp } from '@/test/render';
import { AudioImportSheet } from './AudioImportSheet';

const mockPickFile = jest.fn<() => Promise<string | null>>();

jest.mock('@/documents/file-picker', () => ({
  createFilePicker: () => ({
    isSupported: () => true,
    pickFile: () => mockPickFile(),
    pickSaveLocation: async () => null,
  }),
}));

describe('AudioImportSheet', () => {
  beforeEach(() => mockPickFile.mockReset());

  it('opens the OS picker as soon as it is asked to open', async () => {
    mockPickFile.mockResolvedValue(null);
    renderWithApp(
      <AudioImportSheet open onClose={jest.fn()} onUpload={jest.fn()} />,
    );
    await act(async () => undefined);
    expect(mockPickFile).toHaveBeenCalledTimes(1);
  });

  it('stays off screen until a file is chosen', async () => {
    mockPickFile.mockResolvedValue(null);
    const view = renderWithApp(
      <AudioImportSheet open onClose={jest.fn()} onUpload={jest.fn()} />,
    );
    await act(async () => undefined);
    expect(view.queryByText('Import audio')).toBeNull();
  });

  it('closes the whole flow when the picker is cancelled', async () => {
    mockPickFile.mockResolvedValue(null);
    const onClose = jest.fn();
    renderWithApp(
      <AudioImportSheet open onClose={onClose} onUpload={jest.fn()} />,
    );
    await act(async () => undefined);
    expect(onClose).toHaveBeenCalled();
  });

  it('sends the recording as soon as it is chosen, with nothing to confirm', async () => {
    // Choosing the file is the decision. A dialog after it asked the reader
    // to confirm what they had just done.
    mockPickFile.mockResolvedValue('/tmp/take-3.mp3');
    const onUpload = jest.fn();
    const view = renderWithApp(
      <AudioImportSheet open onClose={jest.fn()} onUpload={onUpload} />,
    );
    await act(async () => undefined);

    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'take-3.mp3' }),
    );
    expect(view.queryByText('Transcribe')).toBeNull();
    expect(view.queryByText('Import audio')).toBeNull();
  });

  it('says the recording is on its way while it is, and offers no way out of it', async () => {
    mockPickFile.mockResolvedValue('/tmp/take-3.mp3');
    const view = renderWithApp(
      <AudioImportSheet open busy onClose={jest.fn()} onUpload={jest.fn()} />,
    );
    await act(async () => undefined);

    expect(view.getByText('Sending the recording…')).toBeTruthy();
    expect(view.queryByText('Cancel')).toBeNull();
  });

  it('opens the picker even where a recording cannot be sent', async () => {
    // Every format on the Import list opens the picker. One that answered
    // with a message instead read as the one that was broken.
    const onUpload = jest.fn();
    renderWithApp(
      <AudioImportSheet
        open
        available={false}
        onClose={jest.fn()}
        onUpload={onUpload}
      />,
    );
    await act(async () => undefined);
    expect(mockPickFile).toHaveBeenCalledTimes(1);
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('says why not once a recording is chosen, and sends nothing', async () => {
    mockPickFile.mockResolvedValue('/tmp/take-3.mp3');
    const onUpload = jest.fn();
    const view = renderWithApp(
      <AudioImportSheet
        open
        available={false}
        onClose={jest.fn()}
        onUpload={onUpload}
      />,
    );
    expect(
      await view.findByText(
        'Audio transcription is not available on this server.',
      ),
    ).toBeTruthy();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('says to sign in, rather than that the server cannot, when that is the reason', async () => {
    // Two ways to be without transcription, with different remedies. A
    // reader who only has to sign in must not be told the feature is absent.
    mockPickFile.mockResolvedValue('/tmp/take-3.mp3');
    const view = renderWithApp(
      <AudioImportSheet
        open
        available={false}
        unavailableReason="signedOut"
        onClose={jest.fn()}
        onUpload={jest.fn()}
      />,
    );
    expect(
      await view.findByText(/^Sign in to import a recording/),
    ).toBeTruthy();
    expect(
      view.queryByText('Audio transcription is not available on this server.'),
    ).toBeNull();
  });

  it('closes without a word when the picker is cancelled where it cannot be sent', async () => {
    mockPickFile.mockResolvedValue(null);
    const onClose = jest.fn();
    const view = renderWithApp(
      <AudioImportSheet
        open
        available={false}
        onClose={onClose}
        onUpload={jest.fn()}
      />,
    );
    await act(async () => undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      view.queryByText('Audio transcription is not available on this server.'),
    ).toBeNull();
  });

  it('does not reopen the picker on an unrelated re-render', async () => {
    mockPickFile.mockResolvedValue('/tmp/take-3.mp3');
    const view = renderWithApp(
      <AudioImportSheet
        open
        busy={false}
        onClose={jest.fn()}
        onUpload={jest.fn()}
      />,
    );
    await act(async () => undefined);
    expect(mockPickFile).toHaveBeenCalledTimes(1);

    view.rerender(
      <AudioImportSheet open busy onClose={jest.fn()} onUpload={jest.fn()} />,
    );
    expect(mockPickFile).toHaveBeenCalledTimes(1);
  });
});
