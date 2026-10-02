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
  // Firebase for the desktops' web apps (iOS and Android read their Google
  // services files instead): shared, then each desktop's own.
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID_MACOS',
  'FIREBASE_MEASUREMENT_ID_MACOS',
  'FIREBASE_APP_ID_WINDOWS',
  'FIREBASE_MEASUREMENT_ID_WINDOWS',
  'GA4_API_SECRET_MACOS',
  'GA4_API_SECRET_WINDOWS',
  'GOOGLE_OAUTH_CLIENT_ID_MACOS',
  'GOOGLE_OAUTH_CLIENT_ID_WINDOWS',
  'GOOGLE_OAUTH_CLIENT_SECRET_WINDOWS',
  'FIREBASE_PROXY',
  'APPLE_SERVICE_ID',
  'APPLE_REDIRECT_URI',
  'VITE_APP_NAME',
  'VITE_APP_DOMAIN',
  'VITE_COMPANY_NAME',
  'VITE_SUPPORT_EMAIL',
];

/**
 * A test account the debug build signs in with by itself (`DevAutoSignIn`),
 * so the screenshot devices and a fresh simulator are signed in without
 * anybody typing a password into them.
 *
 * Inlined into **development bundles only**: Metro sets `BABEL_ENV` to
 * `development` for a dev bundle and `production` otherwise, so a release
 * bundle never contains the password, whatever `.env` says. The code that
 * reads them is under `__DEV__` as well, but that alone would leave the
 * strings in the bundle.
 */
const DEV_ONLY_ENV = ['DEV_SIGNIN_EMAIL', 'DEV_SIGNIN_PASSWORD'];

/*
  A blank value is no value. `.env.example` lists every name with an empty
  right-hand side and promises "a value left blank means not configured" —
  but inlined as written, `NAME=` becomes `""`, which defeats every
  `?? default` in the code that reads it. Unset, it inlines as `undefined`
  and the default applies.
*/
for (const name of [...INLINED_ENV, ...DEV_ONLY_ENV]) {
  if (process.env[name] === '') delete process.env[name];
}

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
  // A cache key of its own: a value read outside `using` would be the one
  // from whichever bundle configured babel first, dev or release.
  const devBundle = api.cache.using(
    () => process.env.BABEL_ENV === 'development',
  );
  const inlined = devBundle ? [...INLINED_ENV, ...DEV_ONLY_ENV] : INLINED_ENV;
  api.cache.using(
    () =>
      `${isMetro}:${inlined.map(name => process.env[name] ?? '').join('|')}`,
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
        ? [['transform-inline-environment-variables', { include: inlined }]]
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
