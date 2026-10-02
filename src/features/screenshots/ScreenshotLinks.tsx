/**
 * Acts on store-screenshot links (`screenshot-links.ts`): sets the language,
 * opens the demo score, goes to the screen and publishes the scene the
 * screens then draw (`screenshot-scene.ts`).
 *
 * Mounted in debug builds only (`App.tsx`). `capture.sh` installs a debug
 * build, and a link that changes the language, opens a document and starts
 * playing is not something a released app should do for whatever program
 * sends it one.
 *
 * Renders nothing; mounted beside `MenuFileCommands` for the same reason that
 * is — it acts on documents and the navigator, not on any one screen.
 */
import { useCallback } from 'react';
import {
  authorizedServer,
  hasServer,
  projectScoreForServer,
} from '@sudobility/music_lib';
import type { Score } from '@sudobility/music_types';
import { DEV_SIGN_IN } from '@/config/env';
import { getAppServices, libraryCopy } from '@/config/initialize';
import { devicePrefs } from '@/config/useDevicePrefs';
import { navigationRef, showEditor } from '@/app/Navigation';
import { goToTab } from '@/app/tab-bar';
import { useLinkUrls } from '@/app/useOpenLink';
import {
  useDocumentList,
  useDocumentServices,
} from '@/documents/DocumentsContext';
import { newDocument, openProjectInto } from '@/documents/document';
import type { DocumentList } from '@/documents/document-list';
import type { DocumentServices, MusicDocument } from '@/documents/document';
import { DEMO_TITLE, demoMusicXml } from './demo-score';
import { parseScreenshotLink } from './screenshot-links';
import type { ScreenshotLink } from './screenshot-links';
import { publishScene } from './screenshot-scene';

/** The demo document this process opened, reused by every later link. */
let demoId: string | null = null;

/**
 * Whether there is a server and an account to put the demo on. A debug build
 * signs in by itself at launch (`DevAutoSignIn`), which can still be in flight
 * when the first link lands, so this waits a few seconds for it — and not at
 * all where no test account is configured.
 */
async function signedIn(services: DocumentServices): Promise<boolean> {
  const { context } = services;
  if (!hasServer(context)) return false;
  const attempts = DEV_SIGN_IN ? 20 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if ((await context.getToken()) !== null) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

/**
 * The account's demo project, holding the demo score: created the first time,
 * and on every later launch found by name and its score put back to the demo,
 * so a capture run never starts from what the last one left behind — and an
 * account does not collect a new "Morning Light" per run. Its snapshots are
 * kept; they are what the Create Snapshot shot counts on from.
 */
async function demoProject(
  services: DocumentServices,
  score: Score,
): Promise<string> {
  const { client, token } = await authorizedServer(services.context);
  const serverScore = projectScoreForServer(score);
  const existing = (
    await client.listProjects(token, { search: DEMO_TITLE })
  ).find(project => project.name === DEMO_TITLE && project.status === 'ready');
  if (existing) {
    await client.updateProject(existing.id, { score: serverScore }, token);
    return existing.id;
  }
  const created = await client.createProject(
    {
      name: DEMO_TITLE,
      score: serverScore,
      origin: {
        kind: 'imported',
        format: 'musicxml',
        fileName: `${DEMO_TITLE}.musicxml`,
      },
    },
    token,
  );
  return created.id;
}

/**
 * The demo score, open and in front: a server project when signed in — what
 * Generate Track and snapshots need — and a local document otherwise, or when
 * the server cannot be reached.
 */
async function demoDocument(
  list: DocumentList,
  services: DocumentServices,
): Promise<MusicDocument> {
  const account = await signedIn(services);
  const open = list.openDocuments.find(document => document.id === demoId);
  // A local demo opened before the sign-in landed is replaced by the project.
  if (open && (!account || open.store.getState().origin.kind === 'project')) {
    list.activate(open.id);
    return open;
  }
  const { score } = await getAppServices().io.openMusicXml(
    demoMusicXml(),
    libraryCopy.musicXmlWarnings(),
  );
  if (account) {
    try {
      const document = await openProjectInto(
        list,
        services,
        await demoProject(services, score),
      );
      demoId = document.id;
      return document;
    } catch (error) {
      console.warn(
        'Demo project unavailable, using a local document:',
        error instanceof Error ? error.message : error,
      );
    }
  }
  const document = list.open(
    newDocument(services, { title: DEMO_TITLE, score }),
  );
  demoId = document.id;
  return document;
}

/**
 * Runs `navigate` once the navigator can take it. A link that launched the app
 * arrives before the navigation container has mounted.
 */
function whenNavigationReady(navigate: () => void, attempts = 50): void {
  if (navigationRef.isReady()) {
    navigate();
    return;
  }
  if (attempts > 0) {
    setTimeout(() => whenNavigationReady(navigate, attempts - 1), 100);
  }
}

export function ScreenshotLinks() {
  const list = useDocumentList();
  const services = useDocumentServices();

  const apply = useCallback(
    async ({ language, scene }: ScreenshotLink) => {
      const prefs = devicePrefs.getState();
      if (prefs.language !== language) prefs.setLanguage(language);
      if (!scene) return;

      if (scene.screen === 'new-project') {
        // The editor of the document in front closes its sheets and stops.
        publishScene(scene, list.active?.id ?? null);
        whenNavigationReady(() => goToTab(navigationRef, 'Dashboard'));
        return;
      }

      prefs.setKeyboardCollapsed(!scene.keyboard);
      const document = scene.demo
        ? await demoDocument(list, services)
        : list.active;
      publishScene(scene, document?.id ?? null);
      whenNavigationReady(showEditor);
    },
    [list, services],
  );

  useLinkUrls('screenshots', url => {
    const link = parseScreenshotLink(url);
    if (link) void apply(link);
  });

  return null;
}
