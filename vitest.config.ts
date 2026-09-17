import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Vitest, not Jest, and deliberately: every other repo in this family tests
 * with vitest, and the logic worth testing here — the store wiring, the
 * document model, the platform adapters — is plain TypeScript. React Native
 * components stay thin enough to be checked by types and by the app itself.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@sudobility/music_lib': resolve(__dirname, 'src/app-library.ts'),
      '@sudobility/music_lib-core': resolve(
        __dirname,
        'node_modules/@sudobility/music_lib/dist/index.js',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: [/@sudobility\/(music_editing|music_player)/],
        external: ['@sudobility/music_types', 'zod'],
      },
    },
  },
});
