/**
 * The desktop menu bar (macOS and Windows), as events.
 *
 * Every command a desktop window offers instead of the on-screen title bar:
 * File's New/Open/Save/Save As/Print/Snapshots, Import and Export, and Edit's
 * Undo/Redo, plus the two navigation commands (Projects, Settings) a phone
 * reaches from the title bar and a desktop window reaches from a menu. `Print`
 * and `Snapshots` were AppKit's own unwired template items (`print:` on the
 * first responder, and nothing at all) until they had selectors of their own —
 * the same problem `file.new` and its siblings had: AppKit disables an item
 * whose selector nobody in the responder chain implements, and this is not an
 * `NSDocument` app, so nothing answered.
 *
 * Each platform owns its own menu — AppKit's storyboard on macOS, a `MenuBar`
 * in `MainPage.xaml` on Windows — and JavaScript owns what a command *does*, so
 * each platform's app shell answers a click and hands it to a small native
 * module named `MoosiacMenuBridge` (`AppDelegate.mm` on macOS,
 * `MenuBridgeModule` on Windows) that turns it into one JS event. This is the
 * JS end of that, and it does not care which native module answered — the two
 * are declared under the same RN module name for exactly that reason.
 *
 * Absent on every other platform, and that is the whole guard: iOS, Android
 * and the tests have no such module, `emitter` stays null, and subscribing is
 * a no-op rather than a crash. Nothing here should be conditional on
 * `Platform.OS` — the module's presence is the honest test, and it keeps
 * working if a third platform ever grows a menu bar.
 */
import { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { focusMainWindow } from '@/platform/projectsWindow';

export const MENU_COMMANDS = [
  'file.new',
  'file.open',
  'file.save',
  'file.saveAs',
  'file.print',
  'file.snapshots',
  'import.midi',
  'import.musicxml',
  'import.tracker',
  'import.audio',
  'export.midi',
  'export.musicxml',
  'export.xm',
  'export.wav',
  'export.mp3',
  'edit.undo',
  'edit.redo',
  'nav.projects',
  'nav.settings',
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
        if (!command) return;
        /*
          Every command here acts on, or navigates within, the main window —
          except `nav.projects`, which deliberately shows a *different* one
          instead (`showProjectsWindow`, called by whichever listener
          actually handles that command). Without this, the main window can
          be sitting hidden behind the desktop Projects window (true at
          launch, and after however long a reader spends in it) and a
          command that changes it — File ▸ New's sheet, an import landing in
          the document list, Cmd+Z — would do exactly what it says and be
          seen by nobody. Safe to call from every `useMenuCommand` consumer
          that receives this same event: bringing an already-front window
          forward again is a no-op, not a second effect.
        */
        if (command !== 'nav.projects') focusMainWindow();
        ref.current(command as MenuCommand);
      },
    );
    return () => sub.remove();
  }, []);
}
