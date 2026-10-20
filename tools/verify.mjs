// Behavioral checks: anchor offsets under the sticky header, copy button (clipboard + fallback), scroll hint.
// Usage (repo root): node tools/verify.mjs [baseUrl]   (defaults to a local static server)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const pw = require('./node_modules/playwright');

let base = process.argv[2];
let server;
if (!base) {
  const root = resolve('.');
  const types = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(root, p);
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  }).listen(0);
  base = `http://localhost:${server.address().port}`;
}

for (const bn of ['chromium', 'webkit']) {
  const browser = await pw[bn].launch();
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const res = [];
    for (const id of ['realbench', 'nurturiq', 'rtl-agent', 'contact']) {
      await page.click(`header a[href="#${id}"]`);
      await page.waitForTimeout(150);
      const r = await page.evaluate((id) => {
        const hb = document.querySelector('header').getBoundingClientRect().bottom;
        const h = document.querySelector(`#${id} h2`).getBoundingClientRect().top;
        return { gap: Math.round(h - hb) };
      }, id);
      res.push(`${id}:${r.gap >= 0 ? 'clear' : 'HIDDEN'}(${r.gap}px)`);
    }
    const hint = await page.evaluate(async () => {
      const w = document.querySelector('.pr-wrap'); const sc = w.querySelector('.pr-scroll');
      const hintShown = getComputedStyle(w.querySelector('.pr-hint')).display !== 'none';
      const scrolls = sc.scrollWidth > sc.clientWidth;
      sc.scrollLeft = sc.scrollWidth; await new Promise((r) => setTimeout(r, 100));
      return { scrolls, hintShown, atEndAfterScroll: w.classList.contains('at-end') };
    });
    console.log(`${bn} ${width}px anchors: ${res.join(' ')} | terminal scrolls=${hint.scrolls} hint=${hint.hintShown} hidesAtEnd=${hint.atEndAfterScroll}`);
    await ctx.close();
  }

  // Copy button: modern path (chromium only can read clipboard) and forced fallback path.
  const ctx = await browser.newContext(bn === 'chromium' ? { permissions: ['clipboard-read', 'clipboard-write'] } : {});
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('#copy-btn');
  await page.waitForTimeout(150);
  let modern = await page.evaluate(() => ({ btn: document.getElementById('copy-btn').textContent, live: document.getElementById('copy-status').textContent }));
  let clip = bn === 'chromium' ? await page.evaluate(() => navigator.clipboard.readText()) : '(not readable in webkit)';
  console.log(`${bn} copy modern: button="${modern.btn}" live="${modern.live}" clipboard="${clip}"`);
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); });
  await page.click('#copy-btn');
  await page.waitForTimeout(150);
  const fb = await page.evaluate(() => ({ btn: document.getElementById('copy-btn').textContent, live: document.getElementById('copy-status').textContent }));
  clip = bn === 'chromium' ? await page.evaluate(() => navigator.clipboard === undefined ? 'n/a' : '') : '';
  console.log(`${bn} copy fallback (navigator.clipboard removed): button="${fb.btn}" live="${fb.live}"`);
  await page.waitForTimeout(2000);
  console.log(`${bn} after 2s: button="${await page.textContent('#copy-btn')}"`);
  await ctx.close();
  await browser.close();
}
server?.close();
