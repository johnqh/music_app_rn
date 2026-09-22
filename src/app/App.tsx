/**
 * The composition root's React half.
 *
 * Start-up order is the one thing here that matters: services first (the player
 * has to be registered before anything resolves it), then i18n, then the tree.
 * Both are idempotent, so a fast refresh does not rebuild the audio engine.
 *
 * There is no auth gate. A local document needs no server and no account — the
 * store is built without a `MusicClient` at all — so the app opens straight
 * into the editor. Signing in adds server projects later; it does not gate the
 * thing you already have on disk.
 */
import '../../global.css';
import { newProjectScore } from '@sudobility/music_lib';
// Side-effect: activates the Swiss design theme before anything renders.
import '@/config/designTheme';

import { useEffect, useMemo } from 'react';
import { GestureRoot } from '@/platform/GestureRoot';
import { SafeAreaProvider } from '@/platform/SafeArea';
import { AppState } from 'react-native';
import { getDeviceLocaleTags as getDeviceLanguageTags } from '@sudobility/building_blocks_rn';
import { bindDevicePrefs, mirrorDevicePrefs } from '@sudobility/music_lib';
import type { StoreContext } from '@sudobility/music_lib';
import { initializeApp, getAppServices } from '@/config/initialize';
import { getMusicClient } from '@/config/server';
import { devicePrefs } from '@/config/useDevicePrefs';
import { followLanguagePref, initializeI18n } from '@/i18n';
import { DocumentList, pauseLeavingDocument } from '@/documents/document-list';
import { newDocument } from '@/documents/document';
import type { DocumentServices } from '@/documents/document';
import { createFileStorage } from '@/documents/rn-storage';
import { createKeyValueStore } from '@/documents/rn-key-value';
import { recordRecent } from '@/documents/useRecentTracking';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { appToasts, Toasts } from '@/features/toasts/Toasts';
import { MenuImportCommands } from '@/features/documents/MenuImportCommands';
import { MenuFileCommands } from '@/features/documents/MenuFileCommands';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@sudobility/components-rn';
import { ThemeVarsProvider } from '@/components/ThemeVarsProvider';
import { ThemeProvider } from '@/config/ThemeContext';
import { AuthProvider, readIdToken } from '@/auth/AuthContext';
import { Navigation } from './Navigation';

/*
  One client for the process. Built outside the component so a fast refresh
  does not throw away every cached project list.
*/
const queryClient = new QueryClient({
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

export default function App() {
  /*
    Everything a document is built with, built once.

    Every document store in the app — the scratch one below, a New from the File
    menu, an import, a project opened from the dashboard — is made with these
    services, handed down by `DocumentsProvider`. That is what the old
    arrangement got wrong: its autosaver lived here and nothing below could
    reach it, so a document made anywhere else registered no change callback
    and never saved itself.
  */
  const { list, services } = useMemo(() => {
    initializeApp({ dev: __DEV__ });
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
      // refusals all arrive here, whichever tab raised them.
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
    return { list: documents, services: documentServices };
  }, []);

  /*
    Flush on the way out of the foreground.

    A phone may kill a backgrounded app without another word, and the autosave
    debounce is exactly the window in which the last edit exists only in
    memory. `inactive` counts — on iOS that is the app switcher, which is where
    a swipe ends the process.
  */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') void list.flushAll();
    });
    return () => subscription.remove();
  }, [list]);

  return (
    <GestureRoot>
      <SafeAreaProvider>
        {/*
          Outside the vars provider, because it decides what those vars are.
        */}
        <ThemeProvider>
          <ThemeVarsProvider>
            <QueryClientProvider client={queryClient}>
              {/*
                Auth wraps the navigator rather than gating it: the editor is
                usable signed out, and only the screens that read the server
                ask whether there is an account.
              */}
              <AuthProvider>
                <DocumentsProvider list={list} services={services}>
                  {/*
                    Above everything that opens a picker: a portalled sheet
                    draws here, so it escapes the scrolling toolbar that would
                    otherwise clip it. Inside the data providers, not above
                    them: what is portalled is still part of the app, and a
                    dialog drawn here that reads the server — the presets in
                    New Project — failed with "No QueryClient set" when this
                    sat outside `QueryClientProvider`.
                  */}
                  <PortalHost>
                    {/*
                      A File-menu import makes a new document from whatever
                      screen is in front, so it can belong to none of them.
                    */}
                    <MenuImportCommands />
                    <MenuFileCommands />
                    <Navigation />
                    <Toasts />
                  </PortalHost>
                </DocumentsProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ThemeVarsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureRoot>
  );
}
