/**
 * Reading instrument packs out of the app bundle.
 *
 * `.test.tsx` because it imports `react-native` and `react-native-fs`, which
 * `node` cannot parse — the runner split here is by environment.
 *
 * What is worth pinning is that **nothing here can fall back to the network**.
 * The bug this replaces was exactly that: with no `packBase` configured the
 * engine quietly fetched ~2.6MB per instrument from a third party on the first
 * note, so playback needed a network, waited, and stopped working when someone
 * else's host did. A regression would be silent in the same way — it plays fine
 * on a desk with wifi.
 *
 * The Android/iOS split is real and not cosmetic: Android keeps bundled assets
 * inside the APK, reachable only through `readFileAssets` with a path relative
 * to `assets/`, while iOS and macOS copy theirs into the bundle directory where
 * an ordinary read works. Using either call on the other platform fails at
 * runtime only.
 */
import { jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockReadFile = jest.fn(async () => 'MIDI.Soundfont.violin = {}');
const mockReadFileAssets = jest.fn(async () => 'MIDI.Soundfont.violin = {}');

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    MainBundlePath: '/Bundle.app',
    readFile: (...args: unknown[]) => mockReadFile(...(args as [])),
    readFileAssets: (...args: unknown[]) => mockReadFileAssets(...(args as [])),
  },
}));

const { BUNDLED_SOUNDFONT, bundledPackFile, readBundledPack } =
  require('./soundfont-packs') as typeof import('./soundfont-packs');

beforeEach(() => {
  mockReadFile.mockClear();
  mockReadFileAssets.mockClear();
});

describe('BUNDLED_SOUNDFONT', () => {
  it('points melodic and percussion at the same bundled directory', () => {
    expect(BUNDLED_SOUNDFONT.packBase).toBe(BUNDLED_SOUNDFONT.percussionBase);
  });

  it('is not an http base — nothing is ever fetched', () => {
    // The whole point: a http(s) base here means the app went back to
    // downloading instruments at play time.
    expect(BUNDLED_SOUNDFONT.packBase).not.toMatch(/^https?:/);
  });

  it('supplies a percussion base at all, so drum kits can resolve', () => {
    // The engine throws by design when percussion has no base; before this the
    // app passed none, so every drum track was an error rather than a sound.
    expect(BUNDLED_SOUNDFONT.percussionBase).toBeTruthy();
  });
});

describe('bundledPackFile', () => {
  it('takes the file name out of whatever URL the engine built', () => {
    expect(bundledPackFile('bundle://soundfont/violin-mp3.js')).toBe(
      'violin-mp3.js',
    );
  });

  it('handles a percussion pack the same way', () => {
    expect(bundledPackFile('bundle://soundfont/percussion_25-mp3.js')).toBe(
      'percussion_25-mp3.js',
    );
  });

  it('copes with a bare name', () => {
    expect(bundledPackFile('violin-mp3.js')).toBe('violin-mp3.js');
  });
});

describe('readBundledPack', () => {
  const setPlatform = (os: string) => {
    (Platform as { OS: string }).OS = os;
  };
  const original = Platform.OS;
  afterEach(() => setPlatform(original));

  it('reads from the APK assets on Android', async () => {
    setPlatform('android');
    await readBundledPack('bundle://soundfont/violin-mp3.js');
    expect(mockReadFileAssets).toHaveBeenCalledWith(
      'soundfont/violin-mp3.js',
      'utf8',
    );
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('reads from the app bundle on iOS', async () => {
    setPlatform('ios');
    await readBundledPack('bundle://soundfont/violin-mp3.js');
    expect(mockReadFile).toHaveBeenCalledWith(
      '/Bundle.app/soundfont/violin-mp3.js',
      'utf8',
    );
    expect(mockReadFileAssets).not.toHaveBeenCalled();
  });

  it('reads from Contents/Resources on macOS', async () => {
    // The platform difference that is invisible until a note is played:
    // `MainBundlePath` is the `.app` on both Apple platforms, but macOS keeps
    // its resources under Contents/Resources while iOS puts them at the root.
    // Using the iOS path here finds no instruments at all — on macOS only.
    setPlatform('macos');
    await readBundledPack('bundle://soundfont/violin-mp3.js');
    expect(mockReadFile).toHaveBeenCalledWith(
      '/Bundle.app/Contents/Resources/soundfont/violin-mp3.js',
      'utf8',
    );
  });

  it('does not use the macOS path on iOS', async () => {
    setPlatform('ios');
    await readBundledPack('bundle://soundfont/violin-mp3.js');
    expect(mockReadFile).not.toHaveBeenCalledWith(
      expect.stringContaining('Contents/Resources'),
      'utf8',
    );
  });

  it('returns the pack body it read', async () => {
    setPlatform('ios');
    await expect(
      readBundledPack('bundle://soundfont/violin-mp3.js'),
    ).resolves.toContain('MIDI.Soundfont.');
  });
});
