import type { NativeSynthApi } from '@sudobility/music_player/rn';

export const nativeSynthApi: NativeSynthApi;
/** The FluidR3 font bundled with the desktop app, as a file path. */
export function bundledSoundfontPath(): string | null;
export function outputDevices(): Promise<Array<{ id: string; name: string }>>;
export function selectedOutputDevice(): string;
export function setOutputDevice(id: string): Promise<void>;
