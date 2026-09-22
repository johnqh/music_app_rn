import { NativeModules } from 'react-native';

const { MoosiacFileSystem } = NativeModules;
const DIR = 'soundfont';
const BUNDLE_BASE = `bundle://${DIR}/`;

export const BUNDLED_SOUNDFONT = {
  packBase: BUNDLE_BASE,
  percussionBase: BUNDLE_BASE,
} as const;

export function bundledPackFile(url: string): string {
  const slash = url.lastIndexOf('/');
  return slash < 0 ? url : url.slice(slash + 1);
}

export async function readBundledPack(url: string): Promise<string> {
  if (!MoosiacFileSystem)
    throw new Error('Windows filesystem bridge is unavailable.');
  const root = await MoosiacFileSystem.getMainBundlePath();
  return MoosiacFileSystem.readFile(
    `${root}/${DIR}/${bundledPackFile(url)}`,
    'utf8',
  );
}
