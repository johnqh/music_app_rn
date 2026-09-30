/**
 * Where a picture is chosen from depends on where pictures are kept.
 */
import { jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockLaunch = jest.fn<(options: unknown) => Promise<unknown>>();
const mockPickFile = jest.fn<() => Promise<string | null>>();
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: (options: unknown) => mockLaunch(options),
}));
jest.mock('@/documents/file-picker', () => ({
  createFilePicker: () => ({ pickFile: mockPickFile }),
}));
jest.mock('react-native-fs', () => ({}));

import { hasPhotoLibrary, pickPicturePath } from './useAvatarPicker';

function on(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}

describe('choosing a profile picture', () => {
  beforeEach(() => {
    mockLaunch.mockReset();
    mockPickFile.mockReset();
  });

  it.each(['ios', 'android'])('opens the photo library on %s', async os => {
    on(os);
    mockLaunch.mockResolvedValue({ assets: [{ uri: 'file:///tmp/a.jpg' }] });
    await expect(pickPicturePath()).resolves.toBe('file:///tmp/a.jpg');
    expect(mockPickFile).not.toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'photo', selectionLimit: 1 }),
    );
  });

  it.each(['macos', 'windows'])('opens the file chooser on %s', async os => {
    on(os);
    mockPickFile.mockResolvedValue('/Users/a/picture.png');
    await expect(pickPicturePath()).resolves.toBe('/Users/a/picture.png');
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('treats closing the picker as choosing nothing', async () => {
    on('ios');
    mockLaunch.mockResolvedValue({ didCancel: true });
    await expect(pickPicturePath()).resolves.toBeNull();
  });

  it('reports what the picker could not do', async () => {
    on('android');
    mockLaunch.mockResolvedValue({
      errorCode: 'others',
      errorMessage: 'No activity',
    });
    await expect(pickPicturePath()).rejects.toThrow('No activity');
  });

  it('says a phone or tablet has a photo library, and a desktop does not', () => {
    expect(hasPhotoLibrary('ios')).toBe(true);
    expect(hasPhotoLibrary('android')).toBe(true);
    expect(hasPhotoLibrary('macos')).toBe(false);
    expect(hasPhotoLibrary('windows')).toBe(false);
  });
});
