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
  /**
   * Where the web app is served — what a shared link to a published score
   * opens. Separate from the API because they are different hosts; the web
   * dev server's port by default.
   */
  WEB_URL: process.env.MUSIC_WEB_URL ?? 'http://localhost:5039',
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? '',
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? '',
  /**
   * Branding. Named `VITE_*`, same as music_app's and svgr_app_rn's — a
   * bundler prefix that means nothing to Metro, kept anyway so one `.env`
   * value name works across the whole family regardless of which app reads
   * it. Never hardcode the product name / company / domain in a component;
   * read it from here.
   */
  APP_NAME: process.env.VITE_APP_NAME ?? 'Moosiac',
  APP_DOMAIN: process.env.VITE_APP_DOMAIN ?? 'moosiac.com',
  COMPANY_NAME: process.env.VITE_COMPANY_NAME ?? 'Sudobility',
  SUPPORT_EMAIL: process.env.VITE_SUPPORT_EMAIL ?? 'support@sudobility.com',
} as const;
