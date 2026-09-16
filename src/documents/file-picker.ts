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
import {
  errorCodes,
  isErrorWithCode,
  isKnownType,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';

/**
 * What to hand the picker, given the extensions a caller asked for.
 *
 * **A bare extension is not a filter on either platform**, and passing one
 * fails silently in both directions. iOS builds its allowed list with
 * `UTType(identifier)` and `compactMap`s the nils away, so `'.moo'` — not a
 * declared identifier — simply vanishes and the picker is left filtering on
 * whatever survived. Android normalises each entry into `EXTRA_MIME_TYPES` and
 * matches it against each document's real MIME type, where the literal string
 * `'.moo'` matches nothing at all. Either way the file the reader tapped
 * Import for is the one greyed out, with nothing on screen saying why.
 *
 * So each extension is resolved through the picker's own `isKnownType`, which
 * asks the *device* — `UTType(filenameExtension:)` on iOS, Android's
 * `MimeTypeMap` — and answers with the identifier that platform filters on.
 *
 * **`UTType` first, and the order is load-bearing.** iOS answers with *both*
 * fields (`utType.identifier` and `utType.preferredMIMEType`) while Android
 * fills in `mimeType` alone; reading the MIME type first therefore hands iOS
 * `'audio/midi'`, which `UTType(identifier)` cannot resolve, and it is dropped
 * exactly as the bare extension was. The failure is identical and just as
 * quiet, which is why a test pins both platforms' answer shapes.
 *
 * **One unresolved extension widens the whole filter to every file**, rather
 * than dropping that one from the list. `.moo` has no registered UTI and no
 * MIME type anywhere — it is this app's own document — so there is nothing to
 * name it by, and a filter listing only its siblings would grey out the exact
 * file this exists to open. Showing everything is the honest answer: the
 * decoders identify what they are given (a tracker module is already chosen by
 * magic bytes rather than extension), and a wrong pick is reported.
 */
function pickerTypes(extensions: readonly string[]): string[] {
  const resolved = extensions.map(extension => {
    const known = isKnownType({ kind: 'extension', value: extension });
    // iOS filters on a UTType identifier and fills in both fields; Android
    // filters on MIME and leaves `UTType` null. So this order — never the
    // other one — is "whichever my platform filters on".
    return known.UTType ?? known.mimeType ?? null;
  });
  return resolved.every((type): type is string => type !== null)
    ? resolved
    : [types.allFiles];
}

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
      let picked;
      try {
        picked = await pick({
          allowMultiSelection: false,
          // See `pickerTypes`: a bare `.mid` is not a filter on either
          // platform, and the failure is a greyed-out file, not an error.
          type: pickerTypes(extensions),
        });
      } catch (error) {
        /*
          **Cancelling is a rejection, not an empty result.** This contract
          says a change of mind resolves `null`, and the module does not: it
          throws `OPERATION_CANCELED`, which travelled all the way up to the
          import hook's `catch` and put the picker's own English in a dialog
          titled "Could not import" — measured on an Android tablet, backing
          out of Import → project file reported *"user canceled the document
          picker"* as a failure. Every importer and the macOS File menu share
          this, so it was every import.

          Only cancellation is swallowed. A real failure — a file type the
          provider cannot open, a picker already up — still throws, because
          that is something the reader has to be told about.
        */
        if (
          isErrorWithCode(error) &&
          error.code === errorCodes.OPERATION_CANCELED
        ) {
          return null;
        }
        throw error;
      }
      const [file] = picked;
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
