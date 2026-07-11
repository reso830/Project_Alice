// One-off generator for the static Open Graph / Twitter Card social image
// (issue #139). Run manually with `node scripts/generate-og-image.mjs` when
// the brand assets or copy change — output is checked into `public/` and
// served as a plain static file, matching this project's no-SSR
// architecture (no per-request image generation).
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 630;

GlobalFonts.registerFromPath(
  path.join(root, 'node_modules/@fontsource/sora/files/sora-latin-700-normal.woff2'),
  'Sora 700',
);
GlobalFonts.registerFromPath(
  path.join(root, 'node_modules/@fontsource/sora/files/sora-latin-400-normal.woff2'),
  'Sora 400',
);

async function main() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Navy galaxy background, matching the Welcome page's navy theme tokens
  // (--navy-deep / --navy / --indigo in src/styles/main.css).
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#17152f');
  bg.addColorStop(0.55, '#100e24');
  bg.addColorStop(1, '#0a0916');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft indigo glow accent, echoing .welcome--theme-navy::after, centred
  // behind the content block rather than off in empty space.
  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, 460);
  glow.addColorStop(0, 'rgba(129, 140, 248, 0.28)');
  glow.addColorStop(1, 'rgba(129, 140, 248, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark + tagline, measured first so the whole block (sigil + text)
  // can be centred as a group rather than left-pinned in a mostly-empty card.
  ctx.textBaseline = 'alphabetic';
  const wordmarkFont = '700 76px "Sora 700"';
  const taglineFont = '400 36px "Sora 400"';
  ctx.font = wordmarkFont;
  const wordmarkWidth = ctx.measureText('Project Alice').width;
  ctx.font = taglineFont;
  const taglineWidth = ctx.measureText('Your job search, organized.').width;
  const textWidth = Math.max(wordmarkWidth, taglineWidth);

  const sigilSize = 210;
  const gap = 40;
  const blockWidth = sigilSize + gap + textWidth;
  const blockLeft = (WIDTH - blockWidth) / 2;
  const centerY = HEIGHT / 2;

  const sigil = await loadImage(path.join(root, 'src/assets/logo/alice-sigil-full.svg'));
  const sigilX = blockLeft;
  const sigilY = centerY - sigilSize / 2;
  ctx.drawImage(sigil, sigilX, sigilY, sigilSize, sigilSize);

  const textX = sigilX + sigilSize + gap;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = wordmarkFont;
  ctx.fillText('Project Alice', textX, centerY - 8);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.font = taglineFont;
  ctx.fillText('Your job search, organized.', textX, centerY + 42);

  const buffer = await canvas.encode('png');
  const outPath = path.join(root, 'public/og-image.png');
  await writeFile(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}

main();
