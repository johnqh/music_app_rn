/**
 * The macOS file panels.
 *
 * React Native macOS ships no document picker, and the community one
 * (`@react-native-documents/picker`) declares `:ios` only — it is a
 * `UIDocumentPickerViewController`, which does not exist on the Mac. So this is
 * the Mac half: `NSOpenPanel` and `NSSavePanel`, behind the same two functions
 * the iOS and Android picker is wrapped in.
 *
 * It is a local package rather than files in the Xcode project so that
 * autolinking installs it — adding a source file to `project.pbxproj` by hand
 * is the kind of edit that survives until the next `pod install` and then does
 * not.
 */
import { NativeModules } from 'react-native';

const { MoosiacFilePicker } = NativeModules;

export function isSupported() {
  return MoosiacFilePicker != null;
}

/**
 * Opens a panel and resolves the chosen file's path, or null if cancelled.
 *
 * `extensions` are bare, without dots — `['mid', 'midi']`.
 */
export function pickFile(extensions) {
  if (!MoosiacFilePicker) {
    return Promise.reject(new Error('No file picker on this platform.'));
  }
  return MoosiacFilePicker.pickFile(extensions ?? []);
}

/** Opens a save panel and resolves the chosen path, or null if cancelled. */
export function pickSaveLocation(suggestedName) {
  if (!MoosiacFilePicker) {
    return Promise.reject(new Error('No file picker on this platform.'));
  }
  return MoosiacFilePicker.pickSaveLocation(suggestedName ?? '');
}
