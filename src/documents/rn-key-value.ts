/**
 * `KeyValueStore` over AsyncStorage — the recent-documents list's backing.
 *
 * The one platform-bound file behind `recent-documents.ts`, kept apart for the
 * reason `rn-storage.ts` is: the ordering, the cap and the tolerance of state
 * an older build wrote are all testable without a device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './recent-documents';

export function createKeyValueStore(): KeyValueStore {
  return {
    getItem: key => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  };
}
