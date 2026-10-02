/**
 * Store-screenshot links: `moosiac:///<lang>/<screen>?<options>`.
 *
 * `app_store/scripts/capture.sh` drives a running app with one link per
 * screenshot — `paths.json` holds the `/<screen>?<options>` half, and the
 * script puts the language in front. Every option a screenshot depends on is
 * stated in the link rather than left to whatever the previous link did, so a
 * shot comes out the same whichever came before it: an editor link that does
 * not ask for the keyboard hides it, one that does not ask for a sheet closes
 * whatever sheet was open.
 *
 * - `moosiac:///<lang>/` — the language alone. The script sends it before a
 *   language's shots.
 * - `moosiac:///<lang>/editor?…` — the editor:
 *   - `demo=1` opens the bundled demo score (`demo-score.ts`) rather than
 *     whatever document is in front;
 *   - `keyboard=1` shows the piano keyboard, and anything else hides it;
 *   - `spatial=1` swaps the notation for the Spatial 3D stage;
 *   - `play=1` starts playback, and anything else stops it;
 *   - `track=<n>` selects the n-th track, counting from 1;
 *   - `sheet=` opens `print` (on the selected track's part, when one is
 *     selected), `generate-track` or `create-snapshot`.
 * - `moosiac:///<lang>/projects/new?generate=1` — New Project, with
 *   Generate switched on by `generate=1`.
 *
 * Plain TypeScript, so vitest can hold the grammar down; acting on a link
 * is `ScreenshotLinks.tsx`'s. A link that is not one of these answers null and
 * is left to `open-links.ts`, which owns `moosiac://open`.
 */

export const SCREENSHOT_SHEETS = [
  'print',
  'generate-track',
  'create-snapshot',
] as const;

export type ScreenshotSheet = (typeof SCREENSHOT_SHEETS)[number];

export type ScreenshotScene =
  | {
      screen: 'editor';
      demo: boolean;
      keyboard: boolean;
      spatial: boolean;
      play: boolean;
      /** 1-based; null selects nothing. */
      track: number | null;
      sheet: ScreenshotSheet | null;
    }
  | { screen: 'new-project'; generate: boolean };

export type ScreenshotLink = {
  /** A BCP 47 tag, as given. Which language it resolves to is i18n's call. */
  language: string;
  /** Null for a link that only switches the language. */
  scene: ScreenshotScene | null;
};

const LINK = /^moosiac:\/\/\/([^/?#]+)\/?([^?#]*)(?:\?([^#]*))?$/i;
const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

function paramsOf(query: string | undefined): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of (query ?? '').split('&')) {
    if (!pair) continue;
    const [key = '', value = ''] = pair.split('=');
    try {
      params.set(
        decodeURIComponent(key),
        decodeURIComponent(value.replace(/\+/g, '%20')),
      );
    } catch {
      // A malformed escape is a malformed option, not a malformed link.
    }
  }
  return params;
}

const flag = (params: Map<string, string>, key: string): boolean =>
  params.get(key) === '1' || params.get(key) === 'true';

function trackOf(params: Map<string, string>): number | null {
  const raw = params.get('track');
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const track = Number(raw);
  return track >= 1 ? track : null;
}

function sheetOf(params: Map<string, string>): ScreenshotSheet | null {
  const raw = params.get('sheet');
  return (SCREENSHOT_SHEETS as readonly string[]).includes(raw ?? '')
    ? (raw as ScreenshotSheet)
    : null;
}

/** What a screenshot link asks for, or null when the URL is not one. */
export function parseScreenshotLink(url: string): ScreenshotLink | null {
  const match = LINK.exec(url.trim());
  if (!match) return null;
  const [, language = '', rawPath = '', query] = match;
  if (!LANGUAGE.test(language)) return null;
  const path = rawPath.replace(/\/+$/, '');
  const params = paramsOf(query);

  if (path === '') return { language, scene: null };
  if (path === 'editor') {
    return {
      language,
      scene: {
        screen: 'editor',
        demo: flag(params, 'demo'),
        keyboard: flag(params, 'keyboard'),
        spatial: flag(params, 'spatial'),
        play: flag(params, 'play'),
        track: trackOf(params),
        sheet: sheetOf(params),
      },
    };
  }
  if (path === 'projects/new') {
    return {
      language,
      scene: { screen: 'new-project', generate: flag(params, 'generate') },
    };
  }
  return null;
}
