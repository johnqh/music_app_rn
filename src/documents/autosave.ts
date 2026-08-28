/**
 * Saving a document without being asked.
 *
 * Debounced, because a save per keystroke would write the whole score on every
 * note — and coalesced per document, so two documents being edited in turn do
 * not starve each other.
 *
 * Deliberately **not** the web app's autosaver: that one belongs to a project
 * slice and PUTs to a server. This writes a file, and the difference that
 * matters is what happens when it fails — a server save can be retried against
 * a row that still exists, where a file save may have failed because the volume
 * went away. So a failure here surfaces and stops rather than retrying forever.
 *
 * A document with no file yet is never autosaved: choosing where a new score
 * lives is the user's decision, and picking a path for them is how a file ends
 * up somewhere nobody looks.
 */
import type { MusicDocument } from './document';

export type SaveFn = (document: MusicDocument) => Promise<unknown>;

export type Autosaver = {
  /** Called whenever a document changes. Safe to call on every edit. */
  notify(document: MusicDocument): void;
  /** Writes anything pending now — for a quit, or an explicit save. */
  flush(): Promise<void>;
  dispose(): void;
};

export const AUTOSAVE_DELAY_MS = 1500;

export type AutosaverOptions = {
  save: SaveFn;
  onError?: (document: MusicDocument, error: unknown) => void;
  delayMs?: number;
  /** Injected so tests need no timers of their own. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export function createAutosaver(options: AutosaverOptions): Autosaver {
  const delay = options.delayMs ?? AUTOSAVE_DELAY_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? (h => clearTimeout(h as never));

  const pending = new Map<string, MusicDocument>();
  let handle: unknown = null;
  let disposed = false;

  async function writeAll(): Promise<void> {
    const documents = [...pending.values()];
    pending.clear();
    for (const document of documents) {
      // Only what still needs writing, and only what has somewhere to go.
      if (!document.dirty || document.origin.kind !== 'file') continue;
      try {
        await options.save(document);
      } catch (error) {
        options.onError?.(document, error);
      }
    }
  }

  return {
    notify(document) {
      if (disposed) return;
      pending.set(document.id, document);
      if (handle !== null) clearTimer(handle);
      handle = setTimer(() => {
        handle = null;
        void writeAll();
      }, delay);
    },
    async flush() {
      if (handle !== null) {
        clearTimer(handle);
        handle = null;
      }
      await writeAll();
    },
    dispose() {
      disposed = true;
      if (handle !== null) clearTimer(handle);
      handle = null;
      pending.clear();
    },
  };
}
