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
   * The Google OAuth client the desktop sign-in goes through, and its
   * reversed form, which is the URL scheme Google redirects back to.
   *
   * Both from the Firebase project's iOS-type client in Google Cloud Console
   * (`CLIENT_ID` and `REVERSED_CLIENT_ID` in `GoogleService-Info.plist`). A
   * public client: the flow is authorization-code with PKCE, so there is no
   * secret to hold. Absent, Google sign-in is simply not offered — the same
   * rule the Firebase key itself follows.
   */
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
  GOOGLE_OAUTH_REVERSED_CLIENT_ID:
    process.env.GOOGLE_OAUTH_REVERSED_CLIENT_ID ?? '',
  // Android's Google sign-in: the Firebase project's *web* client, which is
  // what makes Google return an ID token there.
  GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
  // Android's Sign in with Apple, which is Apple's web flow: the Services ID
  // and the redirect registered for it. iOS needs neither.
  APPLE_SERVICE_ID: process.env.APPLE_SERVICE_ID ?? '',
  APPLE_REDIRECT_URI: process.env.APPLE_REDIRECT_URI ?? '',
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
