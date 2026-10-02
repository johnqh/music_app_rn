# App Store Scripts

Scripts for building the app and capturing App Store / Play Store screenshots across devices and languages.

## Prerequisites

- **Xcode** with iOS simulators installed
- **Android Studio** with emulators configured (AVDs matching `screens.json`)
- **jq**: `brew install jq`
- **Metro bundler** is started automatically by `prepare.sh`

## Scripts

| Script           | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `build.sh`       | Build debug (simulator/emulator) and release (.ipa/.aab) artifacts       |
| `prepare.sh`     | Boot one device, install app, start Metro, launch app                    |
| `capture.sh`     | Capture screenshots on one running device across all languages and paths |
| `capture_raw.sh` | Orchestrator: build → for each device: prepare → capture → shutdown      |
| `cleanup.sh`     | Stop Metro bundler and clean up                                          |
| `compose.sh`     | Frame + caption raw captures into store screenshots (needs Pillow)       |
| `submit.sh`      | Upload build + metadata to App Store Connect / Google Play (see below)   |

Every script here is a 4-line wrapper that sets `APP_STORE_DIR` to this folder and `exec`s the same-named script in `~/projects/workflows/app_store/`, so that repo must be checked out. `submit.sh` flags: `--platforms apple,google`, `--metadata-only`, `--screenshots`, `--subscriptions`, `--skip-build`, `--dry-run`. Submission credentials go in `app_store/.env` (see `.env.example`) and `app_store/.keys/` (`apple.p8`, `google-play.json`); both are gitignored.

## Quick Start

```bash
# Full run — build + screenshots for all devices (portrait)
./app_store/scripts/capture_raw.sh

# Landscape screenshots for tablets (iPads + Android tablets)
./app_store/scripts/capture_raw.sh --orientation landscape

# Skip release builds (debug only, faster)
./app_store/scripts/capture_raw.sh --skip-release

# Skip build entirely (reuse existing artifacts)
./app_store/scripts/capture_raw.sh --skip-build

# Single device
./app_store/scripts/capture_raw.sh --skip-build --device iphone_6_9

# Filter by platform
./app_store/scripts/capture_raw.sh --skip-build --platform ios --platform ipados

# Dry run — see what would happen without executing
./app_store/scripts/capture_raw.sh --dry-run
```

## Running Scripts Individually

```bash
# Build debug + release
./app_store/scripts/build.sh

# Build debug only
./app_store/scripts/build.sh --debug-only

# Build iOS only
./app_store/scripts/build.sh --platform ios

# Prepare a single device (boot + install + launch)
./app_store/scripts/prepare.sh --device iphone_6_9

# Prepare an iPad in landscape
./app_store/scripts/prepare.sh --device ipad_13 --orientation landscape

# Capture screenshots on a running device
./app_store/scripts/capture.sh --device iphone_6_9

# Capture with longer delay (for slow animations)
./app_store/scripts/capture.sh --device iphone_6_9 --delay 5

# Stop Metro and clean up
./app_store/scripts/cleanup.sh
```

## Configuration

| File                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `screens.json`        | Devices, simulators/emulators, and resolutions per platform              |
| `languages.json`      | Languages to capture (e.g. `["en", "es"]`)                               |
| `paths.json`          | One link per screenshot, opened as `moosiac:///<lang><path>` (see below) |
| `info.json`           | App metadata (bundle ID, scheme, store listings)                         |
| `ExportOptions.plist` | iOS archive export config (signing, team ID)                             |

`ExportOptions-macOS.plist` is the macOS equivalent. `paths.json` entries are strings, or `{ "path": "...", "delay": 15 }` for a shot that needs longer than `--delay` (the longer of the two applies). The link grammar is `src/features/screenshots/screenshot-links.ts`; the app acts on these links in debug builds only, and signs in to the `.env` test account (`DEV_SIGNIN_EMAIL`/`DEV_SIGNIN_PASSWORD`) so screens that need an account can be shown. Store languages are English and Chinese (`languages.json`), the two the app ships.

Per-language store listing text and screenshot captions live in `screenshots/info/<lang>/{info,screens}.json` (translated by `bun run localize:store`); Google Play `shortDescription` must be ≤ 80 chars or `submit.sh --platforms google` fails with 403.

## Output

Screenshots are saved to:

```
app_store/screenshots/raw/<device_key>/<language>/<seq>.png     # capture.sh
app_store/screenshots/store/<device_key>/<language>/            # compose.sh (gitignored)
```

Build artifacts are saved to:

```
app_store/builds/debug/     # Sudojo.app (iOS), app-debug.apk (Android)
app_store/builds/release/   # Sudojo.xcarchive, Sudojo.ipa, app-release.aab
```

## Options Reference

### `capture_raw.sh`

| Flag                | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `--platform <name>` | Filter: `ios`, `ipados`, `android`. Repeatable.                         |
| `--device <key>`    | Filter by device key (e.g. `iphone_6_9`). Repeatable.                   |
| `--orientation <o>` | `portrait` (default) or `landscape`. Landscape applies to tablets only. |
| `--delay <seconds>` | Wait time before each capture (default: 8).                             |
| `--skip-build`      | Skip the build step.                                                    |
| `--skip-release`    | Only build debug artifacts.                                             |
| `--dry-run`         | Print actions without executing.                                        |

### `build.sh`

| Flag                | Description                           |
| ------------------- | ------------------------------------- |
| `--platform <name>` | Filter: `ios`, `android`. Repeatable. |
| `--debug-only`      | Skip release builds.                  |
| `--release-only`    | Skip debug builds.                    |
| `--force`           | Rebuild even if artifacts exist.      |
| `--dry-run`         | Print actions without executing.      |

### `prepare.sh`

| Flag                | Description                               |
| ------------------- | ----------------------------------------- |
| `--device <key>`    | Required. Device key from `screens.json`. |
| `--orientation <o>` | `portrait` (default) or `landscape`.      |
| `--skip-install`    | Skip app installation.                    |
| `--dry-run`         | Print actions without executing.          |

### `capture.sh`

| Flag                | Description                               |
| ------------------- | ----------------------------------------- |
| `--device <key>`    | Required. Device key from `screens.json`. |
| `--orientation <o>` | `portrait` (default) or `landscape`.      |
| `--delay <seconds>` | Wait time before capture (default: 8).    |
| `--dry-run`         | Print actions without executing.          |
