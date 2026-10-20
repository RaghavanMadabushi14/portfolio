// Responsive screenshots + overflow checks.
// Usage (repo root): node tools/screens.mjs <label> [chromium|webkit] [widths...]
// Writes tools/screens/<label>-<browser>-<width>.png and prints per-width checks.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const pw = require('./node_modules/playwright');

const [label = 'shot', browserName = 'chromium', ...w] = process.argv.slice(2);
const widths = w.length ? w.map(Number) : [360, 390, 430, 768, 1024, 1280, 1440];
const root = resolve('.');
const types = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain', '.xml': 'application/xml' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(root, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': 'text/html' }); res.end(readFileSync(join(root, existsSync(join(root, '404.html')) ? '404.html' : 'index.html'))); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(0);
const port = server.address().port;
mkdirSync('tools/screens', { recursive: true });

const browser = await pw[browserName].launch();
let bad = false;
for (const width of widths) {
  const mobile = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile && browserName === 'chromium', hasTouch: mobile });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [...document.querySelectorAll('body *')].filter((el) => {
      const b = el.getBoundingClientRect();
      if (b.right <= vw + 0.5) return false;
      for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return false;
      return true;
    }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${el.className || ''} right=${Math.round(el.getBoundingClientRect().right)}`);
    const brokenImgs = [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src);
    const smallTaps = [...document.querySelectorAll('header a, a.np, button, footer a')].filter((a) => {
      const b = a.getBoundingClientRect(); return b.height > 0 && b.height < 44;
    }).map((a) => `${a.textContent.trim().slice(0, 24)}=${Math.round(a.getBoundingClientRect().height)}px`);
    const nav = document.querySelector('header').getBoundingClientRect();
    const h1 = document.querySelector('h1').getBoundingClientRect();
    return { vw, sw, offenders, brokenImgs, smallTaps, headerH: Math.round(nav.height), navOverlapsName: nav.bottom > h1.top + window.scrollY && window.scrollY === 0 ? nav.bottom > h1.top : false };
  });
  const ok = r.sw === r.vw && r.brokenImgs.length === 0;
  if (!ok) bad = true;
  console.log(`${browserName} ${width}px: scrollWidth=${r.sw} viewport=${r.vw} ${r.sw === r.vw ? 'OK' : 'H-OVERFLOW'} | header=${r.headerH}px | broken imgs=${r.brokenImgs.length} | navOverlapsName=${r.navOverlapsName}` +
    (r.offenders.length ? `\n   overflow offenders: ${r.offenders.join('; ')}` : '') +
    (mobile && r.smallTaps.length ? `\n   taps <44px: ${r.smallTaps.join(', ')}` : ''));
  await page.screenshot({ path: `tools/screens/${label}-${browserName}-${width}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
