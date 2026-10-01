/**
 * Build-time configuration.
 *
 * Read from `.env` by `babel.config.js`, which writes each value into the
 * bundle in place of its `process.env` reference — React Native has no
 * process to read one from at run time. A name added here must be added to
 * `INLINED_ENV` there, or it is always its default. With no `.env` these
 * defaults stand, so a developer checkout runs against a local API with no
 * setup, and a shipped build is told where to point.
 *
 * Firebase and sign-in configuration is `env.ts`, in the shape every app in
 * the family has it.
 */
export const CONSTANTS = {
  API_URL: process.env.MUSIC_API_URL ?? 'http://localhost:8032',
  /**
   * Where the web app is served — what a shared link to a published score
   * opens. Separate from the API because they are different hosts; the web
   * dev server's port by default.
   */
  WEB_URL: process.env.MUSIC_WEB_URL ?? 'http://localhost:5039',
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
