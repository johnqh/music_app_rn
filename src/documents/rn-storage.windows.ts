import { Buffer } from 'buffer';
import { NativeModules } from 'react-native';
import { DOCUMENT_EXTENSION, exportFilename } from '@sudobility/music_lib';
import type { DocumentFileStorage } from '@sudobility/music_lib';
import type { ImportSource } from './import';

const { MoosiacFileSystem } = NativeModules;

function filesystem(): typeof MoosiacFileSystem {
  if (!MoosiacFileSystem)
    throw new Error('Windows filesystem bridge is unavailable.');
  return MoosiacFileSystem;
}

export function createImportSource(): ImportSource {
  return {
    readText: uri => filesystem().readFile(uri, 'utf8'),
    async readBytes(uri) {
      const base64 = await filesystem().readFile(uri, 'base64');
      const buffer = Buffer.from(base64, 'base64');
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
    },
  };
}

export function createFileStorage(): DocumentFileStorage {
  return {
    readText: uri => filesystem().readFile(uri, 'utf8'),
    writeText: (uri, text) => filesystem().writeFile(uri, text, 'utf8'),
  };
}

export async function defaultDocumentUri(title: string): Promise<string> {
  return filesystem()
    .getDocumentDirectoryPath()
    .then(
      (directory: string) =>
        `${directory}/${exportFilename(title, DOCUMENT_EXTENSION)}`,
    );
}
