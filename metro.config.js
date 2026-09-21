const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const root = __dirname;
const rnwPath = path.dirname(require.resolve('react-native-windows/package.json'));

/** Native and generated build output must not be watched by Metro. */
const blockList = new RegExp(
  [
    /\/windows\/build\/.*/,
    /\/windows\/MoosiacRN\/Bundle\/.*/,
    /\/macos\/build\/.*/,
    /\/macos\/Pods\/.*/,
    /\/ios\/build\/.*/,
    /\/ios\/Pods\/.*/,
    /\/android\/build\/.*/,
    /\/android\/app\/build\/.*/,
    /\/android\/\.gradle\/.*/,
    /\/\.git\/.*/,
    new RegExp(`${rnwPath}/(?:build|target)/.*`),
    /.*\.ProjectImports\.zip/,
  ]
    .map(pattern => pattern.source)
    .join('|'),
);

/**
 * Keep the shared package-export conditions and NativeWind configuration used
 * by iOS, Android and macOS while also supporting the Windows resolver.
 */
const config = mergeConfig(getDefaultConfig(root), {
  resolver: {
    unstable_enablePackageExports: true,
    blockList,
  },
  watchFolders: [root],
});

module.exports = withNativeWind(config, { input: './global.css' });
