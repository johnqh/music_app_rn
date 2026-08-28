# Feature parity: music_app_rn against music_app

Reviewed from the two codebases rather than from memory — the web toolbar's
wired actions, its inspector fields, its routes and its dialogs, each checked
against the native tree.

**At parity, with two named exceptions.** A score can be opened, imported,
edited, heard, printed, exported and saved; every screen the web app has exists
here; and the server half — projects, generation, snapshots and publishing —
works. What is left is listed under *Not implemented*, and neither entry is a
platform gap: one is a web-only convenience, and the other is a limit of the
model that both apps share.

## Implemented

**Editing** — multi-document with one `createEditingStore()` each and
independent undo; notation through `music_drawing`'s renderer on Skia, windowed,
in page or continuous layout at any zoom; an interpolated playback caret;
tap-to-place-caret and tap-to-write in note-input mode; a toolbar of track
visibility, six note values with dotted and triplet, five accidentals, five
articulations, ornaments, edit modes, tie, slur, crescendo, diminuendo,
arpeggiate, beam break, beam none, fermata, glissando, insert note, insert rest,
add and delete bar, select all, cut/copy/paste with the questions each has to
ask, quantize, zoom, layout mode, go to bar and lyric entry; a four-tab
inspector including clef changes, repeats, voltas and the six repeat jumps; a
collapsible piano keyboard that auditions on press and writes through
`playKeyGroup` on release.

**Transport** — go to start, previous/next bar, play/pause, stop, loop,
metronome, speed, volume, scrubber, timecode, bar:beat.

**Print** — the platform's own print dialog on all three (`UIPrintInteractionController`,
`PrintManager`, `NSPrintOperation`), over pages drawn by the editor's renderer
into a Skia offscreen surface. See the note below: no PDF is involved, and the
pagination — including page turns that land where the player has bars free —
was already in `music_drawing`.

**Documents** — `.moosiac` with version refusal, open, save, debounced autosave,
unsaved-work guard; import of MIDI, MusicXML and tracker modules through a
platform file panel; export to MIDI, MusicXML, XM, WAV and MP3, with the tracker
fit report shown before anything is written.

**Server** — sign-in, the project list, opening a project, saving it back,
"Save to the server" for a local document; generation of a whole score, of one
more track matched to the open one, and all three Replace scopes, over the
shared job-polling hook; snapshots (create, publish, open a branch, rename what
is public, withdraw it); and the credit estimate on the Generate form.

A published title can change even though a snapshot's *music* never can, and
that is not an exception to immutability: the title is metadata about sharing.
Re-publishing is the server's own way of setting it, and the route keeps the
first `publicId`, so a link already shared survives a rename.

**Screens** — dashboard, sign-in, community, published view, documentation,
settings (including the theme and the developer toggles), credits and
shortcuts, over a native stack.

**Platform** — Swiss theme, English and Chinese, landscape lock on phones, and
macOS, iOS and Android builds.

## Not implemented

**A second lyric line — and it is not a parity gap.** `NoteEvent.lyric` holds
one syllable per note, so two verses under one melody cannot be written on
*either* platform. Closing it is a change to the shared model, not to this app:
`Lyric` would have to become a list (or gain a verse number), which touches
about forty references across music_types, music_codecs, music_drawing,
music_editing, music_app, music_app_rn and music_api — including the Zod schema
and, because `Score.version` exists, a migration for every score already stored
on disk and in Postgres. It is a feature to plan, not a gap to close, and doing
it in one app only would put that app *ahead* of the other, which is the
opposite of parity.

## Notes from this review

**A file picker is three controls, not one.** iOS and iPadOS raise a
`UIDocumentPickerViewController`, Android goes through the Storage Access
Framework, and macOS puts up an `NSOpenPanel` — and the community package
covers only the first two, declaring `:ios` in its podspec. The Mac half is
`native/file-picker`, a local autolinked module of about ten lines of AppKit.
On a sandboxed build that panel is not a convenience: it is where the
*permission* to read the file comes from.

