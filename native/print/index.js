/**
 * Printing, as each platform actually does it.
 *
 * Every one of these hands the OS a *drawing* and lets it produce the document
 * — `UIPrintInteractionController` on iOS, `PrintManager` with a
 * `PrintedPdfDocument` on Android, `NSPrintOperation` on macOS. The app never
 * authors a PDF; it renders pages with the same Skia renderer the editor draws
 * with, and passes them here as base64 PNGs.
 */
import { NativeModules } from 'react-native';

const { MoosiacPrint } = NativeModules;

export function isSupported() {
  return MoosiacPrint != null;
}

/**
 * Opens the platform's print UI for `pages`.
 *
 * Resolves true if the job was submitted and false if it was cancelled —
 * cancelling is an ordinary outcome, not an error, and rejecting would put a
 * `try` around every call site for somebody changing their mind.
 */
export function printPages(jobName, pages) {
  if (!MoosiacPrint) {
    return Promise.reject(new Error('No print service on this platform.'));
  }
  return MoosiacPrint.printPages(jobName, pages);
}
