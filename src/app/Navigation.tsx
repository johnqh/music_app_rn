/**
 * The app's screens, mirroring the web app's routes.
 *
 * The web is a router over `/:lang/...`; this is a native stack over the same
 * destinations — dashboard, editor, community, published, docs, settings,
 * credits and sign-in. Matching the set is what makes the two the same product;
 * matching the *mechanism* would not, since a URL is not a thing a phone has.
 *
 * **There is no auth gate.** The web app puts one above everything except
 * community and published pages; here the editor works on a local document with
 * no account at all, so the gate would refuse what the app is for. Screens that
 * genuinely need a server say so themselves.
 */
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { EditorScreen } from '@/features/editor/EditorScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { DocsScreen } from '@/screens/DocsScreen';
import { CommunityScreen } from '@/screens/CommunityScreen';
import { PublishedScreen } from '@/screens/PublishedScreen';
import { CreditsScreen } from '@/screens/CreditsScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { ShortcutsScreen } from '@/screens/ShortcutsScreen';
import { ResourcesScreen } from '@/screens/ResourcesScreen';
import { AboutScreen } from '@/screens/AboutScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  Editor: { projectId?: string } | undefined;
  Community: undefined;
  Published: { publicId: string };
  Docs: { topicId?: string } | undefined;
  Settings: undefined;
  Credits: undefined;
  SignIn: undefined;
  Shortcuts: undefined;
  Resources: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function Navigation() {
  const { t } = useTranslation();
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Editor"
        screenOptions={{ headerShown: false }}
      >
        {/*
          The editor first, not the dashboard. The web opens on a project list
          because a project lives on a server; here a document lives on the
          device, and opening into an empty editor is the shorter path to
          writing something.
        */}
        <Stack.Screen name="Editor" component={EditorScreen} />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ headerShown: true, title: t('nav.projects') }}
        />
        <Stack.Screen
          name="Community"
          component={CommunityScreen}
          options={{ headerShown: true, title: t('nav.community') }}
        />
        <Stack.Screen
          name="Published"
          component={PublishedScreen}
          options={{ headerShown: true, title: t('nav.published') }}
        />
        <Stack.Screen
          name="Docs"
          component={DocsScreen}
          options={{ headerShown: true, title: t('nav.docs') }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: true, title: t('nav.settings') }}
        />
        <Stack.Screen
          name="Credits"
          component={CreditsScreen}
          options={{ headerShown: true, title: t('nav.credits') }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ headerShown: true, title: t('nav.signIn') }}
        />
        <Stack.Screen
          name="Shortcuts"
          component={ShortcutsScreen}
          options={{ headerShown: true, title: t('editor.keyboardShortcuts') }}
        />
        {/*
          Where to find music to open. More useful on a phone than on the web,
          not less: a new install has no folder of scores already on the device.
        */}
        <Stack.Screen
          name="Resources"
          component={ResourcesScreen}
          options={{ headerShown: true, title: t('nav.resources') }}
        />
        {/*
          What the product is. The web says it on a landing page a visitor
          arrives at; somebody who installed an app already chose it, so this is
          reachable rather than in the way.
        */}
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{ headerShown: true, title: t('about.title') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
