# Deploying to Netlify

This app is **not** a plain static site — it has a Node/Express backend that scrapes
MoneyDJ (holdings) and TWSE (prices) and builds the fund search index. Netlify doesn't
run a persistent server, so the setup is:

- **Frontend** (`public/`) → served statically by Netlify's CDN.
- **API** (`/api/search`, `/api/fund/:code`) → the Express app wrapped as **one Netlify Function**.

All the wiring is already in the repo. You mostly just connect and deploy.

## What's already set up

| File | Purpose |
| --- | --- |
| `netlify.toml` | Build command, publish dir (`public`), functions dir, and the `/api/* → function` redirect. |
| `netlify/functions/api.js` | Wraps the Express app (`server/app.js`) with `serverless-http` and normalizes the request path. |
| `server/app.js` | The Express routes, shared by local dev and the function. |
| `scripts/build-index.mjs` | Prebuilds `data/fund-index.json` at deploy time so search is instant on cold start (never fails the build). |

You don't need to change any of these to deploy.

---

## Option A — Deploy from Git (recommended)

Best because every `git push` redeploys automatically.

1. **Put the project in a Git repo** (if it isn't already) and push to GitHub/GitLab:
   ```bash
   git init
   git add .
   git commit -m "NAV checker"
   git branch -M main
   git remote add origin https://github.com/<you>/nav-checker-tw.git
   git push -u origin main
   ```
   > `node_modules/` is gitignored (Netlify installs deps). `data/fund-index.json` **is**
   > committed on purpose so search works instantly without a slow runtime crawl.

2. **Create the site on Netlify**: go to <https://app.netlify.com> → **Add new site → Import an existing project** → pick your repo.

3. **Build settings** — Netlify reads them from `netlify.toml`, so leave them as detected:
   - Build command: `npm run build:index`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`

4. Click **Deploy**. First build takes a couple of minutes (installs deps, crawls the fund list). When it's done you get a URL like `https://<your-site>.netlify.app`.

5. Push changes anytime to redeploy:
   ```bash
   git add . && git commit -m "tweak" && git push
   ```

---

## Option B — Deploy with the Netlify CLI (no Git host needed)

1. Install and log in:
   ```bash
   npm install -g netlify-cli
   netlify login
   ```

2. From the project folder, run a guided deploy:
   ```bash
   netlify deploy --build          # creates a draft/preview URL
   netlify deploy --build --prod    # promotes to your live URL
   ```
   `--build` runs the `netlify.toml` build (including the index prebuild) before uploading.

3. To test the whole thing locally exactly as Netlify runs it (static + function + redirect):
   ```bash
   netlify dev
   ```
   then open the printed `http://localhost:8888`.

---

## Verify it's working

Open your site and:
- Search "安聯台灣科技" → the fund should appear.
- Select it → the estimated move + holdings should load.

Or hit the API directly:
```
https://<your-site>.netlify.app/api/search?q=安聯
https://<your-site>.netlify.app/api/fund/ACDD04
```
Both should return JSON.

---

## Things to know (important)

- **Live prices only move during Taiwan market hours** (~09:00–13:30 TW time, Mon–Fri). Outside those hours the estimate reflects the last close — that's expected, not a bug.
- **Cold starts**: the first request after idle spins up the function (~1–2s). The fund index is prebuilt into the bundle, so search stays fast; holdings/prices are always fetched live.
- **Function time limit**: Netlify Functions cap at 10s. A fund lookup does ~3–4 upstream fetches and finishes well under that. If MoneyDJ/TWSE is slow, a request may occasionally fail — just retry.
- **No persistent disk**: serverless functions can't write to the project dir. The runtime cache falls back to the OS temp dir, and the index is refreshed weekly / rebuilt on cold start if missing. Nothing to configure.
- **This scrapes third-party sites** (MoneyDJ, TWSE). It's fine for personal use; if their markup changes, the parser may need updating. Don't put it behind heavy public traffic.
- **No secrets/env vars required.** There's nothing to configure in Netlify's environment settings.

## Optional: custom domain

In Netlify → **Domain management → Add a domain**, point your domain's DNS at Netlify (or buy one through them). HTTPS is automatic.

## If the API 404s or returns HTML

That almost always means the redirect isn't active. Confirm `netlify.toml` is at the repo
root and contains the `/api/* → /.netlify/functions/api/:splat` redirect, then redeploy.
Check **Deploys → Functions** in the Netlify dashboard to confirm `api` was bundled.
