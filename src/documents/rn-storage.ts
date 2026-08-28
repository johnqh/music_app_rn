/**
 * `DocumentStorage` over the device filesystem.
 *
 * The one platform-bound file in the document layer, which is why everything
 * above it takes the interface instead. On a sandboxed macOS build this is
 * where the document picker and security-scoped bookmarks go: the rule that a
 * path alone is not permission to read is a property of the storage, not of the
 * document.
 */
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
import type { DocumentStorage } from './document-storage';
import type { ImportSource } from './import';

/**
 * Reading the bytes an import needs.
 *
 * Separate from `DocumentStorage` because it answers a different question:
 * a document is text this app wrote, where an import is somebody else's binary
 * file. `react-native-fs` has no byte read — it returns base64 — so the decode
 * happens here rather than in every caller.
 */
export function createImportSource(): ImportSource {
  return {
    readText: uri => RNFS.readFile(uri, 'utf8'),
    async readBytes(uri) {
      const base64 = await RNFS.readFile(uri, 'base64');
      const buffer = Buffer.from(base64, 'base64');
      /*
        `.buffer` alone would be wrong: Buffer views a pooled ArrayBuffer that
        is usually larger than the file and shared with other reads, so a codec
        handed it would decode whatever happened to be next to it in the pool.
      */
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
    },
  };
}

export function createFileStorage(): DocumentStorage {
  return {
    readText: uri => RNFS.readFile(uri, 'utf8'),
    writeText: (uri, text) => RNFS.writeFile(uri, text, 'utf8'),
    // The documents directory, not caches: a score the user made is theirs to
    // keep, and the system is free to empty a cache whenever it likes.
    defaultDirectory: () => RNFS.DocumentDirectoryPath,
    join: (directory, filename) => `${directory}/${filename}`,
  };
}
