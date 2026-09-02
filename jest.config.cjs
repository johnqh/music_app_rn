/**
 * Component tests, beside the vitest suite rather than replacing it.
 *
 * Two runners because they answer different questions and neither does both
 * well. Vitest runs the plain-TypeScript half — the document model, the store
 * wiring, the platform adapters — under `node`, fast, with no React Native at
 * all. Jest with the React Native preset is what can actually *render* a
 * component: it has the babel transform for React Native's Flow-typed source,
 * which vitest's esbuild pipeline does not.
 *
 * The split is by extension, so there is nothing to remember: `*.test.ts` is
 * vitest's, `*.test.tsx` is jest's.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.mocks.cjs'],
  setupFilesAfterEnv: ['./jest.setup.cjs'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    // Bun stores deps in node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>/,
    // so the usual pattern misses every one of them.
    'node_modules/(?!(\\.bun/[^/]+/node_modules/)?(react-native|react-native-macos|@react-native|@react-native-community|@react-native-segmented-control|@react-navigation|nativewind|react-native-css-interop|react-native-reanimated|react-native-svg|react-native-heroicons|react-native-gesture-handler|react-native-safe-area-context|clsx|class-variance-authority|tailwind-merge|@testing-library|@sudobility|immer|zustand|nanoid|uuid|i18next|react-i18next)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Skia draws through a native canvas that does not exist under jest; the
    // score view is checked by the app, not here.
    '^@shopify/react-native-skia$': '<rootDir>/jest.skia.cjs',
  },
};
