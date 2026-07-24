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

This folder is the **marketing homepage** for [sabbath-cue-two.vercel.app](https://sabbath-cue-two.vercel.app/).
Paddle checkout lives in `web/` and is merged at deploy time by the repo root build
(`npm run build:vercel`): your landing HTML stays at `/`, while `/pricing/`, `/pay/`,
and `/welcome/` come from the Next.js static export.

Set these **Vercel project environment variables** (Production) before deploying:

- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` — sandbox `test_...` until live verification, then `live_...`
- `NEXT_PUBLIC_PADDLE_ENV` — `sandbox` or `production`
- `NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH` / `NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR`
- `NEXT_PUBLIC_SITE_ORIGIN` — `https://sabbath-cue-two.vercel.app`
- `NEXT_PUBLIC_BASE_PATH` — leave empty (root deploy)

Paddle **default payment link** (Checkout → Checkout settings):

`https://sabbath-cue-two.vercel.app/pay/`

### Option A — Vercel dashboard (recommended)

1. Import the GitHub repo at <https://vercel.com/new>.
2. Leave **Root Directory** at the repo root (not `landing/`).
3. **Framework Preset**: Other. Build command `npm run build:vercel`, output `dist`.
4. Add the Paddle env vars above, then deploy.

### Option B — Vercel CLI

```bash
vercel        # preview deploy
vercel --prod # production deploy
```

When the CLI asks, use the **repo root** as the project directory.
