/**
 * Reading the instrument packs out of the app bundle instead of off the network.
 *
 * The RN engine defaults to fetching each pack from Benjamin Gleitzman's GitHub
 * Pages — roughly 2.6MB per instrument, on the first note that needs it. For a
 * shipped app that is the wrong trade in four separate ways: no sound offline,
 * no sound when someone else's host is down, a visible wait before an
 * unfamiliar instrument, and that host learning who plays what. The packs are
 * CC-BY 3.0, so the app carries its own copy.
 *
 * `scripts/fetch-soundfont-packs.mjs` vendors them into `assets/soundfont/`,
 * and each platform's build copies that directory into the app:
 * Android through `sourceSets` (so the APK's `assets/soundfont/` is the same
 * directory, not a duplicate of it), iOS and macOS through a copy phase into
 * the bundle's `Resources/soundfont/`.
 *
 * The engine still builds a *URL* from `packBase`, because that is the seam it
 * has and a URL is a fine name for a file. Only the last path segment matters
 * here; the scheme exists to make it obvious in a stack trace that nothing was
 * ever going to be fetched.
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

/** Where the packs sit inside the bundle, on every platform. */
const DIR = 'soundfont';

/**
 * Not `file://`: React Native's `fetch` does not read that scheme on either
 * platform, so a real file URL here would look like it should work and would
 * not. This one cannot be mistaken for something fetchable.
 */
const BUNDLE_BASE = `bundle://${DIR}/`;

/**
 * Both bases point at the same directory.
 *
 * Melodic and percussion packs are separate options because they come from
 * different places *upstream* — one is a CDN's, the other is rendered by
 * `music_io/scripts/build-percussion-packs.mjs`. Once vendored they are simply
 * files side by side, and `percussion_*` names keep them apart.
 */
export const BUNDLED_SOUNDFONT = {
  packBase: BUNDLE_BASE,
  percussionBase: BUNDLE_BASE,
} as const;

/** The file name out of whatever URL the engine built. */
export function bundledPackFile(url: string): string {
  const slash = url.lastIndexOf('/');
  return slash < 0 ? url : url.slice(slash + 1);
}

/**
 * Where the packs sit inside an Apple bundle.
 *
 * `RNFS.MainBundlePath` is `[[NSBundle mainBundle] bundlePath]` — the `.app`
 * itself — on **both** Apple platforms, but the two lay resources out
 * differently: an iOS app puts them at the bundle root, while a macOS app puts
 * them under `Contents/Resources`. The build phase copies to
 * `$UNLOCALIZED_RESOURCES_FOLDER_PATH`, which resolves correctly for each, so
 * it is only the *read* side that has to know the difference. Getting this
 * wrong is invisible until a note is played, and then every instrument is
 * missing on one platform only.
 */
function appleBundleDir(): string {
  return Platform.OS === 'macos'
    ? `${RNFS.MainBundlePath}/Contents/Resources`
    : RNFS.MainBundlePath;
}

/**
 * Reads one pack from the bundle.
 *
 * Android keeps bundled assets inside the APK rather than on the filesystem, so
 * they are read through `readFileAssets` with a path relative to `assets/`;
 * iOS and macOS copy theirs into the bundle, where an ordinary read works.
 * There is no network path here at all — a missing file is a bug in the build,
 * and throwing says so rather than silently falling back to a download.
 */
export async function readBundledPack(url: string): Promise<string> {
  const file = bundledPackFile(url);
  if (Platform.OS === 'android') {
    return RNFS.readFileAssets(`${DIR}/${file}`, 'utf8');
  }
  return RNFS.readFile(`${appleBundleDir()}/${DIR}/${file}`, 'utf8');
}
