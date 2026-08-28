/**
 * The file picker on macOS, where React Native has none.
 *
 * `@react-native-documents/picker` wraps `UIDocumentPickerViewController`, and
 * its podspec declares `:ios` only — there is no Mac equivalent of that class,
 * so the package is excluded from the macOS Pods in `react-native.config.js`.
 * The Mac's own panels are `NSOpenPanel` and `NSSavePanel`, and the local
 * `@moosiac/file-picker` module is the ten lines of AppKit that raise them.
 *
 * Unlike the mobile picker, macOS *does* have a save panel — so this is the one
 * platform where "export" can mean "choose where it goes" rather than "hand it
 * to a share sheet".
 */
import { isSupported, pickFile, pickSaveLocation } from '@moosiac/file-picker';
import type { FilePicker } from './file-picker';

export function createFilePicker(): FilePicker {
  return {
    isSupported,
    // The native side resolves null on cancel, which is the same contract.
    pickFile: extensions => pickFile([...extensions]),
    pickSaveLocation,
  };
}
