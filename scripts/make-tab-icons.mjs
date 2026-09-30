/**
 * Draws the Android tab bar's icons as PNGs, from the vector drawables.
 *
 * The system tab bar takes an image through React Native's image loader,
 * which reads bitmaps and not Android's vector XML — handed a vector's name
 * it draws nothing, which is how four of five tabs came to be invisible. The
 * vectors in `android/app/src/main/res/drawable/ic_tab_*.xml` stay the
 * authoring form; this renders each at 1x, 2x and 3x, black on transparent,
 * for the bar to tint.
 *
 *   node scripts/make-tab-icons.mjs      (needs Playwright's Chromium, which
 *                                         the web app beside this one installs)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, '..', 'music_app', 'package.json'));
const { chromium } = require('@playwright/test');

const DRAWABLES = join(root, 'android/app/src/main/res/drawable');
const OUT = join(root, 'assets/tab-icons');
const SIZE = 24;

const attr = (xml, name) =>
  new RegExp(`android:${name}="([^"]*)"`).exec(xml)?.[1];

function svgOf(xml) {
  const paths = [...xml.matchAll(/<path\b[^>]*\/>/g)].map(([path]) => {
    const stroke = attr(path, 'strokeColor');
    const fill = attr(path, 'fillColor');
    return `<path d="${attr(path, 'pathData')}" fill="${
      fill ? '#000' : 'none'
    }" stroke="${stroke ? '#000' : 'none'}" stroke-width="${
      attr(path, 'strokeWidth') ?? 0
    }" stroke-linecap="${
      attr(path, 'strokeLineCap') ?? 'butt'
    }" stroke-linejoin="${attr(path, 'strokeLineJoin') ?? 'miter'}"/>`;
  });
  const box = `0 0 ${attr(xml, 'viewportWidth')} ${attr(
    xml,
    'viewportHeight',
  )}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${SIZE}" height="${SIZE}">${paths.join(
    '',
  )}</svg>`;
}

const browser = await chromium.launch();
for (const file of readdirSync(DRAWABLES).filter(f =>
  /^ic_tab_.*\.xml$/.test(f),
)) {
  const svg = svgOf(readFileSync(join(DRAWABLES, file), 'utf8'));
  const name = file.replace(/^ic_tab_/, '').replace(/\.xml$/, '');
  for (const scale of [1, 2, 3]) {
    const page = await browser.newPage({
      viewport: { width: SIZE, height: SIZE },
      deviceScaleFactor: scale,
    });
    await page.setContent(
      `<body style="margin:0;background:transparent">${svg}</body>`,
    );
    const png = await page.screenshot({ omitBackground: true });
    writeFileSync(
      join(OUT, `${name}${scale === 1 ? '' : `@${scale}x`}.png`),
      png,
    );
    await page.close();
  }
  console.log(name);
}
await browser.close();
