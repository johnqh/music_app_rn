/**
 * Which ways of signing in are offered, per platform.
 *
 * A button for a way that cannot work is worse than no button: it is offered,
 * pressed, and fails. So each is offered only where the platform can do it
 * *and* this build was given what it needs to do it with.
 */
import { jest } from '@jest/globals';
import { Platform } from 'react-native';

jest.mock('@/config/server', () => ({
  getMusicClient: () => null,
  getNetworkClient: () => ({}),
}));
jest.mock('@sudobility/music_client', () => ({ useSiteAdmin: () => false }));
jest.mock('@sudobility/building_blocks_rn', () => ({ WebAuth: {} }), {
  virtual: true,
});
jest.mock(
  '@sudobility/auth_lib/oauth',
  () => ({
    buildAppleCredential: jest.fn(),
    buildGoogleCredential: jest.fn(),
    signInWithGoogleOAuthDesktop: jest.fn(),
  }),
  // The package's `exports` map is ESM-only, which jest's resolver cannot
  // follow; nothing under test here reaches it.
  { virtual: true },
);
jest.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: jest.fn(),
}));
jest.mock('firebase/auth', () => ({}));

const mockConstants = {
  FIREBASE_API_KEY: 'key',
  GOOGLE_OAUTH_CLIENT_ID: 'ios-client',
  GOOGLE_OAUTH_REVERSED_CLIENT_ID: 'reversed',
  GOOGLE_WEB_CLIENT_ID: 'web-client',
  APPLE_SERVICE_ID: 'service',
  APPLE_REDIRECT_URI: 'https://example.com/apple',
};
jest.mock('@/config/constants', () => ({
  get CONSTANTS() {
    return mockConstants;
  },
}));

const configured = { ...mockConstants };
const os = Platform.OS;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const auth = require('./AuthContext') as typeof import('./AuthContext');

function on(platform: typeof Platform.OS) {
  Platform.OS = platform;
  return auth;
}

afterEach(() => {
  Platform.OS = os;
  Object.assign(mockConstants, configured);
});

describe('googleSignInAvailable', () => {
  it('is offered on every platform that is configured for it', () => {
    for (const platform of ['ios', 'android', 'macos', 'windows'] as const) {
      expect([platform, on(platform).googleSignInAvailable()]).toEqual([
        platform,
        true,
      ]);
    }
  });

  it('needs the iOS client on iOS, and nothing of the web client', () => {
    mockConstants.GOOGLE_WEB_CLIENT_ID = '';
    expect(on('ios').googleSignInAvailable()).toBe(true);
    mockConstants.GOOGLE_OAUTH_CLIENT_ID = '';
    expect(on('ios').googleSignInAvailable()).toBe(false);
  });

  it('needs the web client on Android, which is what returns an ID token', () => {
    mockConstants.GOOGLE_WEB_CLIENT_ID = '';
    expect(on('android').googleSignInAvailable()).toBe(false);
  });

  it('needs both halves of the client on a desktop', () => {
    mockConstants.GOOGLE_OAUTH_REVERSED_CLIENT_ID = '';
    expect(on('macos').googleSignInAvailable()).toBe(false);
  });

  it('is never offered with no Firebase to sign in to', () => {
    mockConstants.FIREBASE_API_KEY = '';
    expect(on('ios').googleSignInAvailable()).toBe(false);
  });
});

describe('appleSignInAvailable', () => {
  it('is iOS, and Android where the web flow is configured', () => {
    const answers = (['ios', 'android', 'macos', 'windows'] as const).map(
      platform => on(platform).appleSignInAvailable(),
    );
    expect(answers).toEqual([true, true, false, false]);
  });

  it('is not offered on Android without a Services ID and a redirect', () => {
    mockConstants.APPLE_SERVICE_ID = '';
    expect(on('android').appleSignInAvailable()).toBe(false);
    mockConstants.APPLE_SERVICE_ID = 'service';
    mockConstants.APPLE_REDIRECT_URI = '';
    expect(on('android').appleSignInAvailable()).toBe(false);
  });

  it('is never offered with no Firebase to sign in to', () => {
    mockConstants.FIREBASE_API_KEY = '';
    expect(on('ios').appleSignInAvailable()).toBe(false);
  });
});
