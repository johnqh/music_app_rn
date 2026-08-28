/**
 * Which native dependency belongs to which platform.
 *
 * Two of them are platform-specific for the same underlying reason — a file
 * picker is a different control on every OS, and neither package pretends
 * otherwise:
 *
 * - `@react-native-documents/picker` wraps `UIDocumentPickerViewController` and
 *   Android's Storage Access Framework. Its podspec declares `:ios` only, so
 *   listing it for macOS would ask CocoaPods to install something that does not
 *   build there.
 * - `@moosiac/file-picker` is the Mac half — `NSOpenPanel` and `NSSavePanel`.
 *   It needs no entry here: it declares `macos` and nothing else in its own
 *   `react-native.config.js`, which is how a package says which platforms it
 *   has native code for. Repeating that here would *replace* its platform map
 *   rather than adding to it, and the entry would vanish from autolinking
 *   entirely — which is exactly what happened.
 *
 * `react-native-screens` needs no entry: it publishes no macOS implementation,
 * so autolinking already leaves it out of the macOS Pods. What that *does* mean
 * is that the navigator has to be JS-backed on the Mac — see `Navigation.tsx`.
 */
module.exports = {
  dependencies: {
    '@react-native-documents/picker': {
      platforms: { macos: null },
    },
  },
  project: {
    macos: { sourceDir: 'macos' },
    ios: { sourceDir: 'ios' },
  },
};
