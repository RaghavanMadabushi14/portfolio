# Portfolio

Static site: `index.html` plus assets, hosted on Vercel at https://raghavan-madabushi.vercel.app. No build step, no framework. Everything in the repo root is served as-is; `tools/` and this README are excluded from the deploy by `.vercelignore`.

## Edit text

1. Edit `index.html`.
2. Commit and push to `main`:
   ```bash
   git add index.html
   git commit -m "Update copy"
   git push
   ```
3. Vercel deploys automatically in about 30 seconds. Watch it under Vercel → Project → Deployments.

## Replace the résumé or an image

- **Résumé:** overwrite `resume.pdf` with the new file (same name), commit, push. `resume.pdf` is served with `max-age=0`, so visitors get the new one immediately.
- **Images:** files under `img/`, plus `favicon.svg` and `og-image.png`, are cached for a year as `immutable`. Browsers will keep showing the old version unless the URL changes. Either:
  - use a new file name (e.g. `jackal-timeline-v2.png`) and update the `src`/`href` in `index.html`, or
  - keep the name and bump a query string in `index.html`: `img/realbench/jackal-timeline.png?v=2`.
- After adding images, run the lossless optimizer (strips metadata, never changes pixels):
  ```bash
  cd tools && npm install && cd ..
  node tools/optimize-images.mjs
  ```
- Keep `width`/`height` on every `<img>` equal to the real pixel size (`sips -g pixelWidth -g pixelHeight file.png`).
- **Share image:** edit `tools/og.html`, then regenerate `og-image.png` (see the screenshot command in `tools/`), and rename it or add `?v=2` to the `og:image` / `twitter:image` URLs. LinkedIn caches previews; re-scrape with the [Post Inspector](https://www.linkedin.com/post-inspector/).

## Roll back

Vercel → Project → Deployments → pick an earlier deployment → ⋯ → **Promote to Production** (or **Instant Rollback**). This is instant and doesn't touch git; push a fix afterwards so `main` matches.

## Add a custom domain later

Vercel → Project → Settings → **Domains** → add the domain and follow the DNS instructions. Then update the URL in these places and push:

- `index.html`: `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`
- `robots.txt` (Sitemap line) and `sitemap.xml`

## Local checks (optional)

```bash
cd tools && npm install && npx playwright install chromium webkit && cd ..
node tools/screens.mjs after chromium     # screenshots + horizontal-overflow check at 7 widths
node tools/verify.mjs                      # anchors under sticky header, copy button, scroll hint
node tools/verify.mjs https://raghavan-madabushi.vercel.app
```
