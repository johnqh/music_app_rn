#!/usr/bin/env node
/**
 * Vendors the instrument sample packs into the app bundle.
 *
 * A native app should carry its instruments. Without this the RN engine falls
 * back to `DEFAULT_BASE` — Benjamin Gleitzman's GitHub Pages — and the first
 * press of Play pulls ~2.6MB per instrument off somebody else's host: no sound
 * on a plane, no sound when that host is down, a wait before every unfamiliar
 * instrument, and a third party learning who plays what. Bundled, playback
 * needs no network at all.
 *
 * Same shape as `music_app/scripts/fetch-resource-icons.ts`: the files land in
 * the working tree, are gitignored, and the build copies them into the app.
 * Run it after a fresh clone, and again if the pack list ever changes.
 *
 *   node scripts/fetch-soundfont-packs.mjs [--force] [--percussion <dir>]
 *
 * Melodic packs are CC-BY 3.0 (FluidR3, by Frank Wen) and may be redistributed
 * *with attribution* — which is why the licence note is copied in beside them
 * rather than left behind on the CDN.
 */
import { mkdirSync, readdirSync, copyFileSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'soundfont');

const BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
/*
  Read as a *file path*, not through the package name, for two separate reasons.
  Importing `@sudobility/music_player/rn` pulls in the React Native optional
  peers, which `node` cannot load at all; and `require()`-ing the JSON by
  subpath is refused by the package's `exports` map
  (ERR_PACKAGE_PATH_NOT_EXPORTED) even though the file is published. Reading the
  file directly sidesteps both. The list is the same one the engine asks for.
*/
const PACK_NAMES_FILE = join(
  ROOT,
  'node_modules/@sudobility/music_player/dist/rn/playback/pack-names.json',
);
if (!existsSync(PACK_NAMES_FILE)) {
  console.error(`Cannot find ${PACK_NAMES_FILE} — run \`bun install\` first.`);
  process.exit(1);
}
const PACK_NAMES = JSON.parse(readFileSync(PACK_NAMES_FILE, 'utf8'));

const args = process.argv.slice(2);
const force = args.includes('--force');
const percussionIndex = args.indexOf('--percussion');
const percussionDir =
  percussionIndex >= 0
    ? args[percussionIndex + 1]
    : join(ROOT, '..', 'music_app', 'public', 'audio', 'percussion');

/** Concurrency: polite to the host, and fast enough for 128 files. */
const PARALLEL = 6;
/*
  Validated against exactly what `parseSamplePack` requires, rather than against
  what a pack looks like at a glance: the real files open with an
  `if (typeof(MIDI) === 'undefined')` preamble, so "starts with
  MIDI.Soundfont." rejects every one of them.

  Checked at all because the failure it guards is silent: a 404 page or a
  truncated body parses to *zero samples*, and an instrument with no samples is
  silent playback with nothing reporting a problem — the bad download would
  ship as "that instrument makes no sound".
*/
const MIN_BYTES = 10_000;
const HEADER = /MIDI\.Soundfont\.([A-Za-z0-9_]+)\s*=/;
const NOTE_ENTRY = /"([A-Ga-g][#b]?-?\d+)"\s*:\s*"(data:audio\/[^"]+)"/;
function packProblem(text) {
  if (!HEADER.test(text)) return 'no `MIDI.Soundfont.<instrument> =` found';
  if (!NOTE_ENTRY.test(text)) return 'no note entries found';
  return null;
}

async function fetchPack(name) {
  const file = join(OUT, `${name}-mp3.js`);
  if (!force && existsSync(file) && statSync(file).size >= MIN_BYTES) {
    return { name, bytes: statSync(file).size, skipped: true };
  }
  const url = `${BASE}${name}-mp3.js`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const text = await response.text();
  const problem = packProblem(text);
  if (problem) {
    throw new Error(`${name}: not a sample pack — ${problem} (${text.length} bytes)`);
  }
  if (text.length < MIN_BYTES) throw new Error(`${name}: suspiciously small (${text.length} bytes)`);
  writeFileSync(file, text);
  return { name, bytes: text.length, skipped: false };
}

