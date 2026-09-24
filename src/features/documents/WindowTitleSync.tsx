/**
 * The desktop window's title, kept in step with the active document.
 *
 * `Moosiac - Music1` — the app name and the document actually being edited,
 * the same pairing a browser tab or any other desktop document window shows.
 * `applyWindowTitle` is a no-op off macOS and Windows, so mounting this
 * everywhere else costs nothing.
 *
 * Reactive, not a one-off call at start-up: switching tabs and opening a
 * project both change which document's `title` is on screen, and now that
 * neither desktop platform's own title bar shows the document name any more
 * (`AppLayout`'s `hasMenuBar()` gate), the OS window title is the only place
 * left that does.
 *
 * Mounted once, beside `MenuFileCommands`, rather than inside the editor
 * screen: the active document does not stop being "active" when the reader
 * is on Settings or the dashboard, and the window bar should not blank out
 * or freeze on a stale project name just because the editor unmounted.
 */
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { CONSTANTS } from '@/config/constants';
import { applyWindowTitle } from '@/platform/windowTitle';
import { useActiveDocument } from '@/documents/DocumentsContext';
import type { MusicDocument } from '@/documents/document';

export function WindowTitleSync() {
  const document = useActiveDocument();
  // Nothing below this may be a conditional hook, so the store-reading half
  // is its own component, mounted only once there is a document to read.
  return document ? <SyncTitleFor document={document} /> : null;
}

function SyncTitleFor({ document }: { document: MusicDocument }) {
  const title = useStore(document.store, s => s.title);
  useEffect(() => {
    applyWindowTitle(`${CONSTANTS.APP_NAME} - ${title}`);
  }, [title]);
  return null;
}
