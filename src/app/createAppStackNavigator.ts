/**
 * The one place that decides native-stack vs. plain-stack, for every
 * navigator in the app — the main window's (`Navigation.tsx`) and the
 * desktop Projects window's (`ProjectsWindow.tsx`) alike.
 *
 * `react-native-screens`' podspec declares only `ios`/`tvos`/`visionos` — no
 * macOS platform at all — so `createNativeStackNavigator`'s native
 * presentation layer silently does not exist there: the navigation *state*
 * changes but no screen ever visually swaps. `@react-navigation/stack` is a
 * plain JS/Animated stack with no native-screens dependency, so it has
 * nothing to be missing on macOS; Windows gets it too, since its own
 * screens support is equally unproven here (no Windows machine to verify
 * against). iOS and Android keep the native stack, where `react-native-
 * screens` is the mature, intended implementation. See `Navigation.tsx`'s
 * original comment (now here) for the measurement that found this.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';
import type { ParamListBase } from '@react-navigation/native';

const isDesktop = Platform.OS === 'macos' || Platform.OS === 'windows';

export function createAppStackNavigator<ParamList extends ParamListBase>() {
  return isDesktop
    ? createStackNavigator<ParamList>()
    : createNativeStackNavigator<ParamList>();
}
