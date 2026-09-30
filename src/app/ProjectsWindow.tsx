/**
 * The desktop Projects window's own React root — a *separate* native window
 * from the main one (`App.tsx`), not a screen inside it. Registered under
 * its own `AppRegistry` name (`MoosiacProjects`, `index.js`) and given its
 * own native window lazily, the first time `nav.projects` asks for one
 * (`AppDelegate.mm` on macOS, `WindowManagerModule.cpp` on Windows) — see
 * `platform/projectsWindow.ts` for the JS side of that.
 *
 * **Its own tree, sharing the app's state, not its context.** A provider
 * mounted in `App.tsx` reaches nothing here — this is a different `RCTRootView`
 * entirely — so every provider the main window has is mounted again: same
 * shape as `App.tsx`, and the same `getSharedAppState()`/`queryClient`
 * singletons underneath, so both windows show the same documents and the
 * same cached project list rather than two independent copies that could
 * disagree.
 *
 * **A single-route navigator, not a stack of screens.** The content is
 * `ProjectsSplitView` — a sidebar and whichever pane it has selected, held
 * as its own local state, not navigation history. The navigator exists only
 * because `SignInScreen`'s `ScreenBackBar` (macOS's own) calls
 * `useNavigation()` and throws without one nearby; a single route with
 * `canGoBack()` always false is what makes that call answer "there is
 * nothing to go back to" instead of failing to resolve at all.
 */
import '../../global.css';
import '@/config/designTheme';

import { useMemo } from 'react';
import { GestureRoot } from '@/platform/GestureRoot';
import { SafeAreaProvider } from '@/platform/SafeArea';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@sudobility/components-rn';
import { getSharedAppState, queryClient } from './appState';
import { createAppStackNavigator } from './createAppStackNavigator';
import { DocumentsProvider } from '@/documents/DocumentsContext';
import { ThemeVarsProvider } from '@/components/ThemeVarsProvider';
import { ThemeProvider } from '@/config/ThemeContext';
import { AuthProvider } from '@/auth/AuthContext';
import { navigationRef } from './Navigation';
import {
  closeProjectsWindow,
  focusMainWindow,
} from '@/platform/projectsWindow';
import { ProjectsSplitView } from './projects-window/ProjectsSplitView';

type ProjectsRootStackParamList = {
  Root: undefined;
};

const Stack = createAppStackNavigator<ProjectsRootStackParamList>();

/**
 * The split view, with what this window does once a project is open.
 *
 * **Dismissed by opening a project, never by anything drawn here**: the main
 * window is focused (`focusMainWindow`) and this one dismissed
 * (`closeProjectsWindow`) — the same two calls for every way in, so picking a
 * project never leaves this window stranded open behind the editor.
 */
function ProjectsRoot() {
  return (
    <ProjectsSplitView
      onProjectOpened={() => {
        focusMainWindow();
        closeProjectsWindow();
      }}
      onOpenCredits={() => {
        // Credits lives in the main window's own navigator — there is no
        // Credits pane here — so reaching it is the same handoff, minus the
        // close: the reader came here to buy credits, not to finish picking
        // a project.
        focusMainWindow();
        if (navigationRef.isReady()) navigationRef.navigate('Credits');
      }}
    />
  );
}

export default function ProjectsWindow() {
  // Same call the main window makes (`App.tsx`); cached after whichever
  // window makes it first — see `appState.ts`.
  const { list, services } = useMemo(() => getSharedAppState(), []);

  return (
    <GestureRoot>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemeVarsProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <DocumentsProvider list={list} services={services}>
                  <PortalHost>
                    <NavigationContainer>
                      <Stack.Navigator screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="Root" component={ProjectsRoot} />
                      </Stack.Navigator>
                    </NavigationContainer>
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
