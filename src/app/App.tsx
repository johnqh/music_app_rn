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
// Side-effect: activates the Swiss design theme before anything renders.
import '@/config/designTheme';

import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import * as RNLocalize from 'react-native-localize';
import { createEmptyScore } from '@sudobility/music_types';
import { initializeApp } from '@/config/initialize';
import { initializeI18n } from '@/i18n';
import { DocumentList } from '@/documents/document-list';
import { createDocument } from '@/documents/document';
import { createAutosaver } from '@/documents/autosave';
import { saveDocument } from '@/documents/document-storage';
import { createFileStorage } from '@/documents/rn-storage';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { MenuImportCommands } from '@/features/documents/MenuImportCommands';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@sudobility/components-rn';
import { ThemeVarsProvider } from '@/components/ThemeVarsProvider';
import { ThemeProvider } from '@/config/ThemeContext';
import { AuthProvider } from '@/auth/AuthContext';
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
  const list = useMemo(() => {
    initializeApp({ dev: __DEV__ });
    initializeI18n(RNLocalize.getLocales().map(l => l.languageTag));

    const documents = new DocumentList();
    /*
      Saving happens outside editing. The editing store reports that something
      changed; who writes the bytes, and when, is the app's business — which is
      what lets the same slices back a local file here and a server project on
      the web.
    */
    const storage = createFileStorage();
    const autosaver = createAutosaver({
      save: d => saveDocument(d, storage),
    });
    // Something to look at on first launch. A real "new score" goes through the
    // same call, which is the point: an unsaved document is an ordinary one.
    documents.open(
      createDocument({
        id: 'scratch',
        title: 'Untitled',
        // Eight bars, not one: a new score should have somewhere to write
        // before the first bar has to be added by hand.
        score: createEmptyScore({ title: 'Untitled', measures: 8 }),
        onChanged: d => autosaver.notify(d),
      }),
    );
    return documents;
  }, []);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        {/*
          Outside the vars provider, because it decides what those vars are.
        */}
        <ThemeProvider>
          <ThemeVarsProvider>
            {/*
            Above everything that opens a picker: a portalled sheet draws here,
            so it escapes the scrolling toolbar that would otherwise clip it —
            and needs no `Modal`, which React Native macOS cannot mount.
          */}
            <PortalHost>
              <QueryClientProvider client={queryClient}>
                {/*
                Auth wraps the navigator rather than gating it: the editor is
                usable signed out, and only the screens that read the server
                ask whether there is an account.
              */}
                <AuthProvider>
                  <DocumentsProvider list={list}>
                    {/*
                      Inside the documents provider and above the navigator: a
                      File-menu import makes a new document from whatever screen
                      is in front, so it can belong to none of them.
                    */}
                    <MenuImportCommands />
                    <Navigation />
                  </DocumentsProvider>
                </AuthProvider>
              </QueryClientProvider>
            </PortalHost>
          </ThemeVarsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
