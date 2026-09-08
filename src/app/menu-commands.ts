/**
 * The macOS File menu, as events.
 *
 * New, Open, Save and Save As are here alongside Import and Export. All four
 * were greyed out until they had selectors of their own: AppKit disables a menu
 * item whose selector nobody in the responder chain implements, and this is not
 * an `NSDocument` app, so `newDocument:` and its siblings answered to nothing.
 *
 * AppKit owns the menu and JavaScript owns the importers, so the app delegate
 * answers each item's selector and posts a notification that a small native
 * module (`MoosiacMenuBridge`, declared in `AppDelegate.mm`) turns into a JS
 * event. This is the JS end of that.
 *
 * Absent on every other platform, and that is the whole guard: iOS, Android
 * and the tests have no such module, `emitter` stays null, and subscribing is
 * a no-op rather than a crash. Nothing here should be conditional on
 * `Platform.OS` — the module's presence is the honest test, and it keeps
 * working if a second platform ever grows a menu bar.
 */
import { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';

export const MENU_COMMANDS = [
  'file.new',
  'file.open',
  'file.save',
  'file.saveAs',
  'import.midi',
  'import.musicxml',
  'import.tracker',
  'import.audio',
  'export.midi',
  'export.musicxml',
  'export.xm',
  'export.wav',
  'export.mp3',
] as const;

export type MenuCommand = (typeof MENU_COMMANDS)[number];

const bridge = NativeModules.MoosiacMenuBridge as
  | Record<string, unknown>
  | undefined;

const emitter = bridge ? new NativeEventEmitter(bridge as never) : null;

/** Whether this platform has a menu bar wired up at all. */
export function hasMenuBar(): boolean {
  return emitter !== null;
}

/**
 * Calls `handler` when a File-menu item fires.
 *
 * The handler is held in a ref so a caller needn't memoize it: an inline arrow
 * would otherwise resubscribe on every render, and a menu command that landed
 * mid-resubscribe would be dropped.
 */
export function useMenuCommand(handler: (command: MenuCommand) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!emitter) return;
    const sub = emitter.addListener(
      'menuCommand',
      (event: { command?: string }) => {
        const command = event?.command;
        if (command) ref.current(command as MenuCommand);
      },
    );
    return () => sub.remove();
  }, []);
}