**Printing needs no PDF writer, and I wrongly said it did.** Every one of the
three print services takes a *drawing* and produces the document itself:
`PrintedPdfDocument` hands back a `Canvas` on Android, `UIPrintInteractionController`
lays out page images on iOS, and `NSPrintOperation` calls `drawRect:` with a
print context on macOS. And the hard half was already built — `music_drawing`
has had `renderMode: 'print'`, `PRINT_INK`, `DEFAULT_PRINT_RENDER_THEME`,
paper sizes, margins, `usablePageHeight`, `paginate` and even `turnFreeBars`
(page turns that land where the player has bars free) since long before this.
So print is `native/print`, a module of about the same size as the file picker,
plus `print-plan.ts` (which systems land on which page — no renderer, testable
under node) and `print-pages.ts` (the same Skia renderer the editor uses,
drawing into an offscreen surface). `print-layout.ts` moved out of music_app
into music_drawing on the way, so both apps print from one set of decisions.

**The generation rules are the library's, not the app's.** Polling the
*project* rather than the job, comparing `updatedAt` strictly rather than for
difference, reloading before unlocking, and slowing the cadence when nothing is
running are all rules about *this server*, and every one of them is a bug
somebody hit. They moved into `@sudobility/music_client` as
`useProjectGeneration`, with the two things that genuinely differ by platform
passed in: the store, and how the app knows whether anybody is looking
(`document.hidden` on the web, `AppState` here). The web app's 56 generation
tests run against the shared hook unchanged.

**"It builds" is not "it runs", and that gap hid a launch crash.** Every
platform was verified by building until the app was actually installed on a
simulator — at which point iOS died on the first screen with *"Incompatible
React versions: react 19.1.4, react-native-renderer 19.1.0"*. Each React Native
ships a renderer bundle compiled against one exact React version and asserts it
at load, and `react-native@0.81.5` wanted 19.1.0 while `react-native-macos`
wanted 19.1.4 — so macOS ran perfectly and the other two could not start, which
reads like an iOS bug rather than a version one. Running Fabric does not avoid
it: `RendererImplementation.findNodeHandle` requires the **Paper** shim
unconditionally, so `Animated`'s native driver loads it and trips the assert.
The fix is the trio `react-native-macos@0.81.9` itself peers:
`react@19.1.4` + `react-native@0.81.6` + `react-native-macos@0.81.9`. The same
mismatch had already shown up as a jest failure and been stubbed around as
"test-only"; it was the bug reporting itself.

**One pre-existing test was flaky, not broken.** music_drawing's "keeps the
cache bounded while scrolling through a long score" renders every system of a
600-measure score — which is the point of it — and sat just inside vitest's
five-second default. It failed whenever the machine was busy building, which is
the worst kind of failure: it looks like a regression, it is not reproducible,
and a suite that cries wolf is one people stop reading. It now declares the
timeout it actually needs.

**Component tests needed their own runner.** The plain-TypeScript half of this
repo runs under vitest in `node`, which is fast and has no React Native in it at
all. Rendering a component needs the babel transform for React Native's
Flow-typed source, which only jest's React Native preset has. The two live
side by side, split by extension: `*.test.ts` is vitest's, `*.test.tsx` is
jest's.

**Two macOS build flags belong in the Podfile, not in a shell.**
`react-native-audio-api` ships prebuilt Ogg/Vorbis/Opus libraries whose macOS
slices are built for **macCatalyst**, and vendors its FFmpeg xcframeworks under
`s.ios` only — so on macOS the first fails to link and the second compiles with
nothing to link against. Both are switched off with environment variables the
podspec reads, and those are now set at the top of `macos/Podfile`: passing them
to one `pod install` by hand leaves the next one producing a project that does
not link, with an error nobody can place.

**A project-level `platforms` entry replaces a package's rather than adding to
it.** Listing `@moosiac/file-picker` in `react-native.config.js` with
`platforms: { ios: null, android: null }` wiped the `macos` entry the package
declares for itself, and it vanished from autolinking entirely — the pod was
simply never installed, with no error anywhere. A package that declares its own
platforms needs no entry in the app's config.

## Dead code found by earlier reviews

Code that cannot run is worse than code that is missing, because it reads as
done. All three are now reached:

- `documents/recent-documents.ts` — `noteOpened` was never called, so the list
  was always empty. `useRecentTracking` records every open and save, and
  `saveDocument` reports only *after* the write, since a file that failed to
  save is not one worth offering to reopen.
- `features/documents/RecentDocuments.tsx` — was never rendered. It is the
  editor's empty state.
- `documents/import.ts` — had no caller, because no file picker was installed.
  `ImportButtons` in the empty state is the entry point, over the picker seam
  described above.
