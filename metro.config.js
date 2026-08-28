const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const root = __dirname;

/**
 * Native build output must not be watched.
 *
 * Metro watches the project and re-bundles on any change. `xcodebuild` and
 * Gradle write continuously into `macos/build`, `ios/build`, `Pods` and
 * `android/build` — so building while Metro runs put the app into a reload
 * loop, re-bundling ~60 times and refreshing the screen each time. None of
 * those directories contains anything Metro should read.
 */
const blockList = exclusionList([
  /\/macos\/build\/.*/,
  /\/macos\/Pods\/.*/,
  /\/ios\/build\/.*/,
  /\/ios\/Pods\/.*/,
  /\/android\/build\/.*/,
  /\/android\/app\/build\/.*/,
  /\/android\/\.gradle\/.*/,
  /\/\.git\/.*/,
]);

function exclusionList(patterns) {
  // `metro-config`'s own helper moved between versions; this is the same
  // regexp union, written out so it does not depend on which one is installed.
  return new RegExp(`(${patterns.map(p => p.source).join('|')})$`);
}

/**
 * `unstable_enablePackageExports` is on because `@sudobility/music_io` and
 * `music_player` select their platform through a `react-native` export
 * condition rather than a `.native.js` suffix.
 */
const config = mergeConfig(getDefaultConfig(root), {
  resolver: {
    unstable_enablePackageExports: true,
    blockList,
  },
  watchFolders: [root],
});

module.exports = withNativeWind(config, { input: './global.css' });
