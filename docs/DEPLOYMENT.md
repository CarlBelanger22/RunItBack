# Deploy RunItBack to a live URL

Simple guide for getting the app on the internet. **You do not need to buy a domain** to start.

---

## The big picture (3 pieces)

| Piece | What it is | You already have? |
|-------|------------|-------------------|
| **Frontend** | The React app (screens, buttons) | Yes — this repo |
| **Database** | Supabase (teams, games, stats) | Yes — cloud already |
| **Hosting** | Serves the built app at a URL | **This guide** |

Hosting only serves static files. The app still talks to Supabase from the browser using your env vars.

---

## Do you need to buy a domain?

**No — not to start.**

| Option | Example | Cost |
|--------|---------|------|
| **Free host URL** (recommended first) | `runitback.vercel.app` | $0 |
| **Custom domain** (optional later) | `runitback.com` | ~$10–15/year |

Use the free URL until you’re happy with the app. Add a custom domain anytime.

---

## Recommended host: Vercel

Works well with Vite, free tier, connects to GitHub, automatic HTTPS.

**Alternative:** Netlify (similar steps).

---

## Prerequisites checklist

- [ ] Code pushed to **GitHub** (public or private repo)
- [ ] Supabase project working locally (`Loaded from Supabase` in console)
- [ ] Values from `.env.local`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Step-by-step: Vercel + free URL

### Step 1 — Push code to GitHub

If not already on GitHub:

1. Create a repo at [github.com/new](https://github.com/new) (e.g. `RunItBack`).
2. In your project folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/RunItBack.git
git push -u origin main
```

### Step 2 — Create a Vercel account

1. Go to [vercel.com](https://vercel.com).
2. Sign up with **GitHub** (easiest).

### Step 3 — Import the project

1. Vercel dashboard → **Add New…** → **Project**.
2. **Import** your `RunItBack` GitHub repo.
3. Framework preset: **Vite** (should auto-detect).

### Step 4 — Build settings

Confirm:

| Setting | Value |
|---------|--------|
| Build Command | `npm run build` |
| Output Directory | `build` |
| Install Command | `npm install` |

(`vite.config.ts` uses `outDir: 'build'`, not `dist`.)

### Step 5 — Environment variables (critical)

Before deploying, open **Environment Variables** and add:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://nwdxuozhfonshvwvjcax.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_...` key |

Apply to **Production** (and Preview if you want PR previews).

**Do not** add `sb_secret_` keys here.

### Step 6 — Deploy

Click **Deploy**. Wait ~1–2 minutes.

You get a URL like: `https://runitback-xxxxx.vercel.app`

**Important:** Vite bakes `VITE_*` variables in at **build time**. If you add or change env vars **after** the first deploy, you must **Redeploy** (Vercel → Deployments → ⋯ → Redeploy). A normal page refresh is not enough.

### Step 7 — Smoke test

1. Open the live URL.
2. Browser console → confirm `Loaded from Supabase`.
3. Open a tournament, a player, a game — same data as local.
4. Make a small edit → refresh → change should persist.

### Step 8 — Share (carefully)

Send the URL only to people you trust **until Google auth + RLS (Phase C)**. The publishable key is public in the built app; dev RLS policies allow writes from anyone who can load the site.

---

## Optional: Custom domain later

1. Buy a domain (Namecheap, Google Domains, Cloudflare, etc.).
2. Vercel → Project → **Settings** → **Domains** → add domain.
3. Follow DNS instructions (usually one CNAME record).
4. HTTPS is automatic.

No code changes required.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page after deploy | Check Vercel build logs; confirm Output Directory is `build` |
| “Supabase is not configured” | Env vars missing or wrong names (`VITE_` prefix required) |
| Data doesn’t load | Wrong Supabase URL/key; check browser console |
| Old data shows | Hard refresh (`Cmd+Shift+R`); confirm same Supabase project as local |
| Build fails on Vercel | Run `npm run build` locally first; fix errors |

---

## After deploy (your roadmap)

1. Use free `.vercel.app` URL for you + teammates (private).
2. Add sync indicator + exports (quality of life).
3. **Phase C:** Google auth + lock down Supabase RLS before going public.
4. Optional custom domain.

---

## Executor tasks (when Human says “Executor, deploy”)

- [ ] Verify `npm run build` passes locally
- [ ] Add `vercel.json` only if needed (SPA routing not required today — no React Router paths)
- [ ] Human completes Vercel UI steps above
- [ ] Document final production URL in scratchpad
