/**
 * The native implementations live in the app projects: CocoaPods links the
 * iOS and macOS source (the same `apple/` files, a vendored XCFramework on
 * iOS and Homebrew's dylib on macOS — see MoosiacSynth.podspec), while RNW
 * links the Windows TinySoundFont/WASAPI module.
 */
module.exports = {
  dependency: {
    platforms: {
      ios: { podspecPath: __dirname + '/MoosiacSynth.podspec' },
      macos: { podspecPath: __dirname + '/MoosiacSynth.podspec' },
      windows: null,
    },
  },
};
