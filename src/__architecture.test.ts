/**
 * This repo holds UI and arrangement, and nothing else.
 *
 * `music_app` has the same guard, for the reason it exists there: the rule is
 * remembered right up until somebody writes score maths in a component because
 * it was quicker than opening another repo. A guard turns that into a failing
 * test rather than a slow drift, and the `ALLOWED_NON_UI` list makes every
 * exemption a decision somebody wrote down.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC).map(f => relative(join(SRC, '..'), f));
const sources = files.filter(
  f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
);

/**
 * Plain `.ts` modules that are legitimately not components.
 *
 * Each is here because it is *arrangement* — wiring, platform glue or the
 * app's own document, none of which is a rule about music.
 */
const ALLOWED_NON_UI = new Set([
  // The composition root: it constructs platform services rather than
  // implementing them, which is exactly this repo's job.
  'src/config/initialize.ts',
  // Reading the bundled instrument packs off disk. Platform glue, and
  // deliberately not the player's business: `music_player` exposes a
  // `fetchPack` seam exactly so it never has to know where an app keeps its
  // bundle, which differs per platform (APK assets on Android, the bundle
  // directory on iOS and macOS) and per app. It holds no rule about music —
  // only a file name and two ways to read it.
  'src/config/soundfont-packs.ts',
  // The macOS menu bar, as events. Platform glue in the same sense as the
  // line above: it holds no rule about music, only a subscription to a
  // native module. It cannot move to a library either — the module it
  // listens to is declared in this app's own `AppDelegate.mm`, so there is
  // no other package that could own it.
  'src/app/menu-commands.ts',
  // Printing. `print-plan.ts` is the pagination decisions, which need no
  // renderer and are testable under node; `print-pages.ts` draws them with
  // Skia; `print-service.ts` hands the images to the platform. All three are
  // arrangement over `music_drawing`, which owns every rule about what a
  // printed page is.
  'src/features/print/print-plan.ts',
  'src/features/print/print-pages.ts',
  'src/features/print/print-service.ts',
  // Where a project document's bytes go. A sibling of `document-storage.ts`:
  // the same document model over a different destination, and the rules about
  // `serverUpdatedAt` are about *this* server rather than about music.
  'src/documents/project-sync.ts',
  // The colour scheme, remembered. The *choice* is the editing store's; making
  // it survive a relaunch is a property of the device.
  'src/config/theme-preference.ts',
  // The file panels. A picker is a platform control, and which one exists is
  // a property of the OS rather than of the music — so this is exactly the
  // kind of thing a library must not contain, and the `.macos` variant beside
  // it is why it cannot be one function.
  'src/documents/file-picker.ts',
  'src/documents/file-picker.macos.ts',
  // Build-time configuration and the server gateway: what this build points
  // at, constructed rather than implemented.
  'src/config/constants.ts',
  'src/config/server.ts',
  // The design theme: which @sudobility/design theme is active, and the CSS
  // variables NativeWind resolves semantic classes against. Presentation
  // configuration, and it must match the web app's.
  'src/config/designTheme.ts',
  'src/config/themeVars.ts',
  // Bundled translations and the copy the libraries deliberately do not carry.
  'src/i18n/index.ts',
  'src/i18n/lib-copy.ts',
  // The app's own document — a score plus a file it came from. The score model
  // is music_types'; none of this is about music.
  'src/documents/document.ts',
  'src/documents/document-list.ts',
  'src/documents/document-file.ts',
  'src/documents/document-storage.ts',
  // The one platform-bound file in the document layer.
  'src/documents/rn-storage.ts',
  'src/documents/rn-key-value.ts',
  // Which format a document goes out as, and what the file is called. Every
  // export is one call on music_io; none of the encoding is here.
  'src/documents/export.ts',
  // Which format a document comes from, and that an import makes a new
  // document rather than editing the open one. The decoding is music_io's.
  'src/documents/import.ts',
  // When a document gets written without being asked. Debounce and failure
  // policy, not anything about music.
  'src/documents/autosave.ts',
  // Whether closing would lose work. A decision, deliberately without a dialog
  // attached, so one rule serves a tab, a window and a quit.
  'src/documents/unsaved-guard.ts',
  // Geometry that turns a touch into a place in the score. It reads a
  // LayoutPlan, which is music_drawing's, but every question it answers is
  // about a pointer — the same split music_app makes for its hit tests.
  'src/features/score/hit-test.ts',
  // Which keys count as one chord — a rule about overlapping touches, and the
  // one part of the keyboard panel worth testing without a renderer.
  'src/features/piano-keyboard/key-group.ts',
  // The recent-documents list: ordering, a cap, and a handle that is a
  // security-scoped bookmark on sandboxed macOS. App state, not music.
  'src/documents/recent-documents.ts',
]);

describe('music_app_rn holds UI only', () => {
  it('has no plain logic module outside the allowed list', () => {
    const stray = sources
      .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
      .filter(f => !ALLOWED_NON_UI.has(f))
      // A hook is UI: it exists to bind a component to something.
      .filter(f => !/\/use[A-Z]/.test(f));
    expect(
      stray,
      'A plain .ts module here is either UI, or it belongs in a library. ' +
        'Add it to ALLOWED_NON_UI with the reason if it is genuinely neither.',
    ).toEqual([]);
  });

  it('never reaches past the libraries to a rendering engine', () => {
    // VexFlow is music_drawing's business. Importing it here would put layout
    // in two places, and they would disagree the first time either was tuned.
    const offenders = sources.filter(f =>
      /from '(vexflow|@sudobility\/music_codecs)'/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('lets the libraries decide their own platform', () => {
    // The `react-native` export condition picks the RN build of music_io and
    // music_player. Importing `/web` or `/rn` explicitly bypasses that and is
    // how a web build ends up in a phone bundle.
    const offenders = sources.filter(f =>
      /@sudobility\/music_(io|player)\/(web|rn)'/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
