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
 * `@react-native-community/slider` and
 * `@react-native-segmented-control/segmented-control` need **no entry**, and
 * that is worth stating because adding one looks obviously right and is not.
 * Neither has a macOS implementation — both podspecs are `:ios, :visionos` —
 * so autolinking already leaves them out of the macOS Pods, exactly as it does
 * `react-native-screens`; each has a `.macos` variant in `src/` that a Mac
 * build resolves instead. Excluding the slider *here* actively broke Android:
 * this map **replaces** a package's own rather than merging into it, so the
 * entry took `sourceDir` with it and the `cmakeListsPath` the package declares
 * arrived at CMake as a bare relative path — `add_subdirectory given source
 * "src/main/jni/" which is not an existing directory`, and then
 * `react_codegen_RNCSlider ... is not built by this project`. A package that
 * declares its own platforms is one to leave alone.
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
    /*
      `automaticPodsInstallation: false`, and it is the *declaration* of this
      key that makes it necessary.

      `ios` is auto-detected, so the sibling apps declare no `project.ios` at
      all — and because the CLI's schema only applies defaults inside a
      declared object, their `automaticPodsInstallation` stays undefined and
      the pods step never runs. Declaring `ios` here opts this app in, since
      the schema default is `true`, and `run-ios` then tries `bundle exec pod
      install` for every launch. That needs Ruby >= 3.0 for its `ffi`, which
      is not what is on this machine, so every simulator run died at
      "Installing CocoaPods" with the real reason swallowed.

      Pods are installed explicitly with `pod install` when the native deps
      change, not on every run, which is what the other apps do implicitly.
    */
    ios: { sourceDir: 'ios', automaticPodsInstallation: false },
  },
};
