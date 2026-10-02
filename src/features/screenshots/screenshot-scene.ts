/**
 * The screenshot scene in force, handed from the link listener
 * (`ScreenshotLinks.tsx`) to the screens that draw it.
 *
 * What a scene sets is state that already lives in those screens — the
 * editor's open sheet, `AppLayout`'s Spatial toggle, File ▸ New's sheet — so
 * each of them reads the scene and applies it to its own state, rather than
 * the listener reaching in.
 *
 * **Each scene is applied once per consumer.** A consumer that mounts after
 * the scene was published (the editor of a document the link just opened)
 * still applies it; one that remounts later — the reader navigating back to
 * the editor — does not apply it again. A scene names the document it is for,
 * so the editor of the document being replaced, still mounted for a moment,
 * does not take a scene meant for the one replacing it.
 */
import { useEffect, useRef } from 'react';
import type { ScreenshotScene } from './screenshot-links';

export type PublishedScene = {
  scene: ScreenshotScene;
  /** The document in front when the scene applies; null for none. */
  documentId: string | null;
  /** Tells one scene from the next, even an identical one. */
  at: number;
};

let current: PublishedScene | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
const applied = new Map<string, number>();

export function publishScene(
  scene: ScreenshotScene,
  documentId: string | null,
): void {
  sequence += 1;
  current = { scene, documentId, at: sequence };
  for (const listener of [...listeners]) listener();
}

/**
 * Calls `apply` with each scene published for `documentId` (or for any
 * document, when it is omitted), once per `consumer` name.
 */
export function useScreenshotScene(
  consumer: string,
  apply: (scene: ScreenshotScene) => void,
  documentId?: string | null,
): void {
  const ref = useRef(apply);
  ref.current = apply;
  useEffect(() => {
    const check = () => {
      if (!current || applied.get(consumer) === current.at) return;
      if (documentId !== undefined && current.documentId !== documentId) {
        return;
      }
      applied.set(consumer, current.at);
      ref.current(current.scene);
    };
    check();
    listeners.add(check);
    return () => {
      listeners.delete(check);
    };
  }, [consumer, documentId]);
}
