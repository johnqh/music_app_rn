/**
 * libfluidsynth on macOS, as `@sudobility/music_player`'s `NativeSynthApi`.
 *
 * The Mac used to play per-note MP3 renderings of FluidR3: every instrument in
 * a score decoded before the first note, and a clock taken from JavaScript
 * timers, which is why "Preparing instruments" took so long and the playhead
 * jumped. This is the synthesizer the web runs, driven by the same scheduler
 * through `NativeSynthBackend`.
 *
 * A local package so autolinking installs it, like `@moosiac/file-picker`.
 */
import { NativeModules } from 'react-native';

const { MoosiacSynth } = NativeModules;

export function bundledSoundfontPath() {
  return MoosiacSynth ? MoosiacSynth.bundledSoundfontPath() : null;
}

export const nativeSynthApi = {
  isSupported() {
    return MoosiacSynth != null;
  },
  createSynth() {
    const M = MoosiacSynth;
    return {
      async initialize({ soundfontUri, instanceCount, settings, onProgress }) {
        onProgress?.(0);
        await M.initialize(soundfontUri, instanceCount, settings);
        onProgress?.(1);
      },
      ensureInstances: count => M.ensureInstances(count),
      currentTime: () => M.currentTime(),
      outputLatency: () => M.outputLatency(),
      noteAt: (i, c, m, v, delay, duration) => {
        M.noteAt(i, c, m, v, delay, duration);
      },
      noteOn: (i, c, m, v) => {
        M.noteOn(i, c, m, v);
      },
      noteOff: (i, c, m) => {
        M.noteOff(i, c, m);
      },
      programSelect: (i, c, program) => {
        M.programSelect(i, c, program);
      },
      setChannelPercussion: (i, c, kit) => {
        M.setChannelPercussion(i, c, kit ?? -1);
      },
      controlChange: (i, c, control, value) => {
        M.controlChange(i, c, control, value);
      },
      cancelScheduledOn: i => {
        M.cancelScheduledOn(i);
      },
      allSoundOff: () => {
        M.allSoundOff();
      },
      setInterpolation: order => {
        M.setInterpolation(order);
      },
      setMasterVolume: volume => {
        M.setMasterVolume(volume);
      },
      dispose: () => {
        M.dispose();
      },
    };
  },
};
