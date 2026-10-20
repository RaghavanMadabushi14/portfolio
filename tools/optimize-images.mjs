// Lossless image optimization. Run from repo root: node tools/optimize-images.mjs
// PNGs: re-encoded at max zlib compression; all ancillary chunks (tEXt, caBX/C2PA, pHYs) dropped.
// Pixels are decoded before and after and must match exactly, or the original is kept.
// JPEG: jpegtran -copy none (lossless; removes EXIF/XMP/Photoshop segments).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('./node_modules/sharp');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rawOf = async (buf) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  return { data, info };
};

let failed = false;
for (const file of walk('img')) {
  if (file.endsWith('.png')) {
    const before = readFileSync(file);
    const out = await sharp(before).png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
    const a = await rawOf(before);
    const b = await rawOf(out);
    const same = a.info.width === b.info.width && a.info.height === b.info.height &&
      a.info.channels === b.info.channels && a.data.equals(b.data);
    if (!same) { console.error(`PIXEL MISMATCH, kept original: ${file}`); failed = true; continue; }
    const final = out.length < before.length ? out : null;
    if (final) writeFileSync(file, final);
    else {
      // Larger output: still strip metadata but keep original IDAT by rewriting chunks.
      writeFileSync(file, stripPngChunks(before));
    }
    console.log(`${file}: ${before.length} -> ${statSync(file).size} bytes, pixels identical`);
  } else if (/\.jpe?g$/i.test(file)) {
    const before = statSync(file).size;
    const tmp = file + '.tmp';
    execFileSync('jpegtran', ['-copy', 'none', '-optimize', '-progressive', '-outfile', tmp, file]);
    renameSync(tmp, file);
    console.log(`${file}: ${before} -> ${statSync(file).size} bytes (lossless, metadata removed)`);
  }
}

function stripPngChunks(buf) {
  const keep = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'gAMA', 'cHRM', 'sRGB', 'iCCP']);
  const parts = [buf.subarray(0, 8)];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    if (keep.has(type)) parts.push(buf.subarray(i, i + 12 + len));
    i += 12 + len;
  }
  return Buffer.concat(parts);
}

if (failed) process.exit(1);
