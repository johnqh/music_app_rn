# music_app_rn (Moosiac, native)

> **Git policy — never auto-commit or auto-push.** Leave your work in the
> working tree. Run `git commit`, `git push` or `gh pr create` **only when the
> user explicitly asks in that turn.**

The native Moosiac app: iOS, iPad, Android phone and tablet, and macOS.
**Windows is out of scope** — see `music_app/docs/rn-windows-findings.md` for
the research, which is parked rather than deleted.

Like `music_app`, this repo is **UI and arrangement only**. Every rule about
music lives in the libraries: `music_types` (the model), `music_editing`
(editing and its state), `music_lib` (application state, commands, adapters),
`music_drawing` (layout and the renderer), `music_player` (sound),
`music_io` (files), `music_client` (network). If you are about to write score
maths here, it belongs somewhere else.

## Commands

- `bun install` — dependencies (runs `patch-package` afterwards; see Patches)
- `bun run verify` — format, typecheck, lint, both test suites. Before any push.
- `bun run test` / `bun run test:watch` — vitest, the plain-TypeScript half
- `bun run test:components` — jest, the half that renders
- `bun run start` — Metro on port 8083
- `bun run ios` / `bun run android` / `bun run macos`

## What is different from the web app

- **The store is per document, not per app — and it is music_lib's.** A
  desktop edits several scores at once, and one app-wide store cannot hold two.
  Each document is `createDocumentStore` from music_lib: the web project's
  editing slices, saver and project write, composed per document, for either
  origin — a `.moo` file (written through `DocumentFileStorage`, which
  `rn-storage.ts` supplies) or a server project. `title`, `origin`, `dirty`,
  `saveState`, `serverUpdatedAt` and `lastGeneration` are **store state**.
  `src/documents/document.ts` adds only a tab id (`MusicDocument = { id, store }`)
  and the `DocumentServices` every store is built with. This app used to wrap a
  bare editing store with its own autosaver (`autosave.ts`), its own project
  calls (`project-sync.ts`), its own file format (`document-file.ts`) and its
  own close guard (`unsaved-guard.ts`); all four are deleted. The copy had
  drifted in the ways that lose work quietly: a write that raced an edit marked
  the document clean, and every project save PUT the whole score.
- **There is no auth gate.** A local file needs no account. `StoreContext`'s
  `client` and `getToken` are optional, and anything server-backed reports
  itself unavailable through `serverAvailable` rather than failing. Signing in
  adds server projects later; it does not gate what is already on disk.
- **Drawing is Skia, through the same renderer.** `createSkiaContext2D` turns an
  `SkCanvas` into the `DrawingContext2D` `music_drawing` wants — that one
  adapter is the whole of React Native support, and `CanvasScoreRenderer` runs
  unchanged. Drawing happens inside `createPicture`, so a scroll replays a
  recorded picture rather than re-running VexFlow.
- **The reader is shown a *bar*; the code keeps `Measure`.** The shared
  libraries already split it — `Measure` is the model type, `bar` is the number
  a reader is shown, which is why `barNumberAt` exists at all (a measure index
  is not a bar number, because a pickup has an index and no number). The copy
  used both words interchangeably inside single sentences in both apps. Keys
  keep the model's word: `inspector.replaceMeasures` reads "Replace Bars".
  Chinese needed no change — 小节 covers both.
- **The two apps' copy is pinned against each other from this side.**
  `cross-app-parity.test.ts` reads `music_app`'s locales off disk and holds 798
  shared keys to account. Only this direction: the web app's suite must not need
  a checkout of this one, and these tests skip rather than fail when the sibling
  is absent. Three checks. **Where the English agrees, the Chinese must agree
  too** — a key with identical English and different Chinese is a translation
  fork nobody decided, and six had accumulated. English differences live in
  `WORDED_DIFFERENTLY` with a reason each; a pointer tooltip and a touch hint
  may legitimately differ, and "measure" versus "bar" sits there marked
  **undecided**, because one product should have one word for a bar of music.
  And every `labelKey` music_types publishes must resolve in both apps and both
  languages: those lists carry a key rather than a word, so a host with no
  string for one prints the key — which is exactly what the web's ornament
  picker did, and what neither app's own parity test could see.
- **Translations are bundled, not fetched.** A locale that arrives over the
  network is a blank screen on a train. `locale-parity.test.ts` pins both
  halves: the same keys in both files, and every zh string actually containing
  CJK — key parity alone passes happily when English was copied across.

## Package boundaries

**Canvas geometry belongs to `music_drawing`; app layout geometry stays here.**
The line is the canvas edge. Anything that reasons about the *drawn score* —
where a note went, which measure or track a point lands in, what pitch a stave
position means, where the playing measure sits, the colours VexFlow draws with
— is `music_drawing`'s, because the canvas is what that package owns and
because two apps draw the same score. Anything that reasons about the app
*around* the canvas is this app's: a scroll container, a panel, a sheet.

That boundary is why tapping a note works here at all. It used to resolve only
to a *measure*, because the hit-testing lived in music_app and nothing on this
side could ask which note was under a finger — and because `ScoreView` built a
new renderer for every frame, throwing away the bounding boxes with it. One
renderer per view, and `hit-test` in the library, is what fixed it.

## Gotchas

