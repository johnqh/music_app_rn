import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import type { NativeUploadFile } from '@sudobility/music_client';
import { getAppServices } from '@/config/initialize';
import type { VoiceRecording } from './voice-recorder';

/** Converts the recorder's local WAV to a compact MP3 before upload. */
export async function voiceRecordingAsMp3(
  recording: VoiceRecording,
): Promise<NativeUploadFile> {
  const wav = await recording.stop();
  let base64: string;
  if (Platform.OS === 'windows') {
    const fs = NativeModules.MoosiacFileSystem as {
      readFile(path: string, encoding: string): Promise<string>;
      writeFile(path: string, data: string, encoding: string): Promise<boolean>;
      getDocumentDirectoryPath(): Promise<string>;
    };
    if (!fs) throw new Error('Windows filesystem bridge is unavailable');
    const sourcePath = decodeURIComponent(
      wav.uri.replace(/^file:\/\//, '').replace(/^\/(\w:)/, '$1'),
    );
    const source = await fs.readFile(sourcePath, 'base64');
    const bytes = Buffer.from(source, 'base64');
    const wavBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const audio = await getAppServices().io.audioCodec.decode(wavBuffer);
    const encoded = new Uint8Array(
      getAppServices().io.audioCodec.encodeMp3(audio),
    );
    base64 = Buffer.from(encoded).toString('base64');
    const path = `${await fs.getDocumentDirectoryPath()}/voice-${Date.now()}.mp3`;
    await fs.writeFile(path, base64, 'base64');
    return {
      uri: `file:///${path.replaceAll('\\', '/')}`,
      name: 'voice.mp3',
      type: 'audio/mpeg',
    };
  }

  const fsModule =
    require('react-native-fs') as typeof import('react-native-fs') & {
      default?: typeof import('react-native-fs');
    };
  const RNFS = fsModule.default ?? fsModule;
  const sourcePath = decodeURIComponent(wav.uri.replace(/^file:\/\//, ''));
  const source = await RNFS.readFile(sourcePath, 'base64');
  const bytes = Buffer.from(source, 'base64');
  const wavBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const io = getAppServices().io;
  const audio = await io.audioCodec.decode(wavBuffer);
  const encoded = new Uint8Array(io.audioCodec.encodeMp3(audio));
  const base64Mp3 = Buffer.from(encoded).toString('base64');
  const path = `${RNFS.CachesDirectoryPath}/voice-${Date.now()}.mp3`;
  await RNFS.writeFile(path, base64Mp3, 'base64');
  return { uri: `file://${path}`, name: 'voice.mp3', type: 'audio/mpeg' };
}
