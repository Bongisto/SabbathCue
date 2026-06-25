# SabbathCue landing page

Self-contained static landing page (single `index.html`, no build step).
The "Download for Windows" button pulls the installer from Cloudflare R2 via a
`fetch` → blob so the file downloads silently without navigating away.

## Local preview

```bash
# from this folder
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy to Vercel

This folder is a standalone static site, separate from the Next.js site in
`web/` (which deploys to GitHub Pages) and the Tauri app at the repo root.

### Option A — Vercel dashboard

1. Import the GitHub repo at <https://vercel.com/new>.
2. Set **Root Directory** to `landing`.
3. **Framework Preset**: Other. Leave build & output commands empty
   (it's a static site — no build step).
4. Deploy.

### Option B — Vercel CLI

```bash
cd landing
vercel        # preview deploy
vercel --prod # production deploy
```

When the CLI asks, set the root directory to the current folder and skip the
build command.
