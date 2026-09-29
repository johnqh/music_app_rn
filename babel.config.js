/*
  `.env` is read here, and its values are written into the bundle.

  React Native's `process.env` is an empty object at run time: there is no
  process, and nothing reads a file. So `process.env.FIREBASE_API_KEY` in
  `src/config/constants.ts` was always undefined, however carefully `.env`
  had been filled in — the app ran as a build with no Firebase configured,
  where signing in reports itself unavailable and everything behind an
  account is quietly absent. Nothing failed, because an unconfigured build is
  a supported state.

  A variable already in the real environment wins over the file, which is
  what lets CI and a release build say where to point without editing it.
*/
require('dotenv').config({
  path: require('node:path').join(__dirname, '.env'),
  quiet: true,
});

/**
 * Every name `src/config/constants.ts` reads. Listed, not everything in the
 * environment: whatever is inlined ships inside the app, and a shell's
 * environment holds things that must not.
 */
const INLINED_ENV = [
  'MUSIC_API_URL',
  'MUSIC_WEB_URL',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PROXY',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_REVERSED_CLIENT_ID',
  'VITE_APP_NAME',
  'VITE_APP_DOMAIN',
  'VITE_COMPANY_NAME',
  'VITE_SUPPORT_EMAIL',
];

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
  /*
    The values are part of the cache key. Keyed on the caller alone, a changed
    `.env` went on producing the bundle the old one made until somebody
    thought to clear the cache by hand.
  */
  api.cache.using(
    () =>
      `${isMetro}:${INLINED_ENV.map(name => process.env[name] ?? '').join(
        '|',
      )}`,
  );

  return {
    presets: [
      'module:@react-native/babel-preset',
      // Listed last so its JSX transform runs first.
      ...(isMetro ? ['nativewind/babel'] : []),
    ],
    plugins: [
      // Only under Metro: the tests read `CONSTANTS`' defaults, and must not
      // change with whatever this machine's `.env` happens to say.
      ...(isMetro
        ? [['transform-inline-environment-variables', { include: INLINED_ENV }]]
        : []),
      /*
        zod v4 ships `export * as x from` in its ESM build, which Metro's
        transformer refuses without this. It reaches us through
        `@sudobility/music_types`, whose schemas are zod — so this is not
        optional, and the failure appears only when bundling.
      */
      '@babel/plugin-transform-export-namespace-from',
      /*
        `three` (reached through `@sudobility/music_spatial_core`, the Spatial
        view's projection) uses static class blocks, which the React Native
        preset does not transform — Metro stops the bundle with "Static class
        blocks are not enabled". Same category as the zod plugin above: only
        seen when bundling.
      */
      '@babel/plugin-transform-class-static-block',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@sudobility/music_lib': './src/app-library',
            '@sudobility/music_lib-core':
              './node_modules/@sudobility/music_lib/dist/index',
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
