/**
 * Declares this package as a native dependency to autolink.
 *
 * Apple platforms use this package's native sources. Windows is implemented
 * in the app's RNW project because the bridge needs the app's WebView2 and
 * package identity; the JS package remains shared across platforms.
 *
 * Without this file the CLI treats a package with a podspec as a plain JS
 * dependency — it looks here to learn there is anything native to link at all.
 * Do NOT repeat these platforms in the app's own `react-native.config.js`: a
 * project-level `platforms` entry *replaces* this map rather than merging with
 * it, and the package then vanishes from autolinking with no error anywhere.
 */
module.exports = {
  dependency: {
    platforms: {
      /*
        No `podspecPath` here: this CLI's `dependency.platforms.ios` schema
        allows only `scriptPhases` and `configurations`, and rejects the whole
        config when it sees anything else — which made `run-ios` fail at
        "Installing CocoaPods" with no useful message. The podspec sits at the
        package root, where the CLI finds it on its own. `macos` below is not
        validated as strictly, so it keeps its explicit path.
      */
      ios: {},
      macos: { podspecPath: __dirname + '/MoosiacPrint.podspec' },
      // Relative to the package root, unlike `podspecPath`: the Android
      // resolver joins it onto the root itself, so an absolute path here
      // resolves to nothing and the module is silently not linked.
      android: { sourceDir: 'android' },
      windows: null,
    },
  },
};
