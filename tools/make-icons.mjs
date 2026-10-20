// Builds favicon.svg (RM monogram, text outlined to paths) and apple-touch-icon.png (180x180).
// Run from repo root: node tools/make-icons.mjs
// Font: tools/fonts/IBMPlexSans-SemiBold.ttf from https://github.com/IBM/plex (OFL).
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const opentype = require('./node_modules/opentype.js');
const sharp = require('./node_modules/sharp');

const BG = '#ECEDEF';
const FG = '#14171A';
const ttf = readFileSync('tools/fonts/IBMPlexSans-SemiBold.ttf');
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

function monogramPath(size, fontSize) {
  const p = font.getPath('RM', 0, 0, fontSize, { kerning: true });
  const bb = p.getBoundingBox();
  const dx = (size - (bb.x2 - bb.x1)) / 2 - bb.x1;
  const dy = (size - (bb.y2 - bb.y1)) / 2 - bb.y1;
  return font.getPath('RM', dx, dy, fontSize, { kerning: true }).toPathData(2);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${BG}"/><path fill="${FG}" d="${monogramPath(64, 34)}"/></svg>\n`;
writeFileSync('favicon.svg', svg);

// iOS masks touch icons itself and renders transparent corners black, so this one is full-bleed.
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="${BG}"/><path fill="${FG}" d="${monogramPath(180, 92)}"/></svg>`;
await sharp(Buffer.from(touch)).resize(180, 180).png({ compressionLevel: 9 }).toFile('apple-touch-icon.png');
console.log('wrote favicon.svg, apple-touch-icon.png');