- **Two test runners, split by extension.** `*.test.ts` is vitest's and runs
  under `node` with no React Native in it at all; `*.test.tsx` is jest's, with
  the React Native preset, because rendering a component needs the babel
  transform for React Native's Flow-typed source and vitest's esbuild pipeline
  does not have it. Three things in `jest.config.cjs` are load-bearing and each
  cost a debugging cycle. The **transform allow-list** must name every ESM-only
  dependency by hand (`immer`, `zustand`, `i18next`, every `@sudobility`
  package) *and* allow for bun's `.bun/<pkg>@<ver>/node_modules/<pkg>` layout,
  which the usual pattern misses. The **legacy Paper renderer is mapped to a
  stub**: its build asserts an exact React version and this app pins React to
  what react-native-macos requires, a patch ahead of what react-native's Paper
  build was compiled against — so merely *loading* it throws, which
  `Animated`'s native driver does through `RendererImplementation`. Nothing in
  the app reaches it (all three platforms run Fabric), so the stub removes a
  test-only path rather than hiding a real mismatch. And the **timeout is
  20s**, because starting i18next costs a couple of seconds the first time in a
  process and the failure it causes is a timeout with nothing wrong in the test. A
  fourth is `jest.mocks.cjs`, which exists for native modules that **throw at
  import** rather than degrading — `AsyncStorage` is one, so anything reaching
  `ThemeContext` (and through it anything asking what colour scheme is in
  force) fails to *load*, in a suite that has nothing to do with storage. The
  package ships its own in-memory mock; use it rather than stubbing methods.

- **React, react-native and react-native-macos are one locked trio, and getting
  it wrong crashes the app at launch.** `react@19.1.4`, `react-native@0.81.6`,
  `react-native-macos@0.81.9` — the combination `react-native-macos` itself
  peers. Each React Native ships a *renderer bundle compiled against one exact
  React version* and asserts it at load: 0.81.5's wanted 19.1.0 while
  react-native-macos wanted 19.1.4, so iOS and Android died on the first screen
  with **"Incompatible React versions: react: 19.1.4, react-native-renderer:
  19.1.0"** while macOS ran perfectly — a split that makes it look like an iOS
  bug rather than a version one. And it is not avoidable by "running Fabric":
  `RendererImplementation.findNodeHandle` requires the **Paper** shim
  unconditionally, with no Fabric branch, so anything reaching it — `Animated`
  with the native driver, for one — loads Paper and trips its assert. That is
  also why the jest config maps the Paper renderer to a stub; the two are the
  same root cause, and treating the test failure as test-only is what hid the
  runtime crash for a whole session. `react-versions.test.ts` now reads the
  literal each renderer asserts and compares it against the installed `react`,
  so the next mismatch fails a test instead of a launch — and the jest stub that
  used to hide it has been deleted, because a workaround for a fixed bug is a
  blindfold for its recurrence.

- **A `.test.tsx` using `jest.fn()` must `import { jest } from '@jest/globals'`,
  and forgetting it fails only in `typecheck`.** Jest injects the global at run
  time, so the suite passes; `tsc` sees the ambient *namespace* and reports
  `TS2708: Cannot use namespace 'jest' as a value` — which means `bun run test`
  is green and `bun run verify` is red, and the failure names a file whose tests
  all passed a moment earlier. Every existing test file here has the import;
  copy one when adding a file rather than starting from the web app's, where
  vitest's `vi` needs no such thing.
- **RNTL is pinned to v13, and that pin is about React.** v14 renders through
  `test-renderer`, whose `react-reconciler` is built for React **19.1.0**
  exactly, and this app is on 19.1.4 for react-native-macos. There is no
  stable 0.33.x reconciler for 19.1.4, so v14 cannot work here; v13 uses
  `react-test-renderer`, which *is* published at 19.1.4. The visible symptom of
  getting this wrong is an `AggregateError` from `render` with no cause in it.

- **Printing needs no PDF writer.** Every one of the three print services takes
  a *drawing* and produces the document itself: `PrintedPdfDocument` hands back
  a `Canvas` on Android, `UIPrintInteractionController` lays out page images on
  iOS, and `NSPrintOperation` calls `drawRect:` with a print context on macOS.
  So `print-pages.ts` renders each page into a Skia offscreen surface with the
  same renderer the editor draws with, and `native/print` hands the PNGs over.
  Everything about *what* a printed page is — page mode, one ink, no gutter, no
  editor state, paper sizes, margins, and page turns that land where the player
  has bars free — lives in `music_drawing` and is shared with the web app.
  Which score goes on paper (a part via `extractPart`, or the marked full
  score), which tracks, which systems per page and whose page turns is
  music_drawing's `printPlan`, the web print view's own call; `PrintSheet` asks
  scope, paper and orientation from `PAPER_OPTIONS`/`ORIENTATION_OPTIONS`. This
  app's own `print-plan.ts` is deleted.

- **A file picker is three controls.** iOS and iPadOS raise a
  `UIDocumentPickerViewController`, Android goes through the Storage Access
  Framework, and macOS puts up an `NSOpenPanel` — and
  `@react-native-documents/picker` declares `:ios` only, because there is no
  Mac equivalent of that class. The Mac half is `native/file-picker`, a local
  autolinked module of about ten lines of AppKit, selected by
  `file-picker.macos.ts`. On a sandboxed build the panel is not a convenience:
  it is where the *permission* to read the file comes from, which is why a path
  from anywhere else cannot be opened.

- **A project-level `platforms` entry replaces a package's own.** Listing
  `@moosiac/file-picker` in `react-native.config.js` with
  `platforms: { ios: null, android: null }` wiped the `macos` entry the package
  declares for itself, and it disappeared from autolinking entirely — the pod
  was never installed, with no error anywhere, because `loadConfig` swallows a
  failed dependency in a bare `catch`. A package that declares its own
  platforms needs no entry here; only add one to *remove* a platform it does
  declare. Diagnose with `bunx react-native config | grep <package>`.

  A second trap in the same file: `podspecPath` is **absolute** and
  `sourceDir` (Android) is **relative to the package root** — the Android
  resolver joins it onto the root itself, so an absolute path there resolves to
  nothing and the module is silently not linked. And `react-native config` from
  the project root is not the oracle for macOS: it reports `macos: null` for
  packages that macOS autolinking does install, because the macOS Podfile does
  its own `list_native_modules!`. Check `macos/Podfile.lock` instead.

