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

import { useEffect, useMemo } from 'react';
import { GestureRoot } from '@/platform/GestureRoot';
import { SafeAreaProvider } from '@/platform/SafeArea';
import { AppState, StatusBar } from 'react-native';
import { getSharedAppState, queryClient } from './appState';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { Toasts } from '@/features/toasts/Toasts';
import { MenuImportCommands } from '@/features/documents/MenuImportCommands';
import { MenuFileCommands } from '@/features/documents/MenuFileCommands';
import { WindowTitleSync } from '@/features/documents/WindowTitleSync';
import { QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@sudobility/components-rn';
import { ThemeVarsProvider } from '@/components/ThemeVarsProvider';
import { ThemeProvider } from '@/config/ThemeContext';
import { AuthProvider } from '@/auth/AuthContext';
import { Navigation } from './Navigation';

export default function App() {
  // `getSharedAppState()` runs the real set-up exactly once, however many
  // windows call it — see `appState.ts`. This is the main window's own copy
  // of the `{ list, services }` it returns.
  const { list, services } = useMemo(() => getSharedAppState(), []);

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
        <StatusBar hidden={false} />
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
                    <WindowTitleSync />
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
