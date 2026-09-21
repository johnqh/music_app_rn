/**
 * Windows file picking is not wired yet.
 *
 * Keep the platform boundary explicit instead of importing the iOS/Android
 * document picker, whose native module is not available on Windows. The
 * document storage itself remains usable for files created inside the app.
 */
import type { FilePicker } from './file-picker';

export function createFilePicker(): FilePicker {
  return {
    isSupported: () => false,
    pickFile: async () => null,
    pickSaveLocation: async () => null,
  };
}
