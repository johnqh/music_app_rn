import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reversedGoogleClientId } from '@sudobility/auth_lib/oauth';

// The barrel reaches Firebase's ESM build, which jest cannot parse; nothing
// here needs it.
jest.mock('firebase/auth', () => ({}));

/*
  The URL scheme Google's iOS SDK returns on is registered in `Info.plist` at
  build time, so it is written there by hand. It has to be the reversed form
  of the iOS-type client — the `REVERSED_CLIENT_ID` of the same
  `GoogleService-Info.plist` that `babel.config.js` configures Firebase from —
  or sign-in opens Google and never comes back, and nothing else would notice
  the two drifting apart.
*/
const ROOT = join(__dirname, '..', '..');
const IOS = join(ROOT, 'ios', 'MoosiacRN');

function plistString(file: string, key: string): string {
  const m = readFileSync(file, 'utf8').match(
    new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`),
  );
  return m ? m[1] : '';
}

describe('Info.plist', () => {
  it("registers the services file's reversed client id as a URL scheme", () => {
    const services = join(IOS, 'GoogleService-Info.plist');
    const clientId = plistString(services, 'CLIENT_ID');
    const reversed = plistString(services, 'REVERSED_CLIENT_ID');
    expect(reversedGoogleClientId(clientId)).toBe(reversed);
    expect(readFileSync(join(IOS, 'Info.plist'), 'utf8')).toContain(
      `<string>${reversed}</string>`,
    );
  });
});
