/**
 * RNW's Composition host emulates RAF with immediate UI dispatcher posts.
 * Bound frame work to the display cadence so playback cannot flood that queue.
 * A timeout also keeps working across scroll/layout transitions.
 */
export function installWindowsAnimationFrames() {
  globalThis.requestAnimationFrame = callback =>
    setTimeout(
      () => callback(performance.now()),
      1000 / 60,
    ) as unknown as number;
  globalThis.cancelAnimationFrame = handle => clearTimeout(handle);
}