async function inBatches(items, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += PARALLEL) {
    results.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(worker))));
    process.stdout.write(`\r  ${Math.min(i + PARALLEL, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');
  return results;
}

mkdirSync(OUT, { recursive: true });

console.log(`Melodic packs -> ${OUT}`);
const melodic = await inBatches(PACK_NAMES, fetchPack);

/*
  Percussion is not on any CDN: no collection of pre-rendered GM drums has a
  licence this project can use, so they are rendered from the same font by
  music_io/scripts/build-percussion-packs.mjs and copied in from wherever that
  wrote them. Missing drums are a warning rather than an error — the melodic
  half is still worth vendoring on a machine that has never built them.
*/
let drums = 0;
if (existsSync(percussionDir)) {
  drums = readdirSync(percussionDir).filter(f => f.endsWith('-mp3.js'));
  /*
    Validated on the way in, exactly like the downloaded ones.

    Copying them unchecked is how a stale build slipped through: an older
    version of build-percussion-packs.mjs wrote `B1: 'data:...'` — unquoted key,
    single-quoted value — where the parser requires `"B1": "data:..."`. Every
    kit parsed to zero samples, which surfaces as drums that make no sound and
    nothing reporting a problem. A local file deserves the same suspicion as a
    download; it is just as capable of being wrong, and had been for longer.
  */
  const stale = [];
  for (const file of drums) {
    const body = readFileSync(join(percussionDir, file), 'utf8');
    const problem = packProblem(body);
    if (problem) {
      stale.push(`${file}: ${problem}`);
      continue;
    }
    copyFileSync(join(percussionDir, file), join(OUT, file));
  }
  if (stale.length) {
    console.error(`\n! ${stale.length} percussion pack(s) are not readable by the engine:`);
    for (const line of stale.slice(0, 4)) console.error(`    ${line}`);
    console.error('  Rebuild them: node ../music_io/scripts/build-percussion-packs.mjs \\');
    console.error('    --soundfont <FluidR3Mono_GM.sf3> --out ' + percussionDir);
    process.exitCode = 1;
  }
  drums = drums.length - stale.length;
  const attribution = join(percussionDir, 'ATTRIBUTION.md');
  if (existsSync(attribution)) copyFileSync(attribution, join(OUT, 'ATTRIBUTION.md'));
  console.log(`Percussion: ${drums} kits copied from ${percussionDir}`);
} else {
  console.warn(`! No percussion at ${percussionDir} — drum tracks will be silent.`);
  console.warn('  Build them: node ../music_io/scripts/build-percussion-packs.mjs --soundfont <sf3> --out <dir>');
}

/* CC-BY 3.0 obliges the app to carry the attribution, not merely to link it. */
writeFileSync(
  join(OUT, 'LICENSE.md'),
  `# Bundled instrument samples\n\n` +
    `Melodic packs are Benjamin Gleitzman's pre-renderings of **FluidR3_GM.sf2**\n` +
    `(original soundfont by Frank Wen), distributed under Creative Commons\n` +
    `Attribution 3.0. They are redistributed here under that licence, with\n` +
    `attribution. Percussion is rendered from FluidR3Mono_GM.sf3 by\n` +
    `music_io/scripts/build-percussion-packs.mjs; see ATTRIBUTION.md.\n\n` +
    `Vendored by scripts/fetch-soundfont-packs.mjs — do not edit by hand.\n`,
);

const downloaded = melodic.filter(p => !p.skipped).length;
const total = readdirSync(OUT)
  .filter(f => f.endsWith('-mp3.js'))
  .reduce((sum, f) => sum + statSync(join(OUT, f)).size, 0);
console.log(
  `\n${melodic.length} melodic + ${drums} percussion packs ` +
    `(${downloaded} downloaded, ${melodic.length - downloaded} already present)`,
);
console.log(`Total bundled audio: ${(total / 1024 / 1024).toFixed(0)} MB`);
