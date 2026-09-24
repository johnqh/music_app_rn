/**
 * Opens the OS picker itself, the moment it is asked to — no "Choose a
 * recording" tap standing between selecting Audio and the file dialog.
 */
import { jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
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

  it('shows the chosen file and transcribes it on confirm', async () => {
    mockPickFile.mockResolvedValue('/tmp/take-3.mp3');
    const onUpload = jest.fn();
    const view = renderWithApp(
      <AudioImportSheet open onClose={jest.fn()} onUpload={onUpload} />,
    );
    await act(async () => undefined);
    expect(view.getByText('take-3.mp3')).toBeTruthy();

    fireEvent.press(view.getByText('Transcribe'));
    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'take-3.mp3' }),
    );
  });

  it('shows the unavailable message immediately, without touching the picker', async () => {
    const view = renderWithApp(
      <AudioImportSheet
        open
        available={false}
        onClose={jest.fn()}
        onUpload={jest.fn()}
      />,
    );
    await act(async () => undefined);
    expect(mockPickFile).not.toHaveBeenCalled();
    expect(
      view.getByText('Audio transcription is not available on this server.'),
    ).toBeTruthy();
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
