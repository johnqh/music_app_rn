# Moosiac — native app

The React Native Moosiac app: iOS, iPad, Android phone and tablet, and macOS.

Everything about music lives in the shared libraries — the model, editing,
layout, rendering, playback and file formats are all `@sudobility/music_*`.
This repo is UI and arrangement, and `src/__architecture.test.ts` enforces it.

## Getting started

```bash
bun install          # runs patch-package afterwards
bun run verify       # format, typecheck, lint, test

bun run start        # Metro, port 8083
bun run macos        # or: ios / android
```

macOS and iOS need pods first:

```bash
cd macos && RCT_NEW_ARCH_ENABLED=1 \
  DISABLE_AUDIOAPI_FFMPEG=1 \
  DISABLE_AUDIOAPI_STATIC_EXTERNAL_LIBS=1 \
  pod install
```

Both flags are deliberate, not shortcuts, and both must also be set for
`xcodebuild`:

- **FFmpeg** is needed only for MP4/M4A/AAC. The instrument packs are mp3,
  which miniaudio decodes natively.
- **The static external libs** (ogg, opus, vorbis) ship prebuilt, and the
  `macosx` slice is built for **macCatalyst** — linking it into a native macOS
  binary fails with *"building for 'macOS', but linking in object file built
  for 'macCatalyst'"*. We decode none of those formats, so the flag drops them
  and miniaudio's own decoders remain.

## What works today

- Opening, editing and saving `.moosiac` documents, several at once, each with
  its own editing store and its own undo history
- Notation rendered with Skia through the shared renderer, windowed to the
  viewport so a long score costs what a short one does
- Note entry, playback transport, document tabs
- English and Chinese

## What does not yet

- Sign-in, server projects, generation, credits, snapshots and publishing.
  The store is built without a `MusicClient` at all and reports those
  unavailable rather than failing — see `serverAvailable`.
- Import and export of MIDI, MusicXML and tracker formats. `music_io` provides
  them; nothing here calls them yet.
- The piano keyboard, the inspector, and selection by touch.

See `CLAUDE.md` for the architecture and the gotchas worth knowing before
changing anything.
