/**
 * Build-time configuration.
 *
 * Read from `process.env` through Babel's inline-environment-variables
 * transform where one is configured, and otherwise from these defaults — so a
 * developer checkout runs against a local API with no setup, and a shipped
 * build is told where to point.
 *
 * An absent Firebase key is not an error: it means this build is local-only,
 * which is a supported state. See `AuthContext`.
 */
export const CONSTANTS = {
  API_URL: process.env.MUSIC_API_URL ?? 'http://localhost:8032',
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? '',
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? '',
} as const;
