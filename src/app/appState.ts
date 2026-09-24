/**
 * Everything a document is built with, and the query cache — shared across
 * every window this process opens, not just the main one.
 *
 * Used to live inline in `App.tsx`'s own start-up `useMemo`. It moved here
 * once the desktop Projects window (`ProjectsWindow.tsx`) needed the same
 * document list: that window and the main one are two separate native
 * windows, each with its own `RCTRootView` and so its own React tree — a
 * context provider in one reaches nothing in the other — but they share one
 * JS runtime, and a module-level singleton is what a second tree can still
 * read. `getSharedAppState()` is cached after the first call, whichever
 * window makes it, so the real set-up (services, i18n, the scratch
 * document) runs exactly once regardless of which window happens to mount
 * first.
 */
import { newProjectScore } from '@sudobility/music_lib';
import { getDeviceLocaleTags as getDeviceLanguageTags } from '@sudobility/building_blocks_rn';
import { bindDevicePrefs, mirrorDevicePrefs } from '@sudobility/music_lib';
import type { StoreContext } from '@sudobility/music_lib';
import { initializeApp, getAppServices } from '@/config/initialize';
import { CONSTANTS } from '@/config/constants';
import { applyAppName } from '@/platform/windowTitle';
import { getMusicClient } from '@/config/server';
import { devicePrefs } from '@/config/useDevicePrefs';
import { followLanguagePref, initializeI18n } from '@/i18n';
import { DocumentList, pauseLeavingDocument } from '@/documents/document-list';
import { newDocument } from '@/documents/document';
import type { DocumentServices } from '@/documents/document';
import { createFileStorage } from '@/documents/rn-storage';
import { createKeyValueStore } from '@/documents/rn-key-value';
import { recordRecent } from '@/documents/useRecentTracking';
import { appToasts } from '@/features/toasts/Toasts';
import { readIdToken } from '@/auth/AuthContext';
import { QueryClient } from '@tanstack/react-query';

/*
  One client for the process, same as the document list below — built once,
  outside any component, so a fast refresh does not throw away every cached
  project list, and both windows read the same cache rather than each
  fetching the project list on its own.
*/
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A phone loses its network far more often than a desktop does, and a
      // refetch on every reconnect is what makes the dashboard feel current
      // rather than stale-until-pulled.
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export type SharedAppState = {
  list: DocumentList;
  services: DocumentServices;
};

let cached: SharedAppState | null = null;

export function getSharedAppState(): SharedAppState {
  if (cached) return cached;

  initializeApp({ dev: __DEV__ });
  // Never changes mid-session, unlike the window title (`WindowTitleSync`),
  // so once here is enough — see `windowTitle.ts`'s own comment.
  applyAppName(CONSTANTS.APP_NAME);
  const deviceTags = getDeviceLanguageTags();
  initializeI18n(deviceTags);

  const keyValue = createKeyValueStore();
  /*
    Device prefs: loaded once, written back on every change. The stored
    language wins over the device's once the load lands; until then the
    device's is in force, which is what a first launch wants anyway.
  */
  bindDevicePrefs(devicePrefs, keyValue);
  followLanguagePref(devicePrefs, deviceTags);

  /*
    The server context every store closes over for life. The token getter is
    Firebase's own singleton read per call, never a provider's state: the
    scratch document is built before any provider mounts, and a store keeps
    the context it was built with. No client means no server at all, which
    `hasServer` reports and every server-backed control asks.
  */
  const client = getMusicClient();
  const context: StoreContext = {
    ...(client ? { client, getToken: readIdToken } : {}),
    // Autosave failures, playback errors, generation failures and editing
    // refusals all arrive here, whichever tab (or window) raised them.
    toasts: appToasts,
  };
  const documentServices: DocumentServices = {
    context,
    files: createFileStorage(),
    // After a write succeeds, never before: a file that failed to save is
    // not one worth offering to reopen.
    onSaved: saved => recordRecent(keyValue, saved),
  };

  /*
    The list owns each document's lifetime: the one pref editing reads
    (pitch display — note entry inverts the written-pitch lens) is mirrored
    into its store while it is open and detached when it closes. Theme,
    developer mode and the developer settings are not document state at all
    and are read straight off `devicePrefs`.
  */
  const documents = new DocumentList({
    attach: document => mirrorDevicePrefs(devicePrefs, document.store),
    /*
      A tab going behind another is **paused** — never stopped, which would
      home the playhead to bar 1 — before its caret is banked; the rule and
      its reasons are `pauseLeavingDocument`'s. A tab being closed is named
      to it too: its editor unmounts only after the fallback tab's caret is
      restored, so a pause left to its player binding would report over that
      caret.
    */
    leaveFront: leaving =>
      pauseLeavingDocument(getAppServices().player, leaving),
  });
  // Something to look at on first launch. A real "new score" goes through the
  // same call, which is the point: an unsaved document is an ordinary one.
  documents.open(
    newDocument(documentServices, {
      title: 'Untitled',
      /*
        The same score a "New Project" makes, from the same place: a piano
        track and eight bars to write in. What a new project starts as is
        music_lib's decision, so the two apps and the two ways in cannot
        disagree — and so a blank page always has a track on it.
      */
      score: newProjectScore('Untitled'),
    }),
  );

  cached = { list: documents, services: documentServices };
  return cached;
}
