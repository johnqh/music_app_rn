/**
 * What this app adds beside the family's shared auth context: whether to
 * offer each way of signing in, and the token reader for code outside React.
 *
 * A button for a way that cannot work is worse than no button: it is offered,
 * pressed, and fails. So each is offered only where the platform can do it
 * *and* this build was given what it needs — and nothing at all in a build
 * with no Firebase. The per-platform rules themselves are auth_lib's and are
 * tested there; this checks the app applies them, platform by platform.
 */
import { jest } from '@jest/globals';
import { Platform } from 'react-native';

jest.mock('@sudobility/building_blocks_rn', () => ({ WebAuth: {} }), {
  virtual: true,
});
jest.mock('@/analytics', () => ({ trackUserId: jest.fn() }));
jest.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: jest.fn(),
}));
jest.mock('firebase/auth', () => ({}));

const mockConfig = {
  FIREBASE_CONFIG: { apiKey: 'key' } as Record<string, string>,
  SIGN_IN_CONFIG: {
    googleIosClientId: 'ios-client.apps.googleusercontent.com',
    googleWindowsClientId: 'win-client.apps.googleusercontent.com',
    googleWebClientId: 'web-client',
    appleServiceId: 'service',
    appleRedirectUri: 'https://example.com/apple',
  },
};
jest.mock('@/config/env', () => mockConfig);

const os = Platform.OS;

/** The module as it is evaluated on `platform`, with `config` overrides. */
function loadOn(
  platform: typeof Platform.OS,
  config: Partial<typeof mockConfig.SIGN_IN_CONFIG> & { apiKey?: string } = {},
) {
  Platform.OS = platform;
  const { apiKey = 'key', ...signIn } = config;
  mockConfig.FIREBASE_CONFIG = { apiKey };
  mockConfig.SIGN_IN_CONFIG = {
    googleIosClientId: 'ios-client.apps.googleusercontent.com',
    googleWindowsClientId: 'win-client.apps.googleusercontent.com',
    googleWebClientId: 'web-client',
    appleServiceId: 'service',
    appleRedirectUri: 'https://example.com/apple',
    ...signIn,
  };
  let mod!: typeof import('./AuthContext');
  jest.isolateModules(() => {
    // The isolated registry has its own react-native: the platform must be
    // set on that copy, or the module under test reads the default.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('react-native') as typeof import('react-native')).Platform.OS =
      platform;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./AuthContext') as typeof import('./AuthContext');
  });
  return mod;
}

afterEach(() => {
  Platform.OS = os;
});

describe('googleAvailable', () => {
  it('is offered on every platform configured for it', () => {
    for (const platform of ['ios', 'android', 'macos', 'windows'] as const) {
      expect([platform, loadOn(platform).googleAvailable]).toEqual([
        platform,
        true,
      ]);
    }
  });

  it('needs nothing from .env on iOS and Android: their services files carry the client', () => {
    expect(
      loadOn('ios', { apiKey: '', googleIosClientId: '' }).googleAvailable,
    ).toBe(true);
    expect(
      loadOn('android', { apiKey: '', googleWebClientId: '' }).googleAvailable,
    ).toBe(true);
  });

  it('needs the iOS-type client on macOS, the Desktop-app client on Windows', () => {
    expect(loadOn('macos', { googleIosClientId: '' }).googleAvailable).toBe(
      false,
    );
    expect(
      loadOn('windows', { googleWindowsClientId: '' }).googleAvailable,
    ).toBe(false);
    expect(loadOn('windows', { googleIosClientId: '' }).googleAvailable).toBe(
      true,
    );
  });

  it('is never offered on a desktop with no Firebase web app configured', () => {
    expect(loadOn('macos', { apiKey: '' }).googleAvailable).toBe(false);
  });
});

describe('appleAvailable', () => {
  it('is iOS, and Android where the web flow is configured', () => {
    expect(loadOn('ios').appleAvailable).toBe(true);
    expect(loadOn('android').appleAvailable).toBe(true);
    expect(loadOn('android', { appleServiceId: '' }).appleAvailable).toBe(
      false,
    );
  });

  it('is not offered on the desktops', () => {
    expect(loadOn('macos').appleAvailable).toBe(false);
    expect(loadOn('windows').appleAvailable).toBe(false);
  });
});

describe('readIdToken', () => {
  it('answers null on a desktop with no Firebase web app configured', async () => {
    await expect(
      loadOn('macos', { apiKey: '' }).readIdToken(),
    ).resolves.toBeNull();
  });
});
