module.exports = function (api) {
  /*
    NativeWind's JSX transform must run only under Metro. It routes JSX through
    `react-native-css-interop/jsx-runtime`, which breaks the plain-node
    transform vitest uses — the component tests here import no JSX, but the
    guard keeps that true by construction rather than by luck.
  */
  const isMetro = api.caller(
    caller =>
      !!caller && (caller.name === 'metro' || caller.bundler === 'metro'),
  );
  api.cache.using(() => isMetro);

  return {
    presets: [
      'module:@react-native/babel-preset',
      // Listed last so its JSX transform runs first.
      ...(isMetro ? ['nativewind/babel'] : []),
    ],
    plugins: [
      /*
        zod v4 ships `export * as x from` in its ESM build, which Metro's
        transformer refuses without this. It reaches us through
        `@sudobility/music_types`, whose schemas are zod — so this is not
        optional, and the failure appears only when bundling.
      */
      '@babel/plugin-transform-export-namespace-from',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@sudobility/music_lib': './src/app-library',
            '@sudobility/music_lib-core': './node_modules/@sudobility/music_lib/dist/index',
          },
          extensions: ['.ts', '.tsx', '.js', '.json'],
        },
      ],
      // Must be last: it rewrites worklet functions and expects to see the
      // output of every other transform.
      'react-native-worklets/plugin',
    ],
  };
};
