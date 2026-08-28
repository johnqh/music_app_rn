/**
 * The gateway to music_api, and the context its hooks want.
 *
 * Built lazily and cached: a build with no API configured never constructs one,
 * and `hasServer` in music_lib is what everything else asks before offering a
 * server-backed feature.
 */
import { MusicClient } from '@sudobility/music_client';
import { RNNetworkClient } from '@sudobility/di_rn';
import { CONSTANTS } from '@/config/constants';

let client: MusicClient | null = null;
let network: RNNetworkClient | null = null;

/** The shared network client — the one place this app makes an HTTP request. */
export function getNetworkClient(): RNNetworkClient {
  network ??= new RNNetworkClient();
  return network;
}

/**
 * The typed client, or null when this build has no API to talk to.
 *
 * Null rather than a throwing stub: "there is no server" is a state the store
 * models, and a client that existed but failed every call would be a worse
 * shape than one that is honestly absent.
 */
export function getMusicClient(): MusicClient | null {
  if (!CONSTANTS.API_URL) return null;
  client ??= new MusicClient(getNetworkClient(), CONSTANTS.API_URL);
  return client;
}

export function resetServer(): void {
  client = null;
  network = null;
}