- **Two macOS build flags live in `macos/Podfile`, not in a shell.**
  `react-native-audio-api` ships prebuilt Ogg/Vorbis/Opus libraries whose macOS
  slices are built for **macCatalyst**, and vendors its FFmpeg xcframeworks
  under `s.ios` only. `DISABLE_AUDIOAPI_STATIC_EXTERNAL_LIBS=1` fixes the
  first; without `DISABLE_AUDIOAPI_FFMPEG=1` as well it merely swaps one link
  error (*"built for 'macCatalyst'"*) for another (*"_swr_init … symbol(s) not
  found"*), which reads like the fix regressing. Passing them to one
  `pod install` by hand leaves the next one producing a project that does not
  link.

- **The generation rules are `music_client`'s.** Polling the *project* rather
  than the job, comparing `updatedAt` strictly rather than for difference,
  reloading before unlocking, and slowing the cadence when nothing is running
  are rules about *this server*, and both apps obey them — so
  `useProjectGeneration` lives there and `useDocumentGeneration` here supplies
  only what differs: the per-document store, the client, a `flush` (the
  store's `saveNow`), and a `ForegroundPort` over `AppState` where the web app
  passes one over `document.hidden`. After a job lands the editor calls the
  store's `reloadFromServer(player)`, which stops the transport before it
  adopts.

- **`advanceCaret` defaults to false.** `insertNoteAtCaret` leaves the caret
  where it is unless told otherwise, so a run of taps writes every note at the
  same tick. The piano-keyboard and tap-to-note paths in music_editing pass
  `true`; so must any note-entry UI here. A test pins it.
- **Multi-codepoint musical characters do not render, and the fix is that the
  glyphs are data now.** `𝅝`, `𝄽`, `𝆔` and `𝄐` are outside the system font's
  coverage and draw as `?` boxes, where the single-codepoint `♩`, `♪`, `♭`, `♯`
  and `♮` are fine. So no notation mark is a character: `NOTATION_ICONS` in
  music_types holds every one of them as shapes, `NotationIcon.tsx` replays
  them with `react-native-svg`, and the web toolbar replays the same table —
  a semiquaver here *is* the web's semiquaver rather than a lookalike. Reach
  for `NotationIcon` before reaching for a character; if a mark is missing from
  the table, add it there (authored in `music_app`'s `notation-icons.tsx` and
  generated, see that repo's CLAUDE.md) rather than finding a codepoint.
- **A notation glyph's colour is passed, and it must come from the theme.**
  `currentColor` is an SVG idea `react-native-svg` does not resolve, so every
  `NotationIcon` is handed a literal colour — which is exactly the thing that
  cannot follow light/dark. The toolbar hardcoded `#18181b`, so every drawn
  glyph on the editing bar vanished in dark mode while the heroicons beside
  them, tinted through `className`, did not. `useNotationInk()` resolves
  `foreground` / `primaryForeground` / `mutedForeground` from the same
  `swissTheme` tokens `themeVars.ts` applies, so there is one statement of what
  "foreground" is rather than a hex copy of it. Never write a hex for a glyph.
- **The editing bar and the playback bar are the web app's, control for
  control** — same groups, same order, same dividers, same glyphs, same
  availability rules. They are one product, and a native bar that offers a
  different set of tools is a different app wearing the same name. Two things
  about that are load-bearing. **Several choices are a picker, not a row of
  chips**: six note values, five accidentals, five articulations, five
  ornaments and four quantize grids came to twenty-five chips and a bar three
  screens wide, where the web's fits one — each is a `ToolbarSelect` with one
  glyph on the trigger and the words in the sheet, which is what the web's
  `Select` does and for the same reason (five near-identical marks are
  unreadable as a row of 18px glyphs). No library select can be used for this:
  `Select`, `PopupSelect` and `SheetSelector` each draw their own bordered text
  trigger and none accepts one, so only the sheet is ours. And **zoom, layout,
  pitch display and the inspector toggle sit outside the scroller**, pinned
  right: they change how you look at the score rather than the score itself,
  and inside the scroller they are the first thing to go past the edge —
  reachable only by scrolling the whole bar past every tool on it.
- **Availability is the other half of copying the bar.** Eleven controls act on
  the selection and quietly return when it is empty; leaving them live is a
  control that invites a tap and gives no feedback, which is worse than one
  plainly unavailable. The rules are music_editing's `selectToolbarAvailability`, which the web
  bar reads too, and the multi-call controls are the library's as well:
  `insertDefaultNoteAtCaret`, `quantizeSelectionToGrid`,
  `EDITOR_MORE_ACTIONS`/`runMoreAction`, `addTrackChoices`/`runAddTrackChoice`,
  `EDIT_MODE_OPTIONS` with `selectEffectiveEditMode`/`editModeHintKey`. The
  stored edit mode is still corrected from an effect, because the library's
  write paths (`insertNoteAtCaret`, `paste`) read the *stored* mode — the web
  toolbar keeps the same effect. Go to bar passes the typed text to
  `goToBarFromInput`, which counts bars as drawn (a pickup has no number). Fix
  all's toast and whether the issues list closes are `repairIssuesOutcome`'s.
- **Volume and pan are painted here, not taken from the library.**
  `components-rn`'s `Slider` fills over a `bg-muted` groove, which against
  these surfaces is very nearly the background — a quiet track reads as a short
  bar floating in space with nothing to say how much further it goes. The web
  app rejected its own library slider for exactly this and paints
  `bg-border` instead; `components/controls/LevelSlider.tsx` is that drawing,
  with the web's geometry restated in numbers because NativeWind cannot express
  `::-webkit-slider-thumb`. **Pan is drawn as a position, not an amount**:
  square bed, centre detent, fill growing out of the middle, an 8×16 slotted
  knob instead of a bead, and a `C`/`L40`/`R25` readout — a bar growing from
  the left says "40% of maximum pan", which is not a thing. Both rows come from
  `features/tracks/MixerSliders.tsx` and each owns its whole row, label column
  and all, because they sit directly above one another and any difference
  between them reads as a mistake. The **gesture takes its origin on grant**
  (`pageX - locationX`) and measures the drag against it; the library slider
  uses `gesture.moveX` raw, which is a screen coordinate and correct only for a
  track whose left edge is the window's.
- **The tempo field is the one control on the playback bar that edits the
  score.** Loop, metronome, speed, volume and seeking are real-time device
  control and go to the player; BPM is persisted with the music and goes
  through music_editing's `commitOpeningTempoText` (blank is no change;
  rounded and clamped), which is why `TransportBar` takes the document's
  store as well as its score. Whole numbers only, and a non-numeric draft is
  refused rather than committed — a score with a `NaN` tempo has no tempo at
  all.
- **Every other transport control goes through `usePlayerBinding`**
  (music_editing's `bindPlayer`), which writes loop, metronome, speed, volume
  and `synthLoad` into the document store and mirrors the transport state there
  — which is what makes the edit lock during playback real on this app. The bar
  reads those values back from the store. A `PlayerFailure` becomes a toast
  worded with `libraryMessage`, as music_lib's adapter does. `useTransport.ts`,
  the binder this app wrote for itself, is deleted; loop now follows the web
  rule (the selection when there is one, else the whole score).
- **The property sheet is the web inspector's, tab for tab** — and the two
  ways it had quietly drifted are both the kind that look fine on screen.
  **A percussion track's `midiProgram` addresses a kit, not an instrument**, so
  the Track tab offering `INSTRUMENT_OPTIONS` on every track named a drum part
  after whatever instrument shared its number (Brush is kit 40; program 40 is
  Violin). It asks `isPercussionTrack` and offers `KIT_OPTIONS` instead — the
  same split the web makes, and the reason `setTrackInstrument` takes the
  catalogue *value* rather than a number. And the Note tab **printed a literal
  `1` for every note's voice**, which is right by coincidence on the default
  track and wrong the moment anybody uses the second; it reads `voiceNumberOf`
  now. Fields that were simply absent — octave, velocity, the tie toggles, the
  slide span, the grace-note conversion, the bar/beat readout, the track
  readout, the clef, the key and time signatures, Delete Track — are there too.
- **Every inspector field answers for the whole selection, via `commonValue`.**
  Where the selected notes agree it shows the value; where they do not it reads
  "Mixed" and setting it applies to all of them. A panel that showed the *first*
  note's value would say "Staccato" for a selection that is mostly not, and
  setting it would look like a no-op on the notes that already agreed.
- **Pitch is edited through the display lens and never round-tripped.** The
  step, accidental and octave a reader sees on a transposing instrument or
  inside an `8va` are not what is stored, so a patch is applied to what is
  *shown* and converted once by `setNotePitch`. Feeding the stored pitch back
  through the lens moves it by the transposition every time the panel is
  touched — silently, since the note then draws exactly where it was.
- **Replace lives on the property sheet's tabs, not on the toolbar.** The scope
  *is* the tab: Replace Notes beside the note you selected, Replace Measures
  beside the bars, Replace Track beside the part. On a toolbar all three are
  equally far from the thing they act on and the reader has to work out which
  region each one means from its name. It briefly sat in the toolbar's More
  menu here; the web has always put it in the tabs.
- **Cut, copy, paste, clear and delete live on the long-press menu, not on the
  editing bar** — on both platforms. Four toolbar buttons that all act on
  something already selected and none of which can say *what*: Delete means a
  track going, a bar going and the score renumbering, or notes going and the
  ones behind shifting forward. `ScoreActionsSheet` opens **on the object** and
  names it first, in small grey type above the entries. The sheet draws
  music_editing's `scoreContextMenuModel` (bars counted by index, not id) and
  `AppLayout` performs entries with `runScoreContextAction`, which re-checks the
  edit lock at the moment an entry is chosen. **Clear joined them**, and it is a different edit rather than
  a softer Delete: a cleared bar keeps its number and its markings, a cleared
  track keeps its instrument and its mix.
- **A touch is classified, then routed by music_editing.** `ScrollingScore`
  hands the canvas's hit to `onPress(hit, pointTick)` or `onLongPress(hit)`
  and decides nothing else. It tells a tap from a long press from a drag with
  music_drawing's `classifyPress` (`pointer: 'touch'`), measuring movement in
  **page** coordinates, because the surface moves with the finger during a
  scroll — measured on the surface, a flick that came to rest over a note
  selected it. `AppLayout` passes a tap to `routeScorePress` (the web's click
  rules, with `pointTick` from `canvas.tickAt`, so a press on nothing is still
  reported), and a long press to `selectForContextMenu`, which keeps a
  selection the press lands inside and selects nothing on a bare stave. The old
  long press aimed the caret first, which cleared the selection the menu then
  opened to act on.
- **Lyric entry is music_editing's rules over watched text.** `beginLyricEntry`
  picks the notes and the start (null while playing); `LyricEntryBar` runs
  every input through `lyricEntryStep`/`applyLyricStep` and splits typed text
  with `splitLyricSeparator`, so a hyphen or space counts **anywhere** in the
  text, as the key does on the web; this bar used to honour one only at the end.
- **The inspector decides nothing.** What each field offers and commits is
  music_editing's `inspector.ts` (`commitBarTempo`,
  `setClefAtMeasure`/`measureClefOptions`, `canReplace`,
  `selectEditLocked`/`controlLocked`, `noteTextFieldsVisible`,
  `INSPECTOR_TABS`/`defaultInspectorTab`) and music_types' field values
  (`pickupBeatOptions`, `parse/formatEndingNumbers`, `durationFieldState`,
  `parseNumericDraft`, `clampVolume`/`clampPan`/`volumeReadout`). Number fields
  are `NumberDraftInput` drafts committed on blur — blank is no change, never 0
  — not `NumberInput`, which committed per keystroke and could not show Mixed.
  The Note, Bar and Score tabs lock while playing; only volume, pan, mute and
  solo stay live. A bar's clef, barline and navigation are resolved on the
  bar's **own** track: they used to be read from the active track and from
  track 1, so a bar selected on another part edited the wrong one.
- **Export is `planExport` over `WRITABLE_EXPORT_FORMATS`.** A project writes
  `<title>.moo` through `serializeProjectFile`, overriding the shared list's
  `json` extension by hand until the library says `moo`.
- **The status strip says what is selected — it is not a second place to read
  the track name.** It used to print the active track's name and a bar/track
  count, neither of which the web app shows and both of which the reader already
  had: the renderer paints the track's name into the gutter beside every system,
  in both apps. What was missing was the one thing a status strip is for.
  `selectionSummaryLabel` is music_types', so the two apps read a selection with
  the same function and differ only in the words. The web strip lost two
  readouts in the same pass, for the mirror-image reason: its bar/beat and zoom
  percentage repeated what the transport and the toolbar already say.
- **A refusal from the store has to reach the reader.** `setTrackInstrument`
  answers `outOfRange` rather than half-applying when the part is wider than the
  instrument can play, and the Track tab discarded the result — so a refused
  change looked exactly like one that happened. The Track tab sends it to `pushToast`, an error toast, as the web does. The same
  shape of bug was in the pickup field, which was a `Switch` that always wrote
  one beat: a three-beat anacrusis could be written on the web and not here, and
  a score that had one showed a toggle whose next touch would have shortened it.
- **The keyboard's show/hide control is the transport bar's rightmost button,
  and the keyboard draws nothing when collapsed.** It used to be a bar of the
  keyboard's own — a whole row for one button, and the control that *reveals*
  the keyboard sat inside the thing it reveals, so the row had to survive
  collapsing to stay reachable. The glyph is `PianoKeysIcon` from
  `NOTATION_ICONS`, so it is the same drawing the web toolbar shows: white,
  black, white, because three identical filled bars read as three black keys and
  a black key only ever sits *between* two whites. `KeyboardPanel` carries a
  `testID` because its keys are not drawn until it has been measured and a test
  renderer measures nothing — there is no key to point at when asserting where
  the panel sits.
- **The piano keyboard's range is the active track's instrument, not always all
  88.** `KeyboardPanel` passes no range at one point in its life and
  `PianoKeyboard` fell back to `FULL_RANGE`, so a piccolo part offered three
  octaves that could never sound and a drum kit offered a piano's compass. The
  range comes from `trackKeyboardSpan` (music_drawing, the web keyboard's own
  call), which takes a **`Track`** — asking `midiProgram` directly is the
  drum-kit bug again, since the drums that do sound (35-81) then sit partly off
  the end. It is the instrument's compass snapped to white keys, **widened to
  reach every note the track holds**: an import can hold notes the instrument
  cannot play, and those keys are drawn pale (`KEYBOARD_OUT_OF_RANGE_WHITE`)
  and `disabled`, so they show the notes without letting a person play more of
  them. Editing refuses the same notes through music_editing's
  `range-refusal.ts`.
- **MIDI asks before it imports; every other format does not.** A performance
  has no bar lines, no clefs and no key, and every one of those is a guess — a
  guess nobody was shown is a guess nobody can correct. `MidiImportSheet` opens
  pre-filled from `defaultMidiImportOptions`, so somebody who does not want to
  think about quantization presses Import and is done. A tracker module states
  every note and instrument outright and MusicXML carries its own notation, so
  both go straight in; asking there would be asking a question with one answer.
- **A 402 is not a network failure.** `POST /jobs` answers it at a balance of
  zero, and `useProjectGeneration`'s `onStartError` seam exists so that lands as
  the paywall rather than as a string in the generation overlay. Returning true
  marks it handled, which is what leaves the inline message empty — the sheet is
  the report (New Project decides the same through music_client's
  `classifyGenerationError`, and the gate itself is music_lib's
  `isOutOfCredits`), and showing both says the same thing twice in two registers.
  **Purchasing is deliberately not offered**: `consumables_pages` has no React
  Native build, so the sheet explains and points at the Credits screen rather
  than half-implementing a store. The *balance* needs none of that —
  `ConsumablesApiClient` takes a base URL and a network client and nothing else,
  which is why `useCreditBalance` can read it with no purchase SDK and no pods.
- **A component that renders must not reach for auth.** `NewProjectSheet`
  takes `outOfCredits` as a prop rather than looking it up, because looking it
  up means importing `AuthContext`, which imports Firebase — and that is how a
  form for choosing a key signature ends up unable to render in a test. The
  screen has the auth context; the sheet renders. The same rule is why
  `notation-ink.ts` is worth watching: anything it imports lands in every
  toolbar.
- **`@sudobility` packages need a `default` export condition, and two of them
  did not have one.** `di_rn` and `di` published `exports` maps with `import`
  and `types` only; jest resolves through CJS, falls through every condition and
  reports the package as **missing** — which surfaces as "Cannot find module
  '@sudobility/di_rn'" in a test that never mentions it. Both are fixed at the
  source (`types` first, `default` last, recursing into nested conditions like
  `react-native`). If a new `@sudobility` package ever reports itself missing
  under jest, check its exports map before the transform allow-list.
- **A horizontal `ScrollView` in a column needs `flexGrow: 0` and a height.**
  It has no intrinsic height and takes whatever it is offered, which puts an
  empty band above and below a toolbar.
- **A `className` must appear in the source as a complete literal.** Tailwind
  extracts classes by scanning text, so
  `` className={`flex-1 ${row ? 'flex-row' : ''}`} `` generates no `flex-row`
  utility — the class never appears whole in any file. It fails **silently and
  partially**: colours and borders keep working (those literals occur
  elsewhere), while layout classes vanish, and the score renders into a box of
  zero height. Write two complete strings and choose between them:
  `className={row ? 'min-h-0 flex-1 flex-row' : 'min-h-0 flex-1 flex-col'}`.
- **The design theme is Swiss, and it must match in four places.**
  `music_app`'s composition root calls `configureTheme(swissTheme)`; the two
  apps are one product, and a different palette on native would be a different
  product wearing the same name. On React Native that theme has to be stated in
  `tailwind.config.js`, `src/config/designTheme.ts`, `src/config/themeVars.ts`
  and `scripts/generate-theme-css.js` — NativeWind cannot switch CSS-variable
  blocks on native, so the variables are applied at runtime by
  `ThemeVarsProvider` with `vars()`. Change one alone and the utilities and the
  variables disagree.
- **The UI mirrors the web app's, through the same component library.** The
  layout order — title bar, score with the inspector beside it, transport,
  keyboard, status strip — is `music_app`'s `AppLayout`, and the pieces come
  from `@sudobility/components-rn`, the React Native port of the
  `@sudobility/components` the web app uses. Build UI from those rather than
  from bare `View`/`Pressable`: a hand-rolled control does not inherit the
  design tokens, so the two apps drift the first time the palette moves. If a
  component exists on the web and not in RN, port it into
  `mail_box_components_rn` rather than reimplementing it here.
- **Never size anything from `useWindowDimensions()`.** On macOS it reports the
  *display*, not the app's window — measured: a 1280pt window on a 3440pt
  screen laid the keyboard out at 3440 and clipped it, so the app showed three
  octaves of an eighty-eight-key keyboard and a score whose bars ran off the
  right edge. The same bug appears on iPad in Split View and in any resizable
  window. `useContainerSize()` measures the view with `onLayout`, which is the
  honest number everywhere and updates on resize.
- **A container that waits to be measured must state its own height.** If its
  size comes from a child that only renders once measured, it collapses to zero
  and never measures — the keyboard panel went blank exactly this way. State
  the height on the container, or render at a fallback size and let the first
  layout correct it.
- **Read the active track through `selectActiveTrackId`/`selectSelectedTrack`,
  never `state.activeTrackId` raw.** The selectors fall back to the first
  track, which is what makes "one track is always active" true with no
  reconciliation step. Reading it raw gives `null` on a fresh score, and the
  inspector then renders nothing at all.
- **Position must not be read high in the tree.** It arrives ~30 times a second;
  a component that re-renders on it re-renders the notation with it.
  `PositionReadout` subscribes on its own (through
  `features/transport/usePositionReadout.ts`, which renders only when the text
  changes), exactly as the web app's
  `MeasureBeatReadout` does. Keep new readouts isolated.
- **`bun add` reinstalls `node_modules` from the registry**, silently replacing
  any `@sudobility/*` build you rsynced in during cross-repo work. Re-sync after
  one, or the next typecheck fails on a symbol you just added upstream.
- **Phones are landscape-only; tablets are free.** On iOS that is declarative —
  `UISupportedInterfaceOrientations` is landscape and
  `UISupportedInterfaceOrientations~ipad` carries the full set — so the OS never
  animates into an orientation the app is about to reject. Android cannot ask
  "is this a tablet" from the manifest, so `MainActivity` reads
  `R.bool.lock_landscape`, which `values-sw600dp` overrides to false.
- **A failed save must leave the document dirty.** music_lib's saver clears
  `dirty` only after a write succeeds *and* the score written is still the one
  open; the reverse leaves a document that looks safe to close after the write
  failed. `documents/document.test.ts` pins it for this app's wiring.
- **A document from a newer format version is refused, not read hopefully.**
  A newer file may say something this build would drop, and losing half a score
  on the next save is worse than not opening it. The reader is music_codecs'
  `parseProjectFile` (through music_lib — this app may not import music_codecs
  directly), which also reads the web's JSON project export.
- **Every document store is built from `DocumentServices`, provided once.**
  The composition root (`App.tsx`) builds the server context (client, Firebase's
  `readIdToken` — module-level, because a store keeps the context it was built
  with for life and the scratch document exists before any provider), the file
  storage, the toast sink and an `onSaved` that feeds the recent list, and
  `DocumentsProvider` hands them down. Anything that makes a document —
  `newDocument`, `openFileInto`, `openProjectInto`, an import — takes them from
  `useDocumentServices()`. The old autosaver lived in the composition root where
  nothing below could reach it, so a document made from the File menu never
  saved itself.
- **`DocumentList` owns a document's lifetime, and its caret.** Opening attaches
  (the device-prefs mirror) and closing detaches and `dispose`s the store, so a
  closed tab keeps neither a subscription nor a debounce timer. A duplicate
  turned away by origin is disposed too. There is one playhead, and document
  stores are built with `resetPosition` false so opening one does not send the
  front tab's caret to bar 1 — the list banks the leaving tab's tick and
  restores the arriving one's (0 for a tab never in front), including when the
  front tab closes and the fallback takes its place. Closing asks first through
  music_editing's `decideClose` over the store's `dirty`; leaving the foreground
  flushes every open document (`flushAll`), because a phone may kill a
  backgrounded app inside the debounce window.
- **An import becomes a server project when somebody is signed in** (decision 2
  of the parity plan), built from the create response rather than re-read. Signed
  out, or when the server cannot be reached, it is a local unsaved document; a
  server that answers and refuses (`ApiError`) is reported, not hidden.
- **Device prefs are one store, mirrored one way into every document.** Theme,
  language, pitch display, developer mode and keyboard-collapsed are music_lib's
  `createDevicePrefsStore` (`config/useDevicePrefs.ts`), loaded and saved by
  `bindDevicePrefs` at the composition root. Editing reads three of them off the
  document store, so `mirrorDevicePrefs` copies them in. **A control writes the
  prefs store, never a document store** — the pitch-display chip writing the
  document store would change one tab, persist nothing and be overwritten by the
  next change. The keyboard starts **expanded** and remembers collapsing, as on
  the web. `language` null means "follow the device" (`languageFor`).
- **Toasts go to one queue, not into stores.** Every store is built with
  `context.toasts = appToasts` (`features/toasts/Toasts.tsx`), so an autosave
  failure, a failed generation job and an editing refusal — with the Undo a
  refused paste offers — reach `<Toasts>` whichever tab raised them. Before this
  the stores appended toasts to a list nothing read.
- **Library copy is music_lib's `createLibraryCopy`, installed at start-up.**
  `config/initialize.ts` exports `libraryCopy` (built from `i18next.t`, every
  entry read when used); the status strip and the MusicXML import read its
  `selection()` and `musicXmlWarnings()`. `i18n/lib-copy.ts`, the hand-written
  copy of the web's table, is deleted.
- **There is no in-editor Generate Score; there is Generate Again.** Whole-score
  generation is where a project starts (New Project); an open project whose
  score came from a generation shows `GenerationChoices` under the Score tab's
  fields, the web's panel: each choice with a lock, `regenerateWithLocks`
  building the request, `regenerateCreditEstimate` quoting it, and a confirm
  before the whole score is replaced.
- **Snapshots are music_client's `useProjectSnapshots`.** `SnapshotsSheet` binds
  it to the document (flush = `saveNow`, adopt = `adoptOutsideScore` after
  stopping, `noteServerVersion`); `SnapshotsPanel` only draws it. Nothing
  re-downloads the project after a create or an open.

- **The score-setup form draws music_lib's New Project draft.** `ScoreSetupFields` takes a `NewProjectFormDraft` and a `dispatch` over `reduceNewProjectDraft`; its tests build drafts through the reducer (fixed rng) and read the pickers' triggers, which print the chosen label — a native `Select`'s modal is not mounted in tests. Option lists come from `generationInstrumentOptionsFlat` and `labelledOptions` (with `NO_MARK`/`optionalToPicker`), tested upstream; rows are addressed by entry id and only style-essential rows lock.
- **New Project opens on a piano, and used to open on a drum kit.** The initial roster was `INSTRUMENT_OPTIONS[0]`, which was the first *kit* — so native New Project started as a drum solo where the web one started on piano. It comes from `initialNewProjectDraft` now, which is what the web dialog uses.
- **The moods were rendered as their own raw values.** `bittersweet`, `upbeat` — labels written straight into the options with no key, which is the one class of missing translation `locale-parity` cannot see, since there is no key to be absent. They go through `moodLabelKey` (and complexity through `complexityLabelKey`) via `labelledOptions`, sorted by translated label. `generateScore.moodName.*` was missing from this app's locales entirely until the draft adoption — `keys-exist` cannot see a key built at runtime.
- **Turning the Generate toggle on gives the roster a singer**, through `setGenerating` in music_lib's reducer, which tracks the added voice by entry id (`autoVocalId`) and takes back only that one. Same rules as the web dialog, because they are the web dialog's code.
- **Replace and New Project defaults are music_lib's.** Replace opens on `defaultReplaceSubmission` (nothing preserved, moderate complexity, the default variant) with `REPLACE_PRESET_KEYS` translated under `replace.preset.<key>`; New Project sends `DEFAULT_GENERATION_VARIANT`. MIDI import number fields go through `parseNumericDraft` and `patchMidiImportOptions`, never `Number(text)` — a cleared field is not zero.

- **`useServerContext` hands the hooks a token *getter* and the user id, never a token.** A captured token fails an hour into a session and read `null` for a signed-in user on the first render; `getToken` is awaited per request and `userId` decides synchronously whether a query may run. `siteAdmin` comes from music_client's `useSiteAdmin` over the same shape.
- **`publicServerContext()` exists so a public route does not drag in Firebase.** `useServerContext` reads the auth context, so importing it into a component pulls the whole auth stack into every test that renders it — which is how adding the preset picker broke two suites with "Cannot use import statement outside a module" from `firebase/app`. The presets route needs no identity, so it gets a context built straight from the network client with `token: null`, and `null` where there is no server at all.
- **The preset picker is the server's list and this app's words**, the same contract the web dialog uses: `GET /public/presets?style=` says which briefs, `generateScore.preset.<key>` says what they read, and `preset-contract.test.ts` proves every brief the server could send has a translation in both languages. Rendered only when a list has arrived — a local document with no server gets no control rather than one that opens empty.
- **`renderWithApp` mounts a `QueryClientProvider`, exactly as `App.tsx` does.** Without one, any component that reads server data throws "No QueryClient set", which takes the whole render down rather than leaving a value missing — so a component that merely *might* ask the server breaks every test that renders it. Fresh client per render, retries off, no cache between tests.
- **The default title follows the Generate toggle** — "New Score" / "Generated Score" — as the placeholder and as the fallback, and it reaches the project name and the request rather than the draft, so a blank field still leaves the score's own metadata at "Untitled".

- **The lyric's subject sits under the Write-lyrics switch**, shown only while words are being written and blank-means-follow-the-prompt, exactly as the web dialog has it. `music_lib` drops it from the request unless the lyrics it describes were asked for, so neither app has to police it.

- **A playback frame re-renders nothing but what changed.** `useScoreCanvas` hands out the picture, the cursor description and the scroll offset as *signals* (`createSignal`/`useSignal`), read by `ScoreView` and `PlaybackCursor` alone. They were state in `ScrollingScore`, so every change of lit notes re-rendered the whole score view — including `displayScore`'s scan of every note — measured at 7% of the JavaScript thread on a dense import, as much as half the painting it was only there to show. `ScrollingScore.test.tsx` pins that a new picture, cursor or scroll offset renders it zero times. The score reaches the canvas through `setStoredScore(score, pitchDisplay)`, which applies the lenses and the out-of-range scan once per score.
- **The notation paints in layers, and prepares the next window ahead.** The surface is `createSkiaLayeredPaint` from `music_drawing/skia`: a base `SkPicture` kept until anything but the lit notes changes, and a frame that replays it under the active track's notes, so a change of lit notes records one track rather than the window. Painting fell from 17% of the JavaScript thread to under 5% on the dense import. `prepare` builds the window following playback is about to scroll to, a column per task, so the system break does not also format it. See `music_drawing/docs/score-canvas.md`.
- **A legacy native view's colour prop must be processed by hand when it is declared `NSColor`.** React Native runs `processColor` only for props a view manager declares `UIColor`; `@moosiac/playhead` declares `lineColor` as `NSColor`, so the theme's CSS string reached AppKit as a string, converted to nil, and the caret drew transparent — invisible on the Mac from the day it began taking the theme's colour, with no error anywhere. The package's `index.js` now wraps the native component and processes the colour. Found by drawing a plain `View` at the cursor's props (visible) beside the native view (not).
- **The keyboard ignores notes it does not show.** The player reports every track's sounding notes; `KeyboardPanel` compares the active track's lit keys with `samePitchSet` (music_editing, shared with the web keyboard) against a ref *before* `setSounding` — an updater that returns the previous set still renders to find that out. Keys come from music_drawing's `keyboardKeys` (`fit: 'width'`) and fills from `keyboardKeyFill`; what is lit is music_editing's `litKeys` (sounding only while playing, plus held keys).

## Patches

Three, all for macOS, all applied by `patch-package` on `postinstall`:
`react-native-audio-api` (the library declares `:ios` alone, though its audio
graph is `AVAudioEngine`/`AVAudioSourceNode`, which macOS has),
`@shopify/react-native-skia` (`UIImage` is UIKit and does not exist on macOS),
and `react-native-macos` (codegen). The last two are ported from
`sudojo_app_rn`. See `patches/README.md`.

**A `Podfile.lock` entry proves a pod resolved, not that it compiles.** Skia
was assumed to build on macOS because `sudojo_app_rn` links it; it builds there
because that repo patches it, and the same patch was needed here.

**The macOS Podfile patches `fmt` in `post_install`.** React Native 0.81 pins a
version whose `consteval` format-string checks fail under clang 21 / Xcode 26 —
every error is inside `fmt/format-inl.h`. It has to be patched in the header,
not defined on the command line: the chain setting `FMT_USE_CONSTEVAL` opens
with a plain `#if` and no `#ifndef`, so the header overrides whatever the
compiler was told. Pod sources land read-only, so it `chmod`s first.

## Structure

- `src/documents/` — a tab over music_lib's document store and the services it
  is built with (`document.ts`), the open-document list with each tab's caret
  (`document-list.ts`), import/export arrangement, recents, and the filesystem
  (`rn-storage.ts`, the one platform-bound file).
- `src/config/initialize.ts` — platform services: player first (music_lib's
  adapter resolves it from a singleton on first use), then io, then the
  library copy. `app/App.tsx` builds the document services, binds device prefs
  and the language, and mounts the toast queue.
- `src/config/useDevicePrefs.ts` — the device prefs store.
- `src/features/toasts/` — the toast queue every store's sink points at.
- `src/i18n/` — bundled locales and which language is in force.
- `src/features/score/` — the Skia score view.
- `src/features/transport/` — `usePlayerBinding` (music_editing's `bindPlayer`
  over a document store) and `usePositionReadout`.
- `src/features/documents/`, `src/features/editor/` — UI.
- `src/features/print/` — `PrintSheet` (scope, paper, orientation) and the
  Skia page rendering over music_drawing's `printPlan`.
- `src/features/tracks/` — the mixer rows the property sheet's Track tab is
  built from, drawn the way the web draws them.
- `src/features/credits/` — the balance, and what happens when it runs out.
- `src/screens/ResourcesScreen.tsx` / `AboutScreen.tsx` — the web's Resources
  and Home pages, in the form a native app can use: the link list is shared from
  music_editing, and the home page's *content* is reachable from Settings
  without the landing-page shape an installed app has already answered.
- `src/components/controls/` — the controls the shared libraries cannot
  supply: `LevelSlider` (a slider painted like the web's, level and pan),
  `ToolbarSelect` (a picker whose trigger is a toolbar button rather than a
  bordered text field) and `ConfirmSheet` (a yes/no whose confirm can be
  destructive, which `FormModal`'s `onSave` shorthand cannot express).
- `src/features/inspector/` — the property sheet: four tabs in music_editing's
  `INSPECTOR_TABS` order (Score, Track, Note, Bar), opening on
  `defaultInspectorTab`; `Field`/`DraftInput`/`NumberDraftInput`/`ReplaceButton`
  shared between them.
- `src/components/icons/` — `NotationIcon`, which replays music_types'
  `NOTATION_ICONS`, and `notation-ink.ts`, which says what colour to draw one.

## Related projects

`music_types` · `music_codecs` · `music_drawing` · `music_player` · `music_io` ·
`music_editing` · `music_client` · `music_lib` · `music_app` · `music_api`
