/**
 * Asking the user for a file, and where to put one.
 *
 * An interface rather than a call, because the control is different on every
 * platform and none of them is wrong: iOS and iPadOS raise a
 * `UIDocumentPickerViewController`, Android goes through the Storage Access
 * Framework, and macOS puts up an `NSOpenPanel`. `file-picker.macos.ts`
 * supplies the last of those; this file supplies the other two.
 *
 * On a sandboxed build the panel is not a convenience — it is where the
 * *permission* comes from. An app there may read only files the user chose, so
 * a path typed in from anywhere else is not something it can open.
 *
 * Cancelling resolves `null` rather than rejecting. Changing your mind is an
 * ordinary outcome, and making it an exception would put a `try` around every
 * call site for something that is not an error.
 */
import { pick, keepLocalCopy } from '@react-native-documents/picker';

export type FilePicker = {
  /** True when this build can ask for a file at all. */
  isSupported(): boolean;
  /**
   * Opens a picker limited to the given bare extensions (`['mid', 'midi']`).
   *
   * Resolves a local path the app can read, or null if the user cancelled.
   */
  pickFile(extensions: readonly string[]): Promise<string | null>;
  /** Opens a save panel, resolving the chosen path or null. */
  pickSaveLocation(suggestedName: string): Promise<string | null>;
};

export function createFilePicker(): FilePicker {
  return {
    isSupported: () => true,

    async pickFile(extensions) {
      const [file] = await pick({
        /*
          Extensions rather than UTIs or MIME types: `.mid` is served as at
          least three different MIME types in the wild, and a picker filtered on
          one of them greys out files the app can read perfectly well.
        */
        allowMultiSelection: false,
        type: extensions.map(e => `.${e}`),
      });
      if (!file) return null;
      /*
        A picked file's URI is a *loan* — on iOS it points inside a provider's
        sandbox and stops resolving once the picker is dismissed. Copying it
        into the app's own space first is what makes the read reliable rather
        than working on the simulator and failing on a device with iCloud
        Drive.
      */
      const [copy] = await keepLocalCopy({
        files: [{ uri: file.uri, fileName: file.name ?? 'import' }],
        destination: 'cachesDirectory',
      });
      return copy?.status === 'success' ? copy.localUri : file.uri;
    },

    async pickSaveLocation() {
      /*
        There is no save panel on iOS or Android, and there is nothing to
        emulate: both hand a finished file to a share sheet instead, which is
        what `music_io`'s `fileExporter` already does. So this answers null —
        "no location was chosen" — and the caller falls back to sharing.
      */
      return null;
    },
  };
}
