/**
 * Declares this package as a native dependency to autolink.
 *
 * All three platforms, unlike `@moosiac/file-picker`: every one of them has a
 * print service, they just want to be handed the pages differently.
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
      ios: { podspecPath: __dirname + '/MoosiacPrint.podspec' },
      macos: { podspecPath: __dirname + '/MoosiacPrint.podspec' },
      // Relative to the package root, unlike `podspecPath`: the Android
      // resolver joins it onto the root itself, so an absolute path here
      // resolves to nothing and the module is silently not linked.
      android: { sourceDir: 'android' },
    },
  },
};
