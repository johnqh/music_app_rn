/**
 * The documents opened lately, most recent first.
 *
 * Persisted through an injected key-value store rather than `AsyncStorage`
 * directly, for the reason `DocumentStorage` is injected: the rules worth
 * testing — the cap, the ordering, what happens to a duplicate — are testable
 * without a device.
 *
 * A macOS App Store build cannot reopen a path it merely remembers: the sandbox
 * wants a security-scoped bookmark, which is a different token entirely. That
 * is why an entry carries an opaque `handle` beside its `uri` — on every other
 * platform the handle is the uri, and on sandboxed macOS it is the bookmark.
 * Storing only the path would make this feature quietly useless there.
 */
export type RecentDocument = {
  uri: string;
  title: string;
  /** What to reopen with. Equal to `uri` unless the platform needs a token. */
  handle: string;
  /** Milliseconds since the epoch, supplied by the caller — never read here. */
  openedAt: number;
};

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const KEY = 'moosiac.recentDocuments';

/**
 * How many to keep.
 *
 * Small on purpose: a recent list is a shortcut, and one that needs scrolling
 * is a file browser with worse ordering.
 */
export const RECENT_LIMIT = 10;

export async function loadRecent(
  store: KeyValueStore,
): Promise<RecentDocument[]> {
  const raw = await store.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtered rather than trusted: this is persisted state from an older
    // build, which is as untrusted as a file on disk.
    return parsed.filter(
      (entry): entry is RecentDocument =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentDocument).uri === 'string' &&
        typeof (entry as RecentDocument).title === 'string' &&
        typeof (entry as RecentDocument).handle === 'string' &&
        typeof (entry as RecentDocument).openedAt === 'number',
    );
  } catch {
    // Unreadable is the same as empty here: a recent list is a convenience,
    // and throwing on start-up over one would be absurd.
    return [];
  }
}

/** Records an open, moving an already-known document to the front. */
export async function noteOpened(
  store: KeyValueStore,
  entry: RecentDocument,
): Promise<RecentDocument[]> {
  const existing = await loadRecent(store);
  const next = [entry, ...existing.filter(e => e.uri !== entry.uri)].slice(
    0,
    RECENT_LIMIT,
  );
  await store.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Drops one, for a file that has gone away. */
export async function forgetRecent(
  store: KeyValueStore,
  uri: string,
): Promise<RecentDocument[]> {
  const next = (await loadRecent(store)).filter(e => e.uri !== uri);
  await store.setItem(KEY, JSON.stringify(next));
  return next;
}
