/**
 * The native implementations live in the app projects: CocoaPods links the
 * macOS source, while RNW links the Windows TinySoundFont/WASAPI module.
 */
module.exports = {
  dependency: {
    platforms: {
      macos: { podspecPath: __dirname + '/MoosiacSynth.podspec' },
      windows: null,
    },
  },
};
