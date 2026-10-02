/**
 * Delivers open links to a listener — see `open-links.ts` for what one is.
 *
 * Its own module so the parsing beside it stays plain TypeScript a node test
 * can import; this half needs React Native's `Linking`.
 */
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { openLinkFor } from './open-links';
import type { OpenLink } from './open-links';

/**
 * The launch link, read once per run and shared by every listener.
 *
 * `Linking.getInitialURL()` keeps answering with the same URL for the life of
 * the process, so a listener that remounted — a navigation, a Fast Refresh —
 * asked again and re-delivered a link that had already been opened: a document
 * re-raised, a MIDI import wizard opened a second time. The promise is created
 * once; each listener is handed the answer exactly once, on its first mount.
 */
let launchLink: Promise<string | null> | null = null;
const deliveredLaunchTo = new Set<string>();

/**
 * Calls `handler` with each URL the app is opened with: the one that launched
 * it, then every one that arrives while it runs.
 *
 * Held in a ref like `useMenuCommand`, so a caller needn't memoize it. Every
 * listener reads the same launch link, delivered to each name once.
 */
export function useLinkUrls(
  /** Which listener this is; the launch link is delivered once per name. */
  name: string,
  handler: (url: string) => void,
): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    let live = true;
    const deliver = (url: string | null) => {
      if (live && url) ref.current(url);
    };
    launchLink ??= Linking.getInitialURL().catch(() => null);
    if (!deliveredLaunchTo.has(name)) {
      deliveredLaunchTo.add(name);
      void launchLink.then(deliver);
    }
    const subscription = Linking.addEventListener('url', event =>
      deliver(event.url),
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, [name]);
}

/**
 * Calls `handler` for each open link: the one that launched the app, then every
 * one that arrives while it runs.
 *
 * Two listeners mount this — documents and imports — and each acts on its own
 * kind. A URL that is not an open link is ignored.
 */
export function useOpenLink(
  /** Which listener this is; the launch link is delivered once per name. */
  name: string,
  handler: (link: OpenLink) => void,
): void {
  const ref = useRef(handler);
  ref.current = handler;
  useLinkUrls(name, url => {
    const link = openLinkFor(url);
    if (link) ref.current(link);
  });
}
