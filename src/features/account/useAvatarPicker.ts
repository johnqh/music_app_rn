/**
 * Choosing a profile picture, and making it small enough to send.
 *
 * **From the photo library on a phone or a tablet, from a file on a
 * desktop.** A picture on an iPhone, an iPad or an Android device is in the
 * photo library, and the file chooser does not show it: it opens on Files,
 * where most people keep nothing. `react-native-image-picker` presents the
 * system's own picker — `PHPickerViewController`, Android's Photo Picker —
 * and both run outside the app and hand back only what was chosen, so there
 * is **no photo permission to ask for** and none is declared. A Mac or a
 * Windows machine keeps its pictures as files, and keeps the file chooser.
 *
 * The module is `require`d when a picture is asked for, never imported: it
 * has no desktop implementation, and an import at the top of the file would
 * be resolved by a build that cannot hold it.
 *
 * **Resized here, before it is sent.** The server stores the picture in its
 * database and refuses anything over `AVATAR_MAX_BYTES`; a photograph off a
 * camera is twenty times that. Skia is already in the app to draw the score,
 * and decoding, cropping to a centred square and encoding a JPEG is three
 * calls to it. The picture is drawn a few dozen points wide, so `AVATAR_SIZE`
 * square is already more than is shown.
 *
 * Skia is asked for when a picture is chosen rather than at the top of the
 * file, because the Windows build has no Skia and must be able to load the
 * screen that offers this.
 */
import { useCallback } from 'react';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type { NativeUploadFile } from '@sudobility/music_client';
import { AVATAR_MAX_BYTES } from '@sudobility/music_types';
import { createFilePicker } from '@/documents/file-picker';

/** The side of the square a picture is reduced to, in pixels. */
const AVATAR_SIZE = 256;
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
/** Base64 spends four characters on three bytes. */
const bytesOf = (base64: string): number => Math.floor((base64.length * 3) / 4);

export type AvatarPicker = {
  /** False where this build cannot prepare a picture. */
  supported: boolean;
  /** The picture, ready to upload; null if the reader chose nothing. */
  pick: () => Promise<NativeUploadFile | null>;
};

/** A phone or a tablet: where pictures live in a photo library. */
export function hasPhotoLibrary(os: string = Platform.OS): boolean {
  return os === 'ios' || os === 'android';
}

/**
 * The path of the picture the reader chose, or null if they chose none.
 *
 * Cancelling is not an error — `didCancel` is how the picker says the reader
 * changed their mind — but anything else it reports is.
 */
export async function pickPicturePath(): Promise<string | null> {
  if (!hasPhotoLibrary()) return createFilePicker().pickFile(EXTENSIONS);

  /* eslint-disable @typescript-eslint/no-require-imports */
  const { launchImageLibrary } =
    require('react-native-image-picker') as typeof import('react-native-image-picker');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    // Read from its file below, as a chosen file is: a photograph as base64
    // across the bridge is tens of megabytes of string.
    includeBase64: false,
    // Far more than is kept, and small enough to decode at once. The
    // picker also turns a HEIC into a JPEG on the way, which Skia reads.
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.9,
  });
  if (result.didCancel) return null;
  if (result.errorCode) {
    throw new Error(result.errorMessage ?? result.errorCode);
  }
  return result.assets?.[0]?.uri ?? null;
}

export function useAvatarPicker(): AvatarPicker {
  const supported = Platform.OS !== 'windows';

  const pick = useCallback(async (): Promise<NativeUploadFile | null> => {
    const path = await pickPicturePath();
    if (!path) return null;

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Skia, ImageFormat } =
      require('@shopify/react-native-skia') as typeof import('@shopify/react-native-skia');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const encoded = await RNFS.readFile(
      path.replace(/^file:\/\//, ''),
      'base64',
    );
    const image = Skia.Image.MakeImageFromEncoded(
      Skia.Data.fromBase64(encoded),
    );
    if (!image) throw new Error('Not an image');

    const surface = Skia.Surface.MakeOffscreen(AVATAR_SIZE, AVATAR_SIZE);
    if (!surface) throw new Error('No drawing surface');
    const side = Math.min(image.width(), image.height());
    surface
      .getCanvas()
      .drawImageRect(
        image,
        Skia.XYWHRect(
          (image.width() - side) / 2,
          (image.height() - side) / 2,
          side,
          side,
        ),
        Skia.XYWHRect(0, 0, AVATAR_SIZE, AVATAR_SIZE),
        Skia.Paint(),
      );
    surface.flush();
    const snapshot = surface.makeImageSnapshot();

    // Stepping the quality down until it fits: at this size the first step
    // almost always does.
    for (const quality of [90, 75, 60, 45]) {
      const jpeg = snapshot.encodeToBase64(ImageFormat.JPEG, quality);
      if (bytesOf(jpeg) > AVATAR_MAX_BYTES) continue;
      const target = `${RNFS.CachesDirectoryPath}/avatar-${Date.now()}.jpg`;
      await RNFS.writeFile(target, jpeg, 'base64');
      return {
        uri: `file://${target}`,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      };
    }
    throw new Error('Too large');
  }, []);

  return { supported, pick };
}
