/**
 * Whether the navigator's header carries the editor's title bar here.
 *
 * It does wherever the editor is pushed above the tabs, which is every
 * platform: the document's name, its save state and the title bar's buttons
 * are handed to the navigator (`useEditorHeader`) rather than drawn in the
 * screen's body, beside the way back to the tabs. On iOS and Android the
 * header is the platform's own bar — a `UINavigationBar`, the top app bar —
 * and on macOS and Windows it is the JS stack's, drawn in the window.
 *
 * A module of its own so that `AppLayout` can ask without importing the
 * navigators.
 */
import { Platform } from 'react-native';

const HEADER_PLATFORMS = new Set(['ios', 'android', 'macos', 'windows']);

export function hasNativeHeader(): boolean {
  return HEADER_PLATFORMS.has(Platform.OS);
}
