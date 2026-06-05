# RunItBack Scratchpad (Cleaned - Mode B)

## 1) Project Snapshot (Current Truth)

- App: Basketball stats tracking web app (React + TypeScript + Vite).
- Data: Supabase-backed in production/local when env vars are present; localStorage fallback remains.
- Hosting: Vercel production deployed and working.
- Routing: URL-based routing implemented (slug + stable id, tab query params).
- Auth: Phase C (Google auth + strict RLS) intentionally paused until later.

### Current stack
- Frontend: React 18, TypeScript, Vite.
- UI: Radix/shadcn-style components.
- Persistence: Supabase Postgres via `@supabase/supabase-js`.
- Import tooling: local backup JSON -> Supabase script.

### Current production posture
- Production URL is live and working.
- Because auth is paused, do not broadly publicize URL yet.

---

## Refresh performance (Designer, 2026-06-02)

### Background and Motivation

User reports refresh takes a few seconds before UI appears.

Current app blocks render on full cloud bootstrap (`isDataLoading` gate) and waits for:

- `teams`
- `players`
- `team_players`
- `tournaments`
- `tournament_teams`
- `games`
- `app_preferences`

Then it builds in-memory maps/joins before first paint.

### Assumptions to challenge

1. **“Network is the only bottleneck”** — likely false; payload parse + mapping cost can be material with large `games` JSON.
2. **“Need all entities before first paint”** — false for home shell; many screens can lazy-hydrate.
3. **“One optimized query fixes it”** — partial; biggest UX win usually comes from *showing cached snapshot immediately*.

### Candidate solutions (ranked by ROI)

| Option | What changes | Expected UX impact | Risk |
|--------|--------------|--------------------|------|
| **P1 Local snapshot + stale-while-revalidate** | Render last good dataset from localStorage/session immediately, then fetch cloud and reconcile | **Largest perceived speedup** (instant paint) | Reconcile bugs if schema drift |
| **P2 Route-level lazy hydration** | Load minimal dashboard shell first; defer heavy `games` details for non-visible routes | High | More plumbing in route/data ownership |
| **P3 Query shaping/pagination** | Reduce initial `games` payload (e.g., recent N for dashboard) and fetch full history on demand | Medium-high | Requires careful cache strategy |
| **P4 Runtime profiling + memo tuning** | Instrument load phases + optimize mapping hotspots | Medium | Could over-optimize wrong stage without metrics |
| **P5 Bundle split** | Code-split heavy routes/charts and lazy-load | Medium | Build/routing complexity |

### Recommended phased plan

#### Phase A (fastest win, low product risk)

1. Add **load-phase timing logs** (`loadAppDataFromSupabase` start/end and per-query timing).
2. Add **local snapshot cache** of normalized app state + schema version + timestamp.
3. On refresh:
   - If snapshot exists and version matches: render immediately.
   - Fire cloud fetch in background.
   - Replace state on success; keep old + banner on failure.

**Success criteria**
- First meaningful paint under ~300ms on repeat refresh (warm cache)
- Cloud sync still updates within normal network time
- No data loss/corruption in save path

#### Phase B (if still slow on cold load)

4. Split bootstrap into:
   - `loadCoreData` (teams/tournaments/prefs)
   - `loadHeavyData` (games + optional details)
5. Load dashboard with core, progressively hydrate heavy sections.

**Success criteria**
- Cold refresh: visible shell fast, data sections fill progressively
- No route regressions

#### Phase C (structural)

6. Route-level/lazy query strategy for game history and charts.
7. Optional server-side pre-aggregation endpoints for dashboard cards.

### Data integrity safeguards

- Snapshot includes `schemaVersion` + `updatedAt`; invalidate on mismatch.
- Keep existing cloud save as source of truth.
- Never overwrite newer cloud data with stale snapshot.

### High-level task breakdown (Executor)

| Step | Task | Success criteria |
|------|------|------------------|
| **PF.1** | Add load timing instrumentation | Console shows query + transform timings |
| **PF.2** | Add versioned local snapshot read path | Refresh shows UI immediately on warm cache |
| **PF.3** | Add background revalidate + merge/update banner | Snapshot replaced after cloud load |
| **PF.4** | Verify no save regressions + build/test pass | Manual QA + no lint/build errors |
| **PF.5** | Optional cold-load split if needed | Faster time-to-shell on empty cache |

### User decisions (2026-06-02)

| Question | Answer |
|----------|--------|
| Stale OK on refresh? | **Yes** |
| Freshness policy | **Designer recommendation** (see below) |
| Users | Mostly **single-user** now; **multi-user later** |
| On fetch failure | **Retry** (keep showing last good data while retrying) |
| UX pattern | **Immediate shell + progressive sections**; “Updating…” OK |
| Priority screens | **Dashboard** → Team page → Recent games; **current route** wins on deep link |
| Target | **&lt;1s** to usable UI |
| Offline mode | **Not required** |
| Engineering depth | **Designer picks** best ROI path |

### Stale window — industry context (recommendation)

There is no single NBA-style rule for a stats archive app. Common patterns:

| App type | Typical “show stale” behavior |
|----------|-------------------------------|
| Live scores | 5–30s before forcing refresh |
| News / dashboards | 30s–5min; background poll |
| Internal tools / CRM | Minutes to hours; refresh on navigation |
| **Your app (historical box scores, single editor)** | **Instant snapshot + background sync** |

**Recommended policy for RunItBack:**

1. **On refresh:** always paint from **last local snapshot** immediately (no wait).
2. **Background:** fetch full league from Supabase; swap state when done (&lt;3s typical).
3. **“Stale” label:** only if snapshot age **&gt; 60s** *and* sync still in flight — show subtle “Updating…” (not scary).
4. **Trust line (optional):** “Synced just now” / “Couldn’t sync — retrying” in header when useful.
5. **Future multi-user:** add `league_updated_at` or row versions later; on conflict, **cloud wins** after successful fetch (simplest v1).

This hits **&lt;1s perceived load** on repeat visits while staying honest. True cold load (first visit, no cache) may still take 2–4s until we add Phase B split queries.

### Approved architecture (Executor path)

**Pattern:** Stale-while-revalidate (SWR) + route-aware hydration priority.

```
Refresh
  ├─ Read versioned snapshot from localStorage → set state → isDataLoading=false (<300ms goal)
  ├─ Render shell + current route skeleton filled from cache
  ├─ Parallel: loadAppDataFromSupabase() with timing logs
  │     └─ On success: replace state, write new snapshot, clear “Updating…”
  │     └─ On failure: keep cache, show banner, exponential retry (e.g. 2s, 5s, 10s)
  └─ Optional Phase B: split games payload / lazy load non-dashboard routes
```

**Route priority on hydrate (after cache paint):**

1. Current URL (team/tournament/game if deep-linked)
2. Dashboard aggregates (recent games, standings teasers)
3. Rest of league in background

**Out of scope for v1:** true offline mode, WebSocket live sync.

### High-level task breakdown (updated)

| Step | Task | Success criteria |
|------|------|------------------|
| **PF.1** | Instrument `loadAppDataFromSupabase` (per-query ms + total) | Dev console shows breakdown |
| **PF.2** | `appDataSnapshot.ts`: versioned save/load of `{ teams, tournaments, games, darkMode, savedAt }` | Repeat refresh paints without waiting on network |
| **PF.3** | App bootstrap: cache-first, then revalidate; `syncStatus`: idle \| syncing \| error | No full-screen block when cache exists |
| **PF.4** | Header/banner: “Updating…” / retry on failure | User sees progress; failed sync retries |
| **PF.5** | Write snapshot after successful cloud load + after local saves | Cache stays fresh |
| **PF.6** (if cold load still &gt;1s) | Split initial fetch: core vs games list metadata | Dashboard usable before all gameStats parsed |

**Designer confidence: 95%** — matches user goals and single-user reality; PF.6 only if metrics show cold path still slow.

**Status (Executor 2026-06-02):** PF.1–PF.5 implemented.

- `src/lib/appDataSnapshot.ts` — versioned localStorage snapshot + `processLoadedAppData`
- `loadAppDataFromSupabase` — per-phase timing logs (`[RunItBack] loadAppDataFromSupabase`)
- `App.tsx` — cache-first paint, background cloud revalidate, retry backoff (2s/5s/10s), “Updating…” / sync error banners
- Snapshot refreshed after successful cloud load and after successful auto-save

**Project Status Board:** [x] PF.1–PF.5 — [ ] PF.6 only if cold load still slow after user QA

---

## 2) Active Plan (Now)

### **C6 — Team icon image: create/edit UI + real logos for existing teams (Designer, 2026-05-31)**

User request: When **creating** or **editing** a team, allow setting an **icon image**. Also add icons for **all existing teams** based on real-world university/institute logos.

#### Current state (Designer analysis)

| Area | Today |
|------|--------|
| **DB** | `teams.icon` column exists (`text`, nullable) — already persisted via `supabaseData.ts` ✅ |
| **`Team.icon` type** | `icon?: string` on `Team` — overloaded: demo seed uses **emoji** (`⚡`, `🦅`); no image URLs in production teams |
| **`TeamForm`** (Team Manager create/edit) | Name + abbreviation + tournaments only — **no icon field** |
| **`TournamentPage` create-team dialog** | Name + abbreviation + description — **no icon field** |
| **`TeamAvatar`** | Always `AvatarFallback` with abbreviation — **never renders image**, even if URL stored |
| **`getTeamAvatarLabel()`** | Treats short `icon` as text label (conflicts with image URLs if we store paths) |
| **Hardcoded logos** | `getTeamLogo()` name→Unsplash maps in `GameSummary`, `TournamentPage`, `RecentGames` — **demo teams only**, not wired to `team.icon` |

**Existing real teams (from imports / IDs):**

| Team ID | Name | Abbr |
|---------|------|------|
| `team-sunig-ntu` | Nanyang Technological University | NTU |
| `team-sunig-nus` | National University of Singapore | NUS |
| `team-sunig-suss` | Singapore University of Social Sciences | SUSS |
| `team-sunig-sutd` | Singapore University of Technology and Design | SUTD |
| `team-sunig-sit` | Singapore Institute of Technology | SIT |
| `team-ivp-np` | Ngee Ann Polytechnic | NP |
| `team-ivp-ite` | Institute of Technical Education | ITE |
| `team-ivp-sim` | Singapore Institute of Management | SIM |

Plus demo teams in seed data (Thunder Bolts, etc.) — emoji icons OK to keep or replace with generic ball.

#### Product decisions (Designer recommendation)

1. **Semantic split for `team.icon`:**
   - Store **image reference only** in `icon`: HTTPS URL, site-relative path (`/team-logos/ntu.png`), or `data:image/...` from local file pick.
   - Add helper `isTeamIconImage(value)` — true if URL/path/data-URI; false if emoji/short text (legacy).
   - **`TeamAvatar`:** if image → `AvatarImage`; else → abbreviation fallback (current behavior).
   - Stop using `icon` as abbreviation substitute when value is an image URL.

2. **Create/edit UX (Team Manager + Tournament create-team):**
   - New **`TeamIconField`** shared component:
     - Preview (circle, same as `TeamAvatar`)
     - **Upload image** (file input: PNG/JPG/WebP/SVG, max ~500KB)
     - **Remove** button to clear icon
     - Optional **URL** text input (advanced) for external logo URL
   - **MVP storage (no Supabase Storage bucket yet — auth paused):**
     - On file select: read as **data URL** OR copy into **`public/team-logos/`** at build time for bundled defaults; user uploads persist as **data URL in `teams.icon`** for now *(simple, works with existing text column)*.
     - **Designer prefers data URL for user uploads** in MVP — avoids new infra; bundled real logos use **static paths** `/team-logos/{id}.png`.
   - **Later (optional):** Supabase Storage bucket `team-icons` when auth lands.

3. **Real logos for existing teams:**
   - Add **`public/team-logos/`** (or `src/assets/team-logos/` + Vite import map) with one PNG/SVG per institute.
   - One-time **`scripts/seed-team-icons.ts`** (or SQL patch): set `teams.icon = '/team-logos/team-sunig-ntu.png'` etc. for the 8 real teams.
   - **Copyright note:** Official university logos are trademarked. Executor should use **user-provided assets** or **Wikimedia Commons / official brand kit downloads**; document sources in `src/assets/team-logos/ATTRIBUTION.md`. Do **not** hotlink random CDN URLs in production.
   - **If logos not available at implementation time:** ship UI + paths; user drops PNG files into folder before running seed script.

4. **Remove duplication:**
   - Delete/replace hardcoded `getTeamLogo()` maps — use **`TeamAvatar`** everywhere (GameSummary header, TournamentPage, RecentGames, Dashboard game preview if applicable).

5. **Scope:**

   | In scope | Out of scope (later) |
   |----------|----------------------|
   | TeamForm create + edit | Player picture upload |
   | TeamManager wiring | Tournament icon upload |
   | TournamentPage create-team dialog | Image cropping editor |
   | TeamAvatar image render | Supabase Storage (unless user asks) |
   | Seed script + bundled logos for 8 teams | Auto-fetch logos from web |

#### Proposed implementation

**1) Utils — `src/utils/teamIcon.ts`**

```typescript
isTeamIconImage(icon?: string): boolean
resolveTeamIconSrc(icon?: string): string | undefined  // for <img src>
```

**2) `TeamAvatar.tsx`**

- Import `AvatarImage`
- If `resolveTeamIconSrc(team.icon)` → show image + abbreviation fallback on error

**3) `TeamIconField.tsx`**

- Props: `value`, `onChange`, `teamName` (preview alt text)
- File pick → validate type/size → `onChange(dataUrlOrPath)`
- Clear button

**4) `TeamForm` + `TeamFormValues`**

- Add `icon?: string`
- `initialIcon` prop for edit mode
- Include icon in submit payload

**5) `TeamManager` + `App.handleCreateTeam` / `handleUpdateTeam`**

- Pass `icon` through create/update (already on `Team` type; ensure not stripped)

**6) `TournamentPage` create-team**

- Add `TeamIconField` or reuse abbreviated form section

**7) Assets + seed**

- `public/team-logos/*.png` (8 files)
- `scripts/seed-team-icons.ts` → update Supabase `teams.icon` for known IDs
- `public/team-logos/ATTRIBUTION.md` — source links

**8) Cleanup**

- Replace `getTeamLogo` usages with `TeamAvatar team={...}`

#### High-level task breakdown (Executor — one step at a time)

- [ ] **C6.1 — `teamIcon.ts` helpers + `TeamAvatar` image support**
  - Success: team with `icon: '/team-logos/ntu.png'` shows image; without icon shows NTU text.
- [ ] **C6.2 — `TeamIconField` + wire `TeamForm` (create + edit)**
  - Success: upload/clear/URL works; edit pre-fills current icon.
- [ ] **C6.3 — Wire `TeamManager` + Tournament create-team**
  - Success: icon persists to Supabase on save.
- [ ] **C6.4 — Bundle logo assets + seed script for 8 existing teams**
  - Success: all real teams have icons in DB; attribution file present.
- [ ] **C6.5 — Replace hardcoded `getTeamLogo` with `TeamAvatar`**
  - Success: Game Summary / Tournament / Recent Games use `team.icon`.
- [ ] **C6.6 — Manual QA**
  - Create team with upload; edit change/remove; existing NTU/SUTD show logos.

#### Success criteria (Designer sign-off)

- Create and edit team flows include icon image option with preview.
- `TeamAvatar` displays image when `icon` is set, abbreviation otherwise.
- All 8 Singapore uni/poly teams have real logos visible across app.
- No duplicate hardcoded logo maps for demo Unsplash URLs.
- Build passes; icons persist after refresh (Supabase).

#### Open questions for user (before Executor)

1. **Logo files:** Can you provide PNG/SVG logo files for NTU, NUS, SUSS, SUTD, SIT, NP, ITE, SIM? *(Executor can use placeholders + seed paths if not — you drop files in `public/team-logos/`.)*
2. **Upload storage:** OK with **data URLs in DB** for user-uploaded icons for now, vs setting up Supabase Storage immediately?

**Designer confidence: ~90%** — UI/avatar path is clear; logo asset sourcing is the main dependency.

---

### **C6.7 — Team logo warping / aspect ratio fix (Designer, 2026-05-31)**

User report: NTU coat-of-arms logo looks **deformed/warped** in team avatars (Team Manager, team page, game summary, etc.).

#### Root cause (Designer analysis)

| Factor | Finding |
|--------|---------|
| **NTU asset aspect ratio** | `team-sunig-ntu.png` is **795×1024** (tall heraldic shield), not square |
| **`TeamAvatar` intent** | Uses `object-contain` on `AvatarImage` to preserve aspect ratio |
| **Actual CSS** | **`object-contain` is NOT in compiled `index.css` / build CSS** — only `.object-cover` exists. Tailwind v4 did not emit the utility despite use in `TeamAvatar.tsx` |
| **Default `object-fit`** | **`fill`** — image is **stretched** to fill the square/circle box → shield looks squashed |
| **Container shape** | `rounded-full` circle clips a tall shield awkwardly even when contain works — secondary UX issue |

**Primary bug:** missing effective `object-fit: contain`.  
**Secondary UX:** circles are a poor frame for tall crest/shield logos.

#### Product decisions (Designer recommendation)

1. **Fix stretch first (required):** Ensure logo images **never** use default fill.
   - Prefer **`style={{ objectFit: 'contain' }}`** on `TeamAvatar`'s image (reliable, no Tailwind purge issue), **or** add explicit `.object-contain { object-fit: contain; }` to CSS / safelist.
   - Do **not** change global `AvatarImage` for player photos — **TeamAvatar only**.

2. **Shape for logo vs abbreviation (recommended):**
   - **When showing image:** `rounded-lg` (or `rounded-md`) **square** container — crest reads naturally, no circular squeeze.
   - **When showing abbreviation fallback:** keep `rounded-full` circle (current text avatars).
   - Single component `TeamAvatar` toggles shape by `showImage`.

3. **Padding:** `p-1` or `p-1.5` inside logo container so crest doesn't touch edges (especially at `sm` size).

4. **Optional asset trim:** Re-export NTU PNG with tighter crop / square canvas — nice-to-have, not required if contain + padding work.

**User feedback (2026-05-31):** Option 2 still ugly everywhere → **revised approach D+C (approved):**

- **D — Context split:** New `TeamLogo` (natural-aspect `<img>`, fixed height + auto width) for **team page header** + **icon upload preview** only. `TeamAvatar` = **abbreviation circle only** everywhere else (Manager, Dashboard, games, tournaments).
- **C — Clean asset:** NTU JPEG-with-.png-extension converted to **true RGBA PNG** with near-black background made transparent (Pillow script).

#### Task breakdown (revised)

- [x] **C6.7.4 — `TeamLogo` component + context split** ✅ Executor 2026-05-31
- [x] **C6.7.5 — Simplify `TeamAvatar` to abbreviation-only circles** ✅ Executor 2026-05-31
- [x] **C6.7.6 — NTU asset → transparent PNG** ✅ Executor 2026-05-31
- [ ] **C6.7.7 — User QA** — team page header, Team Manager (NTU = "NTU" circle), game rows, icon upload preview

5. **Scope:** `TeamAvatar.tsx` only (+ remove conflicting `object-cover` img usages on TournamentPage/RecentGames that still bypass TeamAvatar for demo Unsplash logos — separate cleanup).

#### Proposed implementation

**`TeamAvatar.tsx`**

```tsx
// Image mode
<Avatar className={cn('rounded-lg', sizeClasses[size], ...)}>
  <AvatarImage
    className="size-full p-1.5 bg-background"
    style={{ objectFit: 'contain' }}
  />
</Avatar>

// Fallback mode — rounded-full circle, abbreviation text
```

Consider overriding `Avatar` root `rounded-full` from ui/avatar when image shown via `className="!rounded-lg"` or split inner wrapper.

**Verify:** NTU at sm/md/lg/xl — shield proportional, not stretched; Team Manager card + team page header + game summary.

#### High-level task breakdown (Executor)

- [x] **C6.7.1 — Fix object-fit (contain) in `TeamAvatar`** ✅ Executor 2026-05-29
  - Success: NTU shield not stretched at any size; inspect computed `object-fit: contain`.
  - Done: `style={{ objectFit: 'contain' }}` on `AvatarImage` (Tailwind `object-contain` not in compiled CSS).
- [x] **C6.7.2 — Logo container shape (rounded square for images, circle for fallback)** ✅ Executor 2026-05-29
  - Success: crest looks natural; abbreviation fallback unchanged.
  - Done: `rounded-lg` + `bg-background` on `Avatar` when `showImage`; `rounded-full` on fallback; `p-1.5` padding on image.
- [ ] **C6.7.3 — QA all `TeamAvatar` sizes + hard refresh** (awaiting user)
  - Team Manager, Team page, Dashboard, Game Summary.

#### Success criteria

- NTU coat of arms displays with **correct aspect ratio** (no horizontal/vertical squash).
- Logos readable at Team Manager card size (`lg`).
- Abbreviation-only teams still show circular text avatars.

**Designer confidence: ~95%** — root cause identified; small focused fix.

**Status:** C6.7 approaches (rounded square avatar, D+C context split) **rejected by user** — still ugly everywhere. Superseded by **C6.8 SofaScore pattern** below.

---

### **C6.8 — SofaScore-style team badges (Designer, 2026-05-31)**

User request: Analyse how **SofaScore** displays team logos and implement the same pattern here. **Designer mode** — plan only; Executor after approval.

#### How SofaScore does it (analysis)

SofaScore treats team logos as **normalized badge images in fixed square slots** — not profile avatars, not natural-aspect free-floating images.

| SofaScore pattern | Detail |
|-------------------|--------|
| **Same logo everywhere** | Match list, standings, team header, event scoreboard — all show the **real badge** at different sizes. Logos are never hidden in compact rows. |
| **Fixed square bounding box** | Every badge sits in a **square container** (`24×24`, `32×32`, `48×48`, `64×64` depending on context). Container size is constant per context; logo scales inside it. |
| **Flex center + contain** | Container uses `display: flex; align-items: center; justify-content: center`. Image uses **`width: 100%; height: 100%; object-fit: contain`** so aspect ratio is preserved without distortion. |
| **Square, not circle** | Football badges are **not** clipped to circles. Shape is square (sometimes imperceptibly rounded corners on dark theme). |
| **No visible frame** | No border ring on the badge box — logo sits on page/card background. Optional neutral placeholder when missing. |
| **Normalized PNG assets** | CDN logos (`img.sofascore.com`) are **PNG, transparent background**, pre-processed so crests fill the square frame consistently. Torneo admin requires **PNG-only** uploads. |
| **Missing logo fallback** | Generic **neutral shield silhouette** in the **same square dimensions** — not a colored abbreviation circle. |

**Visual model (match row):**

```
┌────┐  Team Name                    72
│ 🛡 │  Opponent Name                65
└────┘
 24px square — logo centered, contain
```

**Visual model (event header / team page):**

```
     ┌──────┐                    ┌──────┐
     │ logo │        72 – 65     │ logo │
     └──────┘                    └──────┘
       48–64px square slots, same contain rules
```

#### Why our C6.7 approaches failed (honest post-mortem)

| Our attempt | SofaScore would never do this | Why it looked bad |
|-------------|------------------------------|-------------------|
| Radix `Avatar` + circle/square toggle | Uses plain div + img, not Avatar | Wrong component metaphor (people vs institutions) |
| Context split (logo header only, abbrev elsewhere) | Logo **everywhere** | NTU crest missing in lists; inconsistent identity |
| Natural-aspect `<img>` on header | Fixed square at all sizes | Misaligned with title row; tall shield floats awkwardly |
| Auto background removal on raw JPEG | Curated PNG assets | Halos, dark remnants, non-transparent source |
| Tall 795×1024 PNG without square canvas | Assets normalized to square | Shield appears tiny inside square slot (letterboxing) |

**Root insight:** SofaScore's polish is **50% CSS pattern + 50% asset normalization**. Fixing CSS alone (C6.7) was never enough with our raw heraldic shield asset.

#### Product decision (Designer recommendation — approved direction)

Adopt the **SofaScore badge model** end-to-end:

1. **One component: `TeamBadge`** — replaces both `TeamAvatar` and `TeamLogo`.
2. **Fixed square box** per size token; flex-center; `object-fit: contain` via **inline style** (Tailwind `object-contain` not reliably compiled).
3. **Show logo at all sizes** when `team.icon` / bundled path resolves — match list, Manager, Dashboard, game header, team page.
4. **Fallback:** square placeholder with abbreviation text + existing team color tint (practical stand-in for SofaScore's grey shield until we add a generic SVG).
5. **Asset pipeline:** normalize uploads + bundled logos to **square RGBA PNG** with transparent bg and ~8–10% padding inset (scripted, repeatable).
6. **Do not use** Radix `Avatar` for team logos — keep Avatar for **players only**.

#### Size tokens (map to existing call sites)

| Token | Box | Current usage |
|-------|-----|---------------|
| `xs` | 16×16 | Tournament standings (sm today) |
| `sm` | 20×20 | Player page team ref |
| `md` | 24×24 | Dashboard game preview, tournament team lists |
| `lg` | 32×32 | Team Manager cards |
| `xl` | 48×48 | Game Summary scoreboard |
| `hero` | 64×64 | Team page header / overview card |
| `preview` | 64×64 | TeamIconField upload preview |

Alias existing `header` → `hero`, `xl` in GameSummary → `xl` (48px).

#### Component spec: `TeamBadge`

```tsx
// src/components/TeamBadge.tsx
<div
  className={cn('flex shrink-0 items-center justify-center', sizeBoxClasses[size])}
  aria-hidden={!iconSrc} // fallback still shows abbrev
>
  {iconSrc && !failed ? (
    <img
      src={iconSrc}
      alt=""
      className="size-full"
      style={{ objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={cn('flex size-full items-center justify-center rounded-sm font-semibold', labelClass)}>
      {label}
    </div>
  )}
</div>
```

- **No border** on logo mode (SofaScore-clean).
- **Fallback:** `rounded-sm` square (not `rounded-full`), reuse `getTeamAvatarLabel` + `getTeamAvatarLabelClass`.
- Optional later: swap fallback for `/team-logos/placeholder-shield.svg`.

#### Asset pipeline: `scripts/normalize-team-icon.ts`

Input: any PNG/JPEG in `public/team-logos/` or upload buffer.

Steps:
1. Convert to RGBA.
2. Remove near-black background (threshold ~50, tunable per asset).
3. Trim to content bounding box.
4. **Pad to square canvas** — longest side + 10% inset padding (key SofaScore-like step).
5. Export PNG to `public/team-logos/{teamId}.png`.
6. Update `BUNDLED_TEAM_ICONS` + run `npm run seed:team-icons`.

**NTU first:** Re-process `team-sunig-ntu.png` → square ~512×512 transparent PNG.

#### Files to change (Executor)

| Action | File |
|--------|------|
| **Create** | `src/components/TeamBadge.tsx` |
| **Create** | `scripts/normalize-team-icon.ts` + `npm run normalize:team-icon` |
| **Delete / deprecate** | `TeamLogo.tsx`; slim `TeamAvatar.tsx` → re-export `TeamBadge` or remove |
| **Replace imports** | `GameSummary`, `DashboardGamePreview`, `Dashboard`, `TeamManager`, `TeamPage`, `TournamentPage`, `PlayerPage`, `TeamIconField` |
| **CSS belt** | Add `.object-contain { object-fit: contain; }` to global CSS (one line, prevents future Tailwind gap) |
| **Asset** | Re-normalize NTU PNG |
| **Copy** | `TeamIconField` help text → "Shown as badge across the app (SofaScore-style square slot)" |

#### High-level task breakdown (Executor — one step at a time)

- [x] **C6.8.1 — `TeamBadge` component + size tokens** ✅ Executor 2026-05-31
- [x] **C6.8.2 — `normalize-team-icon.py` + re-process NTU asset** ✅ Executor 2026-05-31
  - NTU → 512×512 RGBA square PNG via `npm run normalize:team-icon`
- [x] **C6.8.3 — Replace all `TeamAvatar` / `TeamLogo` usages with `TeamBadge`** ✅ Executor 2026-05-31
  - Removed `TeamAvatar.tsx`, `TeamLogo.tsx`; removed Unsplash `getTeamLogo` hacks in TournamentPage + RecentGames
- [x] **C6.8.4 — Global `.object-contain` CSS + build verify** ✅ Executor 2026-05-31
- [ ] **C6.8.5 — User QA**
  - Team page header, Team Manager, Dashboard game card, Game Summary, tournament standings — NTU badge proportional, no black box, same visual language everywhere.

#### Success criteria (Designer sign-off)

- Team logos use **fixed square slots + contain** at every size (SofaScore pattern).
- NTU crest readable at `md` (24px) and `hero` (64px) without stretch or opaque background box.
- Teams without logos show **square** abbreviation fallback (not circle).
- One component (`TeamBadge`); no context split between header vs lists.
- Build passes; NTU asset normalized to square transparent PNG.

#### Out of scope (C6.8)

- Logos for other 7 institutes (NUS, SUSS, etc.) — same pipeline when assets provided.
- Generic shield SVG fallback — nice-to-have after C6.8.5 passes.
- Supabase Storage migration for uploads — unchanged from C6.

**Designer confidence: ~92%** — pattern is well-established in sports apps; remaining risk is NTU crest quality after square normalization (may need manual asset touch-up).

**Awaiting user approval to proceed in Executor mode.**

---

### **C5 — Game page: clickable team names → Team page (Designer, 2026-05-31)**

User request: On **Game pages**, clicking **team names** should navigate to that team's page.

#### Current state (Designer analysis)

| Location | Team names today | Navigation |
|----------|------------------|------------|
| **`/games/:gameId` — `GameSummary`** | Home/away names in main matchup card (`<h3>`) | Plain text — **not clickable** |
| **`GameLeadersSection`** | N/A | Player names already clickable ✅ |
| **`BoxScore`** (tab) | Mini scoreboard + per-table `{teamName}` headers + tab triggers | Plain text; tab triggers switch view only |
| **`TeamStats`** (tab) | Tab triggers + pie chart / detail headers use `teamName` | Plain text |
| **`GameSummaryRoute`** | Wires `onNavigateToPlayer` only | **No `onNavigateToTeam`** passed |
| **Elsewhere** (Dashboard preview, Tournament games list, Recent Games) | Team names in lists | Out of scope unless user expands — this task is **Game Summary route only** |

**Gap:** Game page team links were deferred when player/tournament links were added (C3 nav work). Pattern already exists on Team/Tournament/Player pages: `onNavigateToTeam(teamId)` + `navigateWithReturnTo` in `AppRoutes`.

#### Product decisions (Designer recommendation)

1. **Scope:** `/games/:gameId` (`GameSummary` + its tabs: Team Stats, Box Score). **Not** live stats entry, dashboard previews, or tournament game lists in this task.
2. **Navigation:** Use existing smart back — `navigateWithReturnTo(navigate, teamPath(team), returnTo)` from `GameSummaryRoute` (same as `PlayerDetailRoute`).
3. **What is clickable:**
   - ✅ **Main matchup card** — home/away **team name** (and optionally logo/avatar area above name)
   - ✅ **Box Score mini scoreboard** — home/away names above the team tabs
   - ✅ **Section headers** inside Box Score / Team Stats that show a single team name (table title, scoring pie title)
   - ❌ **Tab triggers** (`TabsTrigger` with team name) — keep as **tab switch only**; combining tab switch + navigate on same click is confusing. User can click the header names instead.
4. **Reuse:** Small shared **`GameTeamLink`** (or `ClickableTeamName`) component — `button` styled `hover:text-primary hover:underline cursor-pointer`, takes `teamId`, `teamName`, optional `className`, `children`.
5. **Optional polish:** Replace demo `getTeamLogo` images in header with `TeamAvatar` for consistency — **out of scope** unless trivial; focus on click behavior only.

#### Proposed implementation

**1) `src/components/GameTeamLink.tsx`** (minimal)

```typescript
interface GameTeamLinkProps {
  teamId: string;
  teamName: string;
  onNavigateToTeam: (teamId: string) => void;
  className?: string;
  children?: React.ReactNode;
}
```

**2) `AppRoutes.tsx` — `GameSummaryRoute`**

Add `onNavigateToTeam={(teamId) => { const team = teams.find(...); if (team) navigateWithReturnTo(navigate, teamPath(team), returnTo); }}`

**3) `GameSummary.tsx`**

- Add prop `onNavigateToTeam?: (teamId: string) => void`
- Wrap home/away `<h3>` names (and optionally logo `<img>` wrapper) with `GameTeamLink`
- Pass `onNavigateToTeam` to `BoxScore` and `TeamStats`

**4) `BoxScore.tsx`**

- Add optional `onNavigateToTeam`
- Clickable: mini scoreboard team names; `TraditionalStatsTable` / `AdvancedStatsTable` `<h3>{teamName}</h3>` headers

**5) `TeamStats.tsx`**

- Add optional `onNavigateToTeam`
- Clickable: `ScoringPie` / `TeamDetailView` titles where `teamName` is displayed (not tab triggers)

#### High-level task breakdown (Executor — one step at a time)

- [x] **C5.1 — Add `GameTeamLink` component**
  - Success: renders team name as accessible button with hover link styling.
- [x] **C5.2 — Wire `GameSummaryRoute` → `onNavigateToTeam`**
  - Success: navigation uses `navigateWithReturnTo`; Back from team page returns to game.
- [x] **C5.3 — GameSummary main matchup card**
  - Success: both team names click → correct team pages.
- [x] **C5.4 — BoxScore + TeamStats team name headers**
  - Success: secondary team name labels on game page also navigate; tab triggers unchanged.
- [ ] **C5.5 — Manual QA**
  - Open NTU vs SUSS game → click each team name in header + box score → team pages load; Back returns to game.

#### Success criteria (Designer sign-off)

- All prominent **team name** labels on the Game Summary page navigate to the correct team page.
- Tab switching on Box Score / Team Stats still works normally.
- Smart back navigation preserved.
- Build passes.

**Designer confidence: ~95%** — ready for Executor on user ack.

**Out of scope (unless requested):** Dashboard game preview, Recent Games, Tournament games tab, Live Game Entry.

---

### **C4 — Team/Player header: abbreviation avatar + all participated tournaments (Designer, 2026-05-31)**

User request: Team page shows **"NA"** in the avatar circle instead of **"NTU"** (should use team **abbreviation** when no custom icon). Show **all tournaments** the team participated in as badges (not only `currentTournament` / Sunig 2025). Apply the same logic on **Player pages**.

#### Current state (Designer analysis)

| Location | Avatar / label today | Tournament badges today |
|----------|------------------------|-------------------------|
| **Team page — overview card** | `team.icon \|\| team.name.substring(0, 2)` → **"NA"** for NTU | Single badge: `team.currentTournamentId` only |
| **Team page — sticky header** | Same broken fallback | None |
| **Player page — overview card** | Player initials (correct) | Team name badge + single `currentTournament` badge |
| **Dashboard / game previews** | Uses `TeamAvatar` component ✅ | N/A |
| **`TeamAvatar.tsx`** | `abbreviation` → first 3 chars ✅; fallback name[0:2] | N/A |

**Root cause:** `TeamPage` (and `TournamentPage` standings) **do not use** the existing `TeamAvatar` component and **never read `team.abbreviation`**. NTU has `abbreviation: 'NTU'` in data but UI shows "NA" from name prefix.

**Tournament root cause:** UI binds to `team.currentTournamentId` (one “active” tournament), not the set of tournaments the team actually appears in. `getTeamTournamentScopeOptions()` in `playerSeasonStats.ts` already derives the full set from **completed games + tournament roster membership** — reuse that logic.

#### Product decisions (Designer recommendation)

1. **Single source of truth for team avatar label:** Extend/reuse `TeamAvatar` everywhere; do not duplicate fallback strings.
2. **Avatar label priority (no image icon):**
   - Short text `team.icon` (≤3 chars, e.g. custom monogram) → use as-is
   - Else `team.abbreviation` → show up to **3 chars** in circle (matches existing `TeamAvatar`; NTU → "NTU")
   - Else generated from name (existing `generateTeamAbbreviation` / first 2 letters)
3. **Tournament badges — Team page:** Show **every tournament** the team participated in (games + roster), sorted by name. Each badge clickable → tournament page (existing `onNavigateToTournament`). Use `variant="default"` with trophy icon; wrap in `flex flex-wrap gap-2` when multiple.
4. **Tournament badges — Player page:** Show **every tournament the player has GP in** (from completed games with stats), not team's `currentTournamentId`. Same badge styling + click → tournament page. *(Player may have fewer tournaments than team if they didn't play every game.)*
5. **Remove reliance on `currentTournamentId` for display** on these headers. Keep field in data model for other uses (Game Setup default, etc.) but not for “which badges to show.”
6. **Scope:** Team page + Player page headers in this task. Also fix duplicate avatar fallbacks in `TournamentPage` standings/team lists (same "NA" bug) as a small follow-on in same PR.

#### Proposed implementation

**1) Utils — `src/utils/teamTournaments.ts` (or extend `playerSeasonStats.ts`)**

```typescript
getParticipatedTournamentIds(teamId, games, tournaments): string[]
getParticipatedTournaments(teamId, games, tournaments): Tournament[]  // sorted by name

getPlayerParticipatedTournamentIds(playerId, games): string[]
getPlayerParticipatedTournaments(playerId, games, tournaments): Tournament[]
```

Reuse same ID-gathering as `getTeamTournamentScopeOptions` (games with `tournamentId` + `tournament.teams.includes(teamId)`).

**2) UI — extend `TeamAvatar`**

- Add size `xl` (`w-24 h-24 text-2xl`) for overview headers.
- Optional: support `AvatarImage` later if `icon` is URL — out of scope unless already used.

**3) UI — `ParticipatedTournamentBadges` (small shared component)**

Props: `tournaments: Tournament[]`, `onNavigateToTournament`. Renders 0..N clickable badges. Empty → render nothing.

**4) Wire pages**

| File | Change |
|------|--------|
| `TeamPage.tsx` | Replace 2 inline `Avatar` blocks with `<TeamAvatar size="xl" />`; replace single `currentTournament` badge with `<ParticipatedTournamentBadges tournaments={teamParticipatedTournaments} />` |
| `PlayerPage.tsx` | Replace single `currentTournament` badge with player participated tournaments; optionally show `TeamAvatar size="sm"` beside team badge or badge text `team.abbreviation` — **recommend:** keep team name badge but prefix with small `TeamAvatar` for consistency |
| `TournamentPage.tsx` | Replace `team.name.substring(0, 2)` avatars with `TeamAvatar` (3 sites) |

**5) Data for NTU smoke test**

- Team `team-sunig-ntu`, abbreviation `NTU`
- Tournaments: Sunig 2025 + IVP 2026 (from games + roster)
- Player with both: e.g. Carl → 2 tournament badges; player with Sunig only → 1 badge

#### High-level task breakdown (Executor — one step at a time)

- [x] **C4.1 — Helpers: `getParticipatedTournaments` (team + player)**
  - Success: NTU returns Sunig + IVP; player returns subset from their games.
- [x] **C4.2 — Extend `TeamAvatar` (`xl` size) + `ParticipatedTournamentBadges`**
  - Success: NTU renders "NTU"; badges render list with click handlers.
- [x] **C4.3 — TeamPage: avatar + all tournament badges**
  - Success: overview + header show NTU + both tournament badges.
- [x] **C4.4 — PlayerPage: all player tournament badges (+ team avatar consistency)**
  - Success: player overview shows all played tournaments; team ref uses abbreviation avatar pattern.
- [x] **C4.5 — TournamentPage avatar cleanup (same abbreviation fix)**
  - Success: standings/team lists show NTU not NA.
- [ ] **C4.6 — Manual QA**
  - NTU team page, NTU player with multi-tournament GP, team with no games (roster-only tournament still shows badge).

#### Success criteria (Designer sign-off)

- NTU avatar shows **NTU**, not NA, on team page (overview + header).
- All teams without custom icon use **abbreviation** consistently via `TeamAvatar`.
- Team page lists **all** participated tournaments as clickable badges.
- Player page lists **all** tournaments that player has game stats in.
- Build passes; no change to `currentTournamentId` persistence semantics.

**Designer confidence: ~95%** — ready for Executor on user ack.

**Open question (optional):** On player page, should the team badge show **full name** (today), **abbreviation only** ("NTU"), or **avatar + full name**? Default plan: **small TeamAvatar + full team name** (click → team page).

---

### **C3 — Player page Stats tab: Standard/Advanced toggle (Designer, 2026-05-31)**

User request: Apply the same **Standard / Advanced** stats toggle used on Team and Tournament pages to the **Player Stats** tab on the player page.

#### Current state (Designer analysis)

| Location | What it shows today |
|----------|---------------------|
| **Team / Tournament pages** | `PlayerStatsTable` with Standard/Advanced toggle (C2) — roster rows, sortable, tooltips, MM:SS MPG |
| **Player page → Player Stats tab** | Custom inline `<Table>` — one row **per tournament** + **All Time** footer. Columns: Tournament, GP, MIN (decimal), PTS, REB, AST, STL, BLK, TO, **FDPG**, FG%, 3P%, FT%, EFF, GmSc. **No toggle.** |
| **Player page → Advanced Stats tab** | Separate UI: tournament filter + **shooting breakdown cards** (FG/3PT/FT splits, efficiency summary). **Not** the same as `PlayerStatsTable` Advanced columns. |

**Gap:** Player Stats tab is a one-off table that diverged from C2 column sets (e.g. FDPG in main view, decimal minutes, missing FGM/FGA/FPG/+/- in standard).

#### Product decision (Designer recommendation)

- **Reuse `PlayerStatsTable`** (same columns, toggle, tooltips, MM:SS MPG, Paint/FB warnings) — do **not** duplicate column logic in `PlayerPage`.
- **Row model:** Each row = one **tournament scope** for the current player (not one row per player). Optional **All Time** summary row when filter = "All Tournaments".
- **Keep the existing tournament filter** (`Select`) above the table.
- **Keep the separate "Advanced Stats" tab** for now (shooting breakdown cards). Only the **Player Stats tab** gets the C2 toggle. *(Avoid removing a tab without explicit user ask.)*

#### Proposed implementation

**1) Data layer — `playerSeasonStats.ts`**

Add helper e.g. `buildPlayerTournamentSeasonRows(player, team, games, tournaments)`:

- For each tournament the player has GP in: filter completed games → `aggregatePlayerSeasonStats` scoped to that `tournamentId` → one `PlayerSeasonRow` for this player.
- Attach `scopeLabel: string` (tournament name) on row or parallel map.
- **All Time row:** aggregate all player games → one row with `scopeLabel: 'All Time'`.
- Compute `getShotDataCoverage` / `getFoulStatCoverage` from the **filtered game set** (respect tournament filter).

Extend `PlayerSeasonRow` optionally:

```typescript
scopeLabel?: string; // e.g. "Sunig 2025", "IVP 2026", "All Time"
```

**2) `PlayerStatsTable` extensions (minimal props)**

| Prop | Purpose |
|------|---------|
| `layout?: 'roster' \| 'tournament-breakdown'` | Default `roster` (unchanged). Breakdown mode hides `#`, Team, Pos; first column = scope label not player name. |
| `scopeLabel?: (row) => string` | Returns tournament name for breakdown rows |
| `summaryRowIds?: Set<string>` | Style All Time row (bold / muted bg) — or match existing footer styling |
| `disableRowNavigation?: boolean` | No click → player profile (already on player page) |
| `defaultSortField` / `defaultSortOrder` | Breakdown: sort by GP or scope label, not PPG |

**3) `PlayerPage.tsx` — replace `PlayerStatsTab` custom table**

- Keep tournament filter card.
- Build `PlayerSeasonRow[]` via helper; filter by `selectedTournament`.
- Render `<PlayerStatsTable layout="tournament-breakdown" showTeamColumn={false} disableRowNavigation ... />`.
- When filter = single tournament: show that row only (hide All Time or show same single row — **prefer hide All Time** when redundant).

**4) Column parity with C2**

| View | Columns (same as team/tournament) |
|------|-----------------------------------|
| **Standard** | GP, MPG, PPG, RPG, APG, SPG, BPG, FG%, FGM, FGA, 3P%, 3PM, 3PA, FT%, FTM, FTA, TOPG, FPG, +/-, GmSc, EFF |
| **Advanced** | GP, MPG, FG, 3PT, FT (season totals), ORPG, FDPG, Paint, FB, BA, TF, UF |

Remove legacy mixed column set (FDPG-only in standard, decimal MIN).

#### High-level task breakdown (Executor — one step at a time)

- [x] **C3.1 — Extend `PlayerSeasonRow` + `buildPlayerTournamentSeasonRows()` helper**
  - Success: given a player + games, returns one row per tournament + all-time row with paint/FB totals.
- [x] **C3.2 — Extend `PlayerStatsTable` for `tournament-breakdown` layout**
  - Success: renders scope label column; no player navigation; All Time row styled; build passes.
- [x] **C3.3 — Wire `PlayerStatsTab` to use `PlayerStatsTable` + toggle; remove inline table**
  - Success: Player Stats tab matches team page Standard/Advanced columns and toggle UX.
- [ ] **C3.4 — Manual QA**
  - Player with Sunig + IVP games: filter All / per-tournament; toggle Standard ↔ Advanced; All Time row; MM:SS MPG; Paint/FB show `-` for imported games.

#### Success criteria (Designer sign-off)

- Player Stats tab has **Standard / Advanced** buttons identical to team/tournament pages.
- Column sets match C2 exactly (no duplicate custom columns).
- Tournament filter + All Time row still work.
- Advanced Stats **tab** unchanged (shooting cards remain).

#### Open question for user (optional before Executor)

The player page already has a top-level **"Advanced Stats"** tab (shooting breakdown cards). After C3, **Player Stats → Advanced** will show ORPG, FDPG, Paint, etc. Is that overlap OK, or do you want to rename/remove the old Advanced Stats tab later?

**Designer confidence: ~95%** — ready for Executor on user ack (default: keep both tabs).

---

### **IVP1 — IVP 2026 full season import (5 games) (Designer, 2026-05-31)**

User request: Import **5 IVP 2026 box scores** from `Importingboxscores/ivp 2026/` (PDFs only — JSON not yet created). Add **3 new NTU players**. Set starters + start times per game. Follow Sunig 2025 import conventions.

#### Source material (Designer verified from PDFs)

| # | Date | Matchup (PDF) | Final | NTU | Home | Start | NTU starters (user) |
|---|------|---------------|-------|-----|------|-------|---------------------|
| 1 | 2026-01-13 | NP 70 – 80 NTU | 80–70 | W | **NTU** | 19:15 | Jingjie, Louis, Minghui, Glen, Carl |
| 2 | 2026-01-20 | SUSS 49 – 96 NTU | 96–49 | W | **NTU** | 20:45 | Minghui, Jeremy, Haniel, Sunzhe, Kovan |
| 3 | 2026-01-23 | ITE 54 – 89 NTU | 89–54 | W | **NTU** | 20:45 | Jingjie, Chengshan, Jeremy, Khaimun, Carl |
| 4 | 2026-01-26 | SIM 51 – 74 NTU | 74–51 | W | **SIM** | 21:25 | Jingjie, Chengshan, Minghui, Glen, Carl |
| 5 | 2026-01-28 | NP 69 – 90 NTU | 90–69 | W | **NTU** | 20:45 | Jingjie, Chengshan, Darren, Glen, Carl |

PDFs contain **NTU player lines only** (same pattern as Sunig) — opponent box scores not tracked; `trackBothTeams: false`.

#### New NTU players (user)

| Name | Pos | # | Profile |
|------|-----|---|---------|
| Glen Yeo | PF/C | 11 | (no height/weight/DOB given) |
| Haniel Muze | SF/PF | 12 | **Conflicts with Yuanyang Tan (#12, Sunig)** — user says OK across tournaments |
| Lucas Hoo | SG/SF | 23 | 185 cm, 80 kg, DOB 3 Feb 2004 |

Proposed player IDs (distinct from Sunig ids):
- `player-ivp-ntu-11` — Glen Yeo
- `player-ivp-ntu-12` — Haniel Muze *(not `player-sunig-ntu-12` = Yuanyang)*
- `player-ivp-ntu-23` — Lucas Hoo

Existing NTU players reuse **`player-sunig-ntu-*`** ids (already in Supabase from Sunig imports).

#### Existing player ↔ jersey map (IVP PDFs)

| # | App name | Existing id |
|---|----------|-------------|
| 0 | Shawn Lee | player-sunig-ntu-0 |
| 1 | Jingjie Lim | player-sunig-ntu-1 |
| 4 | Louis Ho | player-sunig-ntu-4 |
| 6 | Daniel Delin | player-sunig-ntu-6 *(appears G2/G3, not in starter lists)* |
| 8 | Chengshan Tan | player-sunig-ntu-8 |
| 10 | Jeremy Chew | player-sunig-ntu-10 |
| 14 | Khaimun Ng | player-sunig-ntu-14 |
| 15 | Darren Ng | player-sunig-ntu-15 |
| 20 | Minghui Pan | player-sunig-ntu-20 |
| 21 | Kovan Toh | player-sunig-ntu-21 |
| 22 | Carl Belanger | player-sunig-ntu-22 |
| 45 | Sunzhe Lew | player-sunig-ntu-45 |

PDF name variants: "Jing Jie" → Jingjie, "Cheng Shan" → Chengshan, "Lucas" → Lucas Hoo.

#### Proposed import strategy (pending user confirm)

1. **Game 1 JSON** — full import (**no** `--stats-only`): upsert 3 new players + opponent shell `team-ivp-np`; preserve existing NTU profile fields via merge logic.
2. **Games 2–5** — `--stats-only`: game stats + team totals only; **never overwrite** player profiles.
3. Create 5 JSON files mirroring Sunig structure under `Importingboxscores/ivp 2026/`.
4. Minutes: PDF `MM:SS` → decimal minutes (e.g. `26:12` → `26.2`).
5. Extend import script to accept optional `dateOfBirth` on player rows (for Lucas).

#### Code changes likely required

| Area | Change |
|------|--------|
| **Duplicate jersey #12** | Relax `isNumberTaken` in TeamPage, TeamManager, PlayerPage, GameSetup — allow same # on one roster if different player ids *(DB has no unique constraint on team+number)* |
| **import-boxscore.ts** | Support `dateOfBirth` in player JSON; optional `--add-players-only` or game-1 full import for new players |
| **Tournament teams junction** | Ensure IVP tournament linked to NTU + all 4 opponents (+ NUS if user wants) |

#### High-level task breakdown (Executor — after user Q&A)

- [x] **IVP1.0 — User confirms open questions**
- [x] **IVP1.1 — Code: `--add-new-players`, DOB, duplicate jersey UI**
- [x] **IVP1.2 — Create 5 JSON files + import game 1**
- [x] **IVP1.3 — Import games 2–5 stats-only**
- [x] **IVP1.4 — Verified: 3 new players; 15 existing NTU profiles unchanged; 5 games in Supabase**
- [ ] **IVP1.5 — User QA gate**

#### Open questions for user (need answers before Executor)

**Q1 — Same NTU team entity?**  
Should IVP use the existing **`team-sunig-ntu`** (one NTU roster shared with Sunig 2025), or a separate team id like `team-ivp-ntu`?

**Q2 — IVP tournament id?**  
What is the exact tournament id in your app for IVP 2026? (e.g. `tournament-ivp-2026` or an auto-generated id from when you created it in Tournament Manager?) Executor needs the exact string for JSON.

**Q3 — Opponent team names & ids?**  
Proposed mapping — please confirm or correct:

| Opponent | Proposed id | Full name | Abbr |
|----------|-------------|-----------|------|
| NP | `team-ivp-np` | Ngee Ann Polytechnic? | NP |
| SUSS | `team-sunig-suss` *(reuse)* | Singapore University of Social Sciences | SUSS |
| ITE | `team-ivp-ite` | Institute of Technical Education? | ITE |
| SIM | `team-ivp-sim` | Singapore Institute of Management? | SIM |

**Q4 — NUS in tournament?**  
You added NUS to IVP 2026 in Tournament Manager but there is no NUS game in these 5 PDFs. Include NUS in `teamIds` anyway, or only the 5 teams that actually play?

**Q5 — Duplicate #12 (Yuanyang vs Haniel)?**  
Confirm: both stay on **`team-sunig-ntu`** roster with jersey **12**, distinguished by player id (`player-sunig-ntu-12` vs `player-ivp-ntu-12`). UI will show both #12 — OK?

**Q6 — Daniel #6 stats?**  
Daniel appears in games 2 and 3 PDFs but wasn’t listed in your starter notes. Import his box score lines using existing `player-sunig-ntu-6`?

**Q7 — Lucas profile on import?**  
Store DOB as `2004-02-03`, height `185`, weight `80` on first import — correct?

**Q8 — Import order OK?**  
Game 1 = full import (adds 3 players). Games 2–5 = `--stats-only`. Matches Sunig workflow — confirm?

---

### **N1 — Smart back navigation: return to previous page (Designer, 2026-05-29)**

User report: From **Sunig tournament → Teams tab → NTU team page → Back**, expected return to **tournament Teams tab**, but landed on **Team Manager** (`/teams`).

#### Root cause analysis (Designer)

**1) Back buttons are hardcoded to parent list pages, not contextual**

In `src/routing/AppRoutes.tsx`:

| Route | Current `onBack` | Problem |
|-------|------------------|---------|
| `TeamDetailRoute` | `navigate(paths.teams)` | Always Team Manager, ignores where user came from |
| `PlayerDetailRoute` | `navigate(teamPath(team))` | Always team overview, ignores tournament/dashboard origin |
| `TournamentDetailRoute` | `navigate(paths.tournaments)` | Always tournament list, ignores dashboard origin |

**2) This was an intentional prior fix — now conflicts with user intent**

Scratchpad (Executor notes) documents a previous change: *"Team detail Back now routes directly to `paths.teams` (single click)"* — removing browser-history dependency. That fixed **Team Manager → Team → Back** in one click, but broke **cross-section navigation** (tournament, dashboard, standings → team).

**3) `GameSummary` already uses history correctly**

`GameSummaryRoute` uses `navigate(-1)`. Inconsistent pattern across detail pages.

**4) Tab query params must be preserved**

Tournament Teams tab URL is `/tournaments/sunig-2025--tournament-sunig-2025?tab=teams`. Any fix must restore the **full path + search**, not just the tournament home tab.

#### Product decision (Designer)

- **Back = return to the page the user came from** (including tab query param).
- **Sensible fallback** when there is no referrer (direct URL / bookmark / new tab): parent list page for that entity type.
- **One click** — user should not have to press Back multiple times to escape internal tab changes on the detail page they just left (e.g. team stats tab history should not block return to tournament).

Recommended approach: **explicit return URL via React Router location state**, not raw `navigate(-1)` alone.

#### Proposed implementation

**Step 1 — Add `src/routing/navigation.ts`**

```typescript
export type NavigationFromState = { from?: string };

export function currentLocationPath(location: Location): string {
  return `${location.pathname}${location.search}`;
}

/** Navigate to a detail page, recording where the user came from. */
export function navigateWithReturnTo(
  navigate: NavigateFunction,
  target: string,
  returnTo: string
): void {
  navigate(target, { state: { from: returnTo } satisfies NavigationFromState });
}

/** Back: use recorded `from`, else fallback (e.g. /teams). */
export function navigateBack(
  navigate: NavigateFunction,
  location: Location,
  fallback: string
): void {
  const from = (location.state as NavigationFromState | null)?.from;
  if (from) {
    navigate(from);
    return;
  }
  navigate(fallback);
}
```

**Step 2 — Forward navigation: pass `from` when entering detail pages**

Update navigators to call `navigateWithReturnTo(navigate, target, currentLocationPath(location))`:

| Location | Calls to update |
|----------|-----------------|
| `TournamentDetailRoute` | `onNavigateToTeam`, `onNavigateToPlayer`, `onNavigateToGame` |
| `TeamDetailRoute` | `onNavigateToPlayer`, `onNavigateToGame`, `onNavigateToTournament` |
| `PlayerDetailRoute` | `onNavigateToTeam`, `onNavigateToGame`, `onNavigateToTournament` |
| Shared `navigateToTeam` / `navigateToTournament` in `AppRoutes` | Dashboard + TeamManager entry points |
| `TeamManager` route | already uses shared `navigateToTeam` |
| `App.tsx` | any direct `navigate(teamPath(...))` calls |

**Step 3 — Back handlers on detail routes**

| Route | Fallback when no `from` |
|-------|-------------------------|
| `TeamDetailRoute` | `paths.teams` |
| `PlayerDetailRoute` | `teamPath(team)` |
| `TournamentDetailRoute` | `paths.tournaments` |

Replace hardcoded `onBack` with `navigateBack(navigate, location, fallback)`.

**Step 4 — Leave list-page backs unchanged**

`TournamentManager`, `TeamManager`, `RecentGames` back → home is correct (section entry points).

**Optional (defer):** Align `GameSummaryRoute` to same `navigateBack` + pass `from` on `gamePath` navigations for consistency.

#### High-level task breakdown (Executor — one step at a time)

- [x] **N1.1 — Add `navigation.ts` helpers** (+ unit tests if test harness exists; else manual QA only)
  - Success: helpers exported, typed, no lint errors.
- [x] **N1.2 — Wire `navigateWithReturnTo` on all forward detail navigations in `AppRoutes.tsx`**
  - Success: tournament → team navigation sets `location.state.from` with `?tab=teams`.
- [x] **N1.3 — Replace detail route `onBack` with `navigateBack`**
  - Success: Team/Player/Tournament detail backs use helper + fallbacks.
- [x] **N1.4 — Audit `App.tsx` for direct navigates without return state**
  - Success: global search team/player/game links use `navigateWithReturnTo`.
- [ ] **N1.5 — Manual QA gate (user)**
  - Tournament Teams tab → NTU → Back → **Tournament Teams tab** ✓
  - Team Manager → NTU → Back → **Team Manager** ✓
  - Dashboard team tile → NTU → Back → **Dashboard** ✓
  - Tournament Players tab → player → Back → **Tournament Players tab** ✓
  - Direct URL to team → Back → **Team Manager** (fallback) ✓

#### Success criteria (Designer sign-off)

- Back from a detail page returns to the **exact prior URL** (path + tab query), not a hardcoded list page.
- Fallback behavior works for direct/deep links.
- No regression: Team Manager → Team → Back still one click.

#### Risks / notes

- **Do not** revert to bare `navigate(-1)` without `from` state — user changing tabs on team page would require multiple backs to reach tournament.
- Previous scratchpad note (*"Removed dependency on browser history"*) is **superseded** by this plan.

---

### **P0 — Latest Games preview: wrong scores + diagonal layout (Designer, 2026-05-30)**

User report: Dashboard “Latest Games” cards show **scores on the wrong team** (e.g. Sunig: SUTD left with 96, NTU right with 37; correct is **NTU 96**, **SUTD 37**). Same class of error on Summer League cards. Team names also look **diagonally misaligned** (one side high, one low).

#### Root cause analysis (Designer)

**1) Score logic is side-indexed, not team-indexed (primary bug)**

`resolveSideScore(game, 'home' | 'away')` in `src/utils/gameDisplay.ts` resolves by **slot** (`home` / `away`), not by **team id**:

1. Sum `gameStats` for players on `getTeamForSide(game, side).players`
2. Else `teamStats[side].total_points`
3. Else `finalScore[side]`

`team_stats` JSON stores `home` / `away` **buckets** that were written when the game was imported/saved. If `home_team_id` in Postgres ever disagrees with those buckets (or buckets were written for NTU-on-home but the row later shows SUTD as `homeTeam`), step 2 returns **96 for the `home` slot** while the **displayed** `homeTeam` is SUTD (0 players → step 1 = 0). Result: **SUTD label + 96**.

Import source of truth (`game-2025-09-19-ntu-sutd.json`) is correct: `homeTeamId: team-sunig-ntu`, `finalScore: { home: 96, away: 37 }`. Bug is in **resolution/display**, not necessarily import — unless Supabase row has swapped `home_team_id` (Executor must verify one row).

**2) Layout separates names from scores (UX amplifier)**

`DashboardGamePreview` uses a 3-column grid: **team name | centered `homeScore - awayScore` | team name**. Scores sit in the middle column, so users visually pair the **left number** with the **left name** even when logic is slot-based. Long names (SUTD) + `items-center` + asymmetric flex (`name→avatar` vs `avatar→name`) create a **diagonal** look.

**3) Inconsistent matchup layout elsewhere**

- `RecentGames.tsx`: home left, uses `finalScore.home` / `finalScore.away` directly (same slot bug).
- `GameSummary.tsx`: **away left**, home right (opposite horizontal order from dashboard).

#### Product decisions (confirmed by user intent)

- **Left team’s score must be under/next to that team’s name** — no floating center score strip.
- **NTU 96, SUTD 37** for Sunig card (team-accurate, not slot-accurate).
- Fix should apply to **all games**, not only Sunig.

#### High-level task breakdown (Executor — one step at a time)

- [x] **G1 — Add `resolveTeamScore(game, teamId)` in `gameDisplay.ts`**
- [x] **G2 — Redesign `DashboardGamePreview` layout**
- [x] **G3 — Align Recent Games + Game Summary (home left, team-id scores)**
- [x] **G4 — Data integrity check:** Supabase row `game-sunig-2025-09-19-ntu-sutd` matches import (no DB repair needed).
- [x] **G5 — Manual QA gate** (user confirmed 2026-05-30)

#### Success criteria (Designer sign-off)

- No card pairs a team name with another team’s score.
- No diagonal name alignment on standard desktop width.
- Sunig game: **Nanyang Technological University — 96**, **SUTD — 37**.

---

### **B3 — Box score: starters + bench divider + minutes sort (Designer, 2026-05-30)**

User request: Box score table should show **starting 5 first** (in provided order), then a **visual divider**, then **bench players sorted by minutes (most → least)**.

#### Confirmed starter lineups (NTU home)

| Game | PG | SG | SF | PF | C |
|------|----|----|----|----|---|
| **vs SUTD** (2025-09-19) | Jingjie #1 | Chengshan #8 | Hanqing #33 | Cliff #13 | Carl #22 |
| **vs SIT** (2025-09-22) | Minghui #20 | Chengshan #8 | Hanqing #33 | Khaimun #14 | Carl #22 |

**Player IDs for JSON `homeStarters` (array order = display order):**

| Game | `homeStarters` |
|------|----------------|
| SUTD | `["player-sunig-ntu-1", "player-sunig-ntu-8", "player-sunig-ntu-33", "player-sunig-ntu-13", "player-sunig-ntu-22"]` |
| SIT | `["player-sunig-ntu-20", "player-sunig-ntu-8", "player-sunig-ntu-33", "player-sunig-ntu-14", "player-sunig-ntu-22"]` |

Note: Game 1 JSON currently has **wrong** starter order (`#8, #33, #22, #13, #1`) — Executor must fix + re-import.

#### Current behavior (problem)

`BoxScore.tsx` → `getTeamBoxScore()` iterates `team.players` roster order, filters who played. **No starter/bench split, no sort.**

`game.homeStarters` / `game.awayStarters` exist on `Game` and in DB but are **unused** by box score UI.

#### Product decisions (Designer)

1. **Source of truth:** `homeStarters` / `awayStarters` on the game (player id arrays). **Array order = starter row order** (PG→SG→SF→PF→C as user lists them).
2. **Starters section:** Up to 5 ids from the appropriate starters array. Only include ids that **actually played** (`minutes_played > 0`). Preserve starters-array order (do not re-sort starters by minutes).
3. **Bench section:** All other players on that team who played, sorted by **`minutes_played` descending**.
4. **Divider:** One table row between starters and bench when **both sections are non-empty** — muted background, single cell spanning all columns, label **"Bench"** (left-aligned). Same in Traditional and Advanced tables.
5. **Fallback when starters array is empty** (legacy / opponent score-only): treat **all players who played as bench**, sort by minutes desc, **no divider** (no fake starters).
6. **Scope:** `BoxScore.tsx` only for this task. Do not change TeamPage roster or tournament player stats tables.
7. **Future games:** User provides starters at import time (or via live Game Setup). Document in import JSON template.

#### Recommended architecture

**A. Util** — `src/utils/boxScoreOrder.ts` (or add to `gameDisplay.ts`)

```ts
export type OrderedBoxScoreSection = 'starters' | 'bench' | 'divider';

export interface OrderedBoxScoreRow<T> {
  kind: OrderedBoxScoreSection;
  player?: T;
}

export function orderBoxScorePlayers<T extends { playerId: string; minutes_played: number }>(
  players: T[],
  starterIds: string[]
): OrderedBoxScoreRow<T>[]
```

Algorithm:
1. Build `Map` playerId → row from `players`.
2. Walk `starterIds` in order → push `{ kind: 'starters', player }` if in map.
3. Remaining players → sort by `minutes_played` desc → push `{ kind: 'bench', player }`.
4. If starters.length > 0 && bench.length > 0, insert `{ kind: 'divider' }` between (or emit divider before first bench row in render loop).

**B. `BoxScore.tsx`**

- Pass `game.homeStarters` / `game.awayStarters` into ordering util based on selected team side.
- Replace flat `players.map` with loop over ordered rows; render divider row for `kind === 'divider'`.
- Apply to **both** `TraditionalStatsTable` and `AdvancedStatsTable`.

**C. Data fix (Executor)**

- Update `game-2025-09-19-ntu-sutd.json` `homeStarters` to correct ids/order (table above).
- Update `game-2025-09-22-ntu-sit.json` `homeStarters` (currently `[]`).
- Re-import both games (import script now preserves player height/weight — safe).

#### High-level task breakdown (Executor — one step at a time)

- [x] **B3.1 — Add `orderBoxScorePlayers` util**
- [x] **B3.2 — Wire `BoxScore.tsx`** (traditional + advanced, divider row)
- [x] **B3.3 — Fix starter arrays in both Sunig JSON files**
- [x] **B3.4 — Re-import both games** to Supabase
- [ ] **B3.5 — Manual QA:** SUTD + SIT starter order and bench minutes sort

#### Success criteria

- **SUTD:** Rows 1–5 = Jingjie, Chengshan, Hanqing, Cliff, Carl (who played); divider; bench = remaining NTU players by minutes (e.g. Jeremy, Darren, …).
- **SIT:** Rows 1–5 = Minghui, Chengshan, Hanqing, Khaimun, Carl; divider; bench by minutes (Jingjie, Darren, Jeremy, Sunzhe, Cliff).
- Advanced tab matches Traditional order.
- Games with `homeStarters: []` still render (minutes-only sort, no divider).

---

### **B4 — Sunig 2025 Game 3: NTU vs NUS (Designer, 2026-05-30)**

**Source:** `Importingboxscores/sunig 2025/NUS_vs_NTU_BoxScore_2025-09-26.pdf`  
**Target JSON:** `Importingboxscores/sunig 2025/game-2025-09-26-ntu-nus.json`  
**User constraint:** **Stats only** — do not modify player profile data (height, weight, name, position, etc.) in Supabase. Game 2 import taught us full-bundle re-import is risky even with merge.

#### PDF summary (verified)

| Field | Value |
|-------|--------|
| Date | **September 26, 2025** |
| Header score | **NUS 39 — NTU 70** (NTU win) |
| NTU players in PDF | **12** who played |
| NUS player lines | **None** (score-only opponent, like SUTD/SIT) |
| NTU team line | 70 pts · 32/82 FG · 1/20 3PT · 5/12 FT · 40 REB (14 ORB / 26 DRB) · 22 AST · 2 BLK · 17 STL · 9 TO · 22 PF |

Player points sum to **70** ✓. Top scorers: Carl **17**, Cheng Shan **16**, Daniel **10**.

**NTU played (12):** #22, #8, #6, #20, #33, #1, #21, #0, #10, #15, #4, #13  
**NTU did not play (0 GP):** #45 Sunzhe, #12 Yuanyang, #14 Khaimun (no `gameStats` row)

#### Proposed data model

| Entity | Proposed value |
|--------|----------------|
| Game id | `game-sunig-2025-09-26-ntu-nus` |
| Date | `2025-09-26` |
| Home / Away | **Assumed:** NTU home, NUS away → `finalScore: { home: 70, away: 39 }` (header format matches Games 1–2: away listed first) |
| New team | `team-sunig-nus` — **National University of Singapore**, abbrev **NUS**, `players: []` |
| NTU in bundle | **Stub only** — `id`, `name`, `abbreviation`, **`players: []`** (no roster payload) |
| `trackBothTeams` | `false` |
| `gameStats` | 12 NTU rows; decimal minutes (e.g. `27:39` → `27.65`) |
| `teamStats` | NTU full TEAM line; NUS `total_points: 39` only |
| `tournament.teamIds` | Add `team-sunig-nus` to existing four |

#### Import strategy change (required for user constraint)

**Problem:** Current `import-boxscore.ts` always upserts `players` from bundle. Even empty `players: []` avoids NTU player writes, but Game 2 still sent 15 player rows and overwrote profiles until merge fix.

**Proposed `--stats-only` flag:**

| Table | Behavior in `--stats-only` |
|-------|----------------------------|
| `games` | Upsert game row (stats, scores, starters) |
| `tournament_teams` | Upsert junction rows |
| `tournaments` | Upsert tournament metadata (idempotent) |
| `teams` | Upsert **only teams that do not exist** in DB (creates NUS shell); **skip** existing NTU/SUTD/SIT |
| `players` | **Skip entirely** |

Usage: `npm run import:boxscore -- --file "...game-2025-09-26-ntu-nus.json" --stats-only`

#### High-level task breakdown (Executor)

- [ ] **B4.0 — Add `--stats-only` to import script** (skip players; new teams only)
- [ ] **B4.1 — User confirms** home/away, NUS name, starters (see questions)
- [ ] **B4.2 — Author stats-only JSON** (stub teams, 12 `gameStats`, team totals, starters)
- [ ] **B4.3 — Dry-run + import with `--stats-only`**
- [ ] **B4.4 — Manual QA:** score 70–39, 12 NTU lines, box score order, **player profiles unchanged**

#### Success criteria

- Game live as **NTU 70, NUS 39** with correct pairing.
- All 12 NTU stat lines match PDF; minutes show as MM:SS.
- **No changes** to existing NTU player height/weight/name in Supabase (verify before/after query).
- NUS appears in tournament as score-only opponent.

#### Open questions (need answers before Executor B4.2)

1. **Home/Away:** Confirm **NTU home, NUS away** (`70` home / `39` away)?
2. **NUS full name:** **National University of Singapore** — correct?
3. **Starters** for this game (PG/SG/SF/PF/C order, like Games 1–2)? PDF does not list them.
4. **`--stats-only` import:** OK with this approach so we never touch player rows?

---

### **B5 — Sunig 2025 Game 4: SUSS vs NTU (Designer, 2026-05-30)**

**Source:** `Importingboxscores/sunig 2025/SUSS_vs_NTU_BoxScore_2025-09-29.pdf`  
**Target JSON:** `Importingboxscores/sunig 2025/game-2025-09-29-suss-ntu.json`  
**Import:** `npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-29-suss-ntu.json" --stats-only`  
**User constraint:** **Stats only** — never upsert `players`; preserve all NTU profile data in Supabase.

#### PDF summary (verified)

| Field | Value |
|-------|--------|
| Date | **September 29, 2025** |
| Header score | **SUSS 41 — NTU 86** (NTU win) |
| NTU players in PDF | **12** who played |
| SUSS player lines | **None** (score-only opponent, like SUTD/SIT/NUS) |
| NTU team line | 86 pts · 35/75 FG · 10/22 3PT · 6/9 FT · 40 REB (16 ORB / 24 DRB) · 23 AST · 2 BLK · 19 STL · 12 TO · 13 PF |

Player points sum to **86** ✓. Top scorers: Jeremy **15**, Sunzhe **14**, Daniel **13**.

**NTU played (12):** #10, #45, #6, #8, #33, #1, #22, #4, #20, #15, #21, #12  
**NTU did not play (0 GP):** #0 Shawn, #13 Cliff, #14 Khaimun (no `gameStats` row)

#### Proposed data model

| Entity | Proposed value |
|--------|----------------|
| Game id | `game-sunig-2025-09-29-suss-ntu` |
| Date | `2025-09-29` |
| Home / Away | **Assumed:** SUSS home, NTU away → `finalScore: { home: 41, away: 86 }` (matches NUS game pattern: first team in PDF header = home) |
| New team | `team-sunig-suss` — **Singapore University of Social Sciences**, abbrev **SUSS**, `players: []` |
| NTU in bundle | **Stub only** — `id`, `name`, `abbreviation`, **`players: []`** |
| `trackBothTeams` | `false` |
| `homeStarters` | `[]` (SUSS score-only) |
| `awayStarters` | User to confirm (PG→C order); NTU is **away** |
| `gameStats` | 12 NTU rows; **decimal minutes** (MM:SS → min + sec/60) |
| `teamStats.home` | SUSS: `total_points: 41` only |
| `teamStats.away` | NTU full TEAM line from PDF |
| `tournament.teamIds` | Add `team-sunig-suss` to existing five |

#### NTU player stat mapping (PDF → JSON)

Reuse existing `player-sunig-ntu-*` ids. Minutes as decimal (never rounded integers).

| # | PDF name | player id | MIN | PTS | FG | 3PT | FT | REB (ORB/DRB) | AST | BLK | STL | TO | PF | FD | +/- |
|---|----------|-----------|-----|-----|-----|-----|-----|---------------|-----|-----|-----|-----|-----|-----|-----|
| 10 | Jeremy | player-sunig-ntu-10 | 17.9333 | 15 | 5-12 | 3-7 | 2-3 | 7 (4/3) | 0 | 0 | 1 | 1 | 1 | 3 | 33 |
| 45 | Sunzhe | player-sunig-ntu-45 | 16.9667 | 14 | 5-8 | 4-6 | 0-0 | 6 (4/2) | 3 | 0 | 3 | 0 | 2 | 1 | 30 |
| 6 | Daniel | player-sunig-ntu-6 | 16.15 | 13 | 6-8 | 0-0 | 1-1 | 4 (0/4) | 2 | 0 | 5 | 0 | 2 | 3 | 31 |
| 8 | Cheng Shan | player-sunig-ntu-8 | 24.2833 | 12 | 6-13 | 0-0 | 0-0 | 2 (0/2) | 1 | 1 | 1 | 0 | 0 | 0 | 33 |
| 33 | Han Qing | player-sunig-ntu-33 | 11.5167 | 7 | 3-5 | 1-2 | 0-0 | 2 (0/2) | 0 | 0 | 1 | 0 | 1 | 0 | 33 |
| 1 | Jing Jie | player-sunig-ntu-1 | 12.1333 | 6 | 3-3 | 0-0 | 0-0 | 2 (0/2) | 3 | 0 | 1 | 2 | 2 | 0 | 33 |
| 22 | Carl | player-sunig-ntu-22 | 17.1667 | 5 | 2-8 | 1-1 | 0-0 | 4 (3/1) | 5 | 0 | 2 | 2 | 1 | 1 | 21 |
| 4 | Louis | player-sunig-ntu-4 | 15.7167 | 5 | 2-6 | 0-2 | 1-2 | 3 (2/1) | 2 | 0 | 4 | 2 | 1 | 1 | 12 |
| 20 | Minghui | player-sunig-ntu-20 | 18.65 | 4 | 2-4 | 0-1 | 0-1 | 1 (0/1) | 2 | 0 | 0 | 1 | 0 | 1 | 9 |
| 15 | Darren | player-sunig-ntu-15 | 19.4 | 3 | 1-7 | 1-3 | 0-0 | 3 (0/3) | 1 | 1 | 1 | 3 | 1 | 1 | 2 |
| 21 | Kovan | player-sunig-ntu-21 | 10.8833 | 2 | 0-1 | 0-0 | 2-2 | 4 (3/1) | 2 | 0 | 0 | 1 | 2 | 1 | 6 |
| 12 | Yuan Yang | player-sunig-ntu-12 | 11.3167 | 0 | 0-0 | 0-0 | 0-0 | 2 (0/2) | 2 | 0 | 0 | 0 | 0 | 0 | 11 |

**NTU away team totals:** 35/75 FG, 10/22 3PT, 25/53 2PT, 6/9 FT, 40 REB (16 ORB / 24 DRB), 23 AST, 2 BLK, 19 STL, 12 TO, 13 PF.

#### Import strategy

Same as B4 — **`--stats-only`** mandatory. Creates `team-sunig-suss` shell only; skips all player upserts; upserts game + tournament_teams.

#### High-level task breakdown (Executor — one step at a time)

- [x] **B5.1 — User confirms** home/away, SUSS name, starters, start time (see questions)
- [x] **B5.2 — Author stats-only JSON** (`game-2025-09-29-ntu-suss.json`)
- [x] **B5.3 — Dry-run + import with `--stats-only`**
- [ ] **B5.4 — Manual QA:** score NTU 86 / SUSS 41, 12 NTU lines, box score order, **player profiles unchanged**

#### Success criteria

- Game live as **SUSS 41, NTU 86** with correct home/away pairing.
- All 12 NTU stat lines match PDF; minutes stored as decimals.
- **No changes** to existing NTU player profiles (verify before/after query).
- SUSS appears in tournament as score-only opponent.

#### Open questions (need answers before Executor B5.2)

1. **Home/Away:** Confirm **SUSS home, NTU away** (`41` home / `86` away)? PDF header + filename suggest SUSS home; schedule might read as “@ SUSS” from NTU’s perspective.
2. **SUSS full name:** **Singapore University of Social Sciences** — correct?
3. **NTU starters** for this game (PG/SG/SF/PF/C order)? PDF does not list them. Cliff (#13) and Khaimun (#14) DNP — do not include in starters even if they started other games.
4. **Start time** (24h `HH:MM`, e.g. `20:40`)?
5. **`--stats-only` import:** Confirmed — never touch player rows?

---

### **B6 — Sunig 2025 Game 5 (finale): NUS vs NTU (Designer, 2026-05-31)**

**Source:** `Importingboxscores/sunig 2025/NUS_vs_NTU_BoxScore_2025-10-03.pdf`  
**Target JSON:** `Importingboxscores/sunig 2025/game-2025-10-03-nus-ntu.json`  
**Import:** `npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-10-03-nus-ntu.json" --stats-only`  
**User constraint:** **Stats only** — never upsert `players`; preserve all NTU profile data.  
**Note:** Last Sunig 2025 game in import folder. NUS rematch from Game 3 (Sep 26).

#### PDF summary (verified)

| Field | Value |
|-------|--------|
| Date | **October 3, 2025** |
| Header score | **NUS 45 — NTU 80** (NTU win) |
| NTU players in PDF | **12** who played |
| NUS player lines | **None** (score-only opponent) |
| NTU team line | 80 pts · 27/70 FG · 9/24 3PT · 17/24 FT · 43 REB (14 ORB / 29 DRB) · 24 AST · 4 BLK · 5 STL · 7 TO · 13 PF |

Player points sum to **80** ✓. Top scorers: Carl **23**, Chengshan **15**, Jeremy **9**.

**NTU played (12):** #22, #8, #10, #0, #45, #6, #33, #1, #15, #20, #14, #21  
**NTU did not play (0 GP):** #4 Louis, #12 Yuanyang, #13 Cliff (no `gameStats` row)

#### Proposed data model

| Entity | Proposed value |
|--------|----------------|
| Game id | `game-sunig-2025-10-03-nus-ntu` |
| Date | `2025-10-03` |
| Home / Away | **Assumed:** NUS home, NTU away → `finalScore: { home: 45, away: 80 }` (same header pattern as Sep 26 rematch) |
| Teams in bundle | Stub `team-sunig-nus` + stub `team-sunig-ntu`, both `players: []` |
| `trackBothTeams` | `false` |
| `homeStarters` | `[]` (NUS score-only) |
| `awayStarters` | User to confirm (PG→C); NTU is **away** if assumption holds |
| `gameStats` | 12 NTU rows; decimal minutes |
| `teamStats.home` | NUS: `total_points: 45` only |
| `teamStats.away` | NTU full TEAM line from PDF |
| `tournament.teamIds` | All six existing teams (no new team) |

#### NTU player stat mapping (PDF → JSON)

Reuse existing `player-sunig-ntu-*` ids. Minutes = min + sec/60.

| # | PDF name | player id | MIN (dec) | PTS | FG | 3PT | FT | REB (O/D) | AST | BLK | STL | TO | PF | FD | +/- |
|---|----------|-----------|-----------|-----|-----|-----|-----|-----------|-----|-----|-----|-----|-----|-----|-----|
| 22 | Carl | player-sunig-ntu-22 | 27.9667 | 23 | 9-13 | 1-2 | 4-4 | 5 (1/4) | 0 | 2 | 0 | 1 | 0 | 3 | 22 |
| 8 | Cheng Shan | player-sunig-ntu-8 | 22.4 | 15 | 4-11 | 1-2 | 6-8 | 2 (0/2) | 3 | 1 | 1 | 0 | 1 | 4 | 26 |
| 10 | Jeremy | player-sunig-ntu-10 | 24.4 | 9 | 3-7 | 3-7 | 0-0 | 7 (3/4) | 4 | 0 | 0 | 1 | 0 | 0 | 24 |
| 0 | Shawn | player-sunig-ntu-0 | 8.4667 | 8 | 3-6 | 2-3 | 0-0 | 0 (0/0) | 2 | 0 | 0 | 0 | 0 | 0 | 6 |
| 45 | Sunzhe | player-sunig-ntu-45 | 20.4333 | 7 | 2-5 | 1-4 | 2-2 | 3 (1/2) | 0 | 1 | 0 | 0 | 2 | 1 | 8 |
| 6 | Daniel | player-sunig-ntu-6 | 17.25 | 4 | 2-3 | 0-0 | 0-0 | 2 (0/2) | 3 | 0 | 0 | 2 | 3 | 2 | 16 |
| 33 | Han Qing | player-sunig-ntu-33 | 15.5167 | 3 | 1-6 | 1-4 | 0-0 | 5 (2/3) | 1 | 0 | 0 | 1 | 1 | 0 | 22 |
| 1 | Jing Jie | player-sunig-ntu-1 | 17.0667 | 3 | 1-3 | 0-0 | 1-2 | 5 (2/3) | 3 | 0 | 2 | 1 | 3 | 1 | 19 |
| 15 | Darren | player-sunig-ntu-15 | 14.5833 | 2 | 0-6 | 0-0 | 2-6 | 4 (1/3) | 3 | 0 | 0 | 0 | 1 | 3 | 2 |
| 20 | Minghui | player-sunig-ntu-20 | 15.7667 | 2 | 0-2 | 0-1 | 2-2 | 4 (1/3) | 3 | 0 | 0 | 1 | 0 | 3 | 12 |
| 14 | Khaimun | player-sunig-ntu-14 | 10.9833 | 2 | 1-4 | 0-1 | 0-0 | 5 (2/3) | 2 | 0 | 2 | 0 | 2 | 0 | 19 |
| 21 | Kovan | player-sunig-ntu-21 | 5.05 | 2 | 1-4 | 0-0 | 0-0 | 1 (1/0) | 0 | 0 | 0 | 0 | 0 | 2 | -1 |

**NTU team totals (away side if assumption holds):** 27/70 FG, 9/24 3PT, 18/46 2PT, 17/24 FT, 43 REB (14 ORB / 29 DRB), 24 AST, 4 BLK, 5 STL, 7 TO, 13 PF.

#### Import strategy

**`--stats-only`** — no new team needed (NUS exists). Skip all player upserts; upsert game + tournament junction only.

#### High-level task breakdown (Executor — one step at a time)

- [x] **B6.1 — User confirms** home/away, starters, start time
- [x] **B6.2 — Author stats-only JSON** (`game-2025-10-03-nus-ntu.json`)
- [x] **B6.3 — Dry-run + import with `--stats-only`**
- [ ] **B6.4 — Manual QA:** score NUS 45 / NTU 80, 12 NTU lines, box score order, **player profiles unchanged**

#### Success criteria

- Game live with correct home/away pairing and **NTU 80 — NUS 45**.
- All 12 NTU stat lines match PDF; decimal minutes.
- **No changes** to NTU player profiles (before/after query).
- Sunig 2025 tournament has all **5 games** imported.

#### Open questions (need answers before Executor B6.2)

1. **Home/Away:** Confirm **NUS home, NTU away** (`45` home / `80` away)? Same as Sep 26 rematch, or **NTU home** this time?
2. **NTU starters** (PG/SG/SF/PF/C order)? Khaimun (#14) played but was DNP in SUSS — include only if he started. Cliff DNP again.
3. **Start time** (24h `HH:MM`)?
4. **`--stats-only`:** Confirmed — never touch player rows?

---

### **C1 — Player Performance chart: sort x-axis by minutes (Designer, 2026-05-31)**

User request: On the **Player Performance** bar chart (Game Summary → Team Stats → home/away team tab), sort players on the **x-axis by minutes played** instead of roster order.

#### Current behavior (problem)

`TeamStats.tsx` → `TeamDetailView` builds `chartData` from `getPlayersWhoPlayed(game, team)`, which returns `team.players.filter(...)` — **roster insertion order**, no stat-based sort.

Result: x-axis shows e.g. Chengshan, Hanqing, Jeremy, Carl… regardless of who played most minutes.

#### Product decision (Designer)

1. **Sort key:** `minutes_played` from each player's `gameStats` row for this game.
2. **Sort direction:** **Descending** (most minutes → left, fewest → right). Matches box score bench sort convention.
3. **Scope:** **Only** the "Player Performance" grouped bar chart in `TeamStats.tsx` (home + away team detail tabs). Do not change box score order, game leaders, or team page season tables.
4. **Tiebreaker:** When minutes are equal, sort by **last name / full name** ascending (stable, predictable).
5. **Tooltip:** Unchanged — still shows full name on hover; optionally add minutes to tooltip later (out of scope unless user asks).

#### Recommended implementation (Executor)

**File:** `src/components/TeamStats.tsx` only (~5 lines).

Replace flat `playedPlayers.map(...)` with:

1. Map each played player to `{ name, fullName, points, rebounds, assists, minutes_played }`.
2. `.sort((a, b) => b.minutes_played - a.minutes_played || a.fullName.localeCompare(b.fullName))`.
3. Pass sorted array to `<BarChart data={chartData}>`.

No new util file needed — single call site, inline sort is sufficient per minimize-scope rule.

#### High-level task breakdown (Executor — one step)

- [x] **C1.1 — Sort `chartData` by `minutes_played` desc** in `TeamStats.tsx`
- [ ] **C1.2 — Manual QA:** Open SUSS game Team Stats → NTU tab; leftmost bar should be **Chengshan** (~24 min), rightmost **Kovan** (~11 min). Verify home + away tabs on a game with both teams' stats.

#### Success criteria

- X-axis order reflects minutes played (high → low), not roster order.
- SUSS game NTU chart order (expected): Chengshan → Darren → Minghui → Jeremy → Carl → Sunzhe → Daniel → Louis → Jingjie → Hanqing → Yuanyang → Kovan.
- Chart still hidden for score-only teams (unchanged).
- `npm run build` passes.

#### Open questions

None — user confirmed sort by minutes. Proceed to Executor on approval.

---

### **C2 — Player stats table: Standard / Advanced toggle (Designer, 2026-05-31)**

User request: Add a **Standard / Advanced toggle** on both player stats tables (Team page → Team Stats, Tournament page → Players). Advanced view shows specific columns in order; move ORPG and FDPG from standard into advanced only.

#### Scope

- **Single component:** `PlayerStatsTable.tsx` (used by `TeamPage.tsx` and `TournamentPage.tsx`)
- **No changes** to Box Score toggle (already has Traditional/Advanced)
- Sorting, sticky header, tournament filter unchanged

#### Column layout

**Fixed columns (both modes):** `#`, `Player`, `Team` (tournament only), `Pos`

**Standard mode (default)** — existing stat columns **minus ORPG and FDPG**:

`GP`, `MPG` (MM:SS), `PPG`, `RPG`, `APG`, `SPG`, `BPG`, `FG%`, `FGM`, `FGA`, `3P%`, `3PM`, `3PA`, `FT%`, `FTM`, `FTA`, `TOPG`, `FPG`, `+/-`, `GmSc`, `EFF`

**Advanced mode** — left to right exactly:

| Col | Label | Format | Source |
|-----|-------|--------|--------|
| 1 | **FG** | `made/attempted` e.g. `132/275` | `totalStats.fg_made` / `fg_attempted` (season totals) |
| 2 | **3PT** | `9/27` | `three_made` / `three_attempted` |
| 3 | **FT** | `17/24` | `ft_made` / `ft_attempted` |
| 4 | **ORPG** | 1 decimal | `orb / GP` (moved from standard) |
| 5 | **FDPG** | 1 decimal | `fouls_drawn / GP` (moved from standard) |
| 6 | **Paint** | 1 decimal or `-` | Paint pts per game (see data note) |
| 7 | **FBPG** | 1 decimal or `-` | Fastbreak pts per game |
| 8 | **BAPG** | 1 decimal | `blocks_received / GP` |
| 9 | **TFPG** | 1 decimal | `tech_fouls / GP` |
| 10 | **UFPG** | 1 decimal | `unsportsmanlike_fouls / GP` |

#### Paint / FBPG data model (important)

Unlike box-score counting stats, **paint and fastbreak are not stored on `GameStats`**. They are derived per game from **shot chart** via `getPlayerPaintAndFastbreakPoints()` in `gameDisplay.ts` (sums made shots with `inPaint` / `isTransition` flags).

**Sunig imported games have `shots: []`** → Paint and FBPG will show **` - `** (No stat recorded) for all players until live tracking or shot import exists. Same UX as Box Score advanced `OptionalStatTableCell`.

**Proposed season aggregation:**

1. Extend `aggregatePlayerSeasonStats` (or post-process rows) with access to scoped `games[]`.
2. For each player-game: call `getPlayerPaintAndFastbreakPoints(game, playerId)`.
3. If **no game in scope** has shot chart data (`game.shots.length > 0`) for that player's team → `paintPg: null`, `fbPg: null`.
4. If shot data exists in scope → sum paint/fb across games (null games count as 0), divide by **`gamesPlayed`** for per-game average.
5. Display via `OptionalStatText` / `NoStatRecorded` when null.

#### UI pattern

Mirror Box Score toggle (two small buttons above table, inside `PlayerStatsTable` card):

```
[ Standard ] [ Advanced ]
```

- Default: `standard`
- Toggle resets sort? **No** — keep current sort field if valid; if advanced-only field active, fall back to `PPG` desc when switching to standard (and vice versa).

#### Sorting

Add to `PlayerStatsSortField`: `FG`, `3PT`, `FT`, `Paint`, `FBPG`, `BAPG`, `TFPG`, `UFPG` (ORPG/FDPG already exist).

- **FG / 3PT / FT:** sort by **attempts** (denominator), tiebreak makes
- **Paint / FBPG:** sort by numeric value; nulls last
- **BAPG / TFPG / UFPG:** sort by per-game average

#### Implementation tasks (Executor)

- [ ] **C2.1 — Extend aggregation** for paint/fb optional stats (needs `games` passed into aggregator or new helper)
- [ ] **C2.2 — `PlayerStatsTable` view state** + Standard/Advanced toggle UI
- [ ] **C2.3 — Render advanced column set**; remove ORPG/FDPG from standard
- [ ] **C2.4 — Sort fields** for new advanced columns
- [ ] **C2.5 — QA** Team page + Tournament page; verify Sunig shows `-` for Paint/FBPG; verify FG totals e.g. Carl ~40/76 across 5 games

#### Success criteria

- Toggle works on both Team Stats and Tournament Player Stats tables.
- Advanced column order matches spec.
- ORPG/FDPG only in advanced view.
- Paint/FBPG show `-` when no shot data (Sunig case).
- FG/3PT/FT show season totals as `made/attempted`.
- Build passes.

#### Open questions for user

1. **BAPG** — Confirm this is **Blocks Against** (`blocks_received` per game), same as Box Score **BA** column?
2. **Advanced mode layout** — Replace **all** standard stat columns when advanced (only identity + 10 advanced cols), **or** keep basics like `GP` / `MPG` / `PPG` visible in advanced too?
3. **FG / 3PT / FT** — Confirm these are **season totals** (sum across filtered games), not per-game averages?
4. **Paint / FBPG denominator** — When some games have shot data and some don't, average over **all GP** (missing games = 0 paint) **or** only games with shot tracking?

---

**Source:** `Importingboxscores/sunig 2025/NTU_vs_SIT_BoxScore_2025-09-23.pdf`  
**Target JSON:** `Importingboxscores/sunig 2025/game-2025-09-22-ntu-sit.json`  
**Import:** `npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-22-ntu-sit.json"`

#### PDF summary (verified)

| Field | Value |
|-------|--------|
| Header score | **SIT 70 — NTU 85** (NTU win) |
| Header date | **September 22, 2025** |
| Filename date | **September 23, 2025** |
| NTU players in PDF | 10 who played (#8, #20, #22, #15, #14, #1, #33, #45, #10, #13) |
| SIT player lines | **None** (same pattern as SUTD game) |
| NTU team line | 85 pts, 36-79 FG, 3-17 3PT, 10-19 FT, 44 REB (17 ORB / 27 DRB), 28 AST, 2 BLK, 6 STL, 10 TO, 19 PF |

Player points sum to **85** ✓. Cheng Shan (#8) led with **36 pts**.

#### Proposed data model (mirrors Game 1)

| Entity | Proposed value |
|--------|----------------|
| Game id | `game-sunig-2025-09-22-ntu-sit` |
| Tournament | `tournament-sunig-2025` (existing) |
| Home team | `team-sunig-ntu` (**assumed** — confirm) |
| Away team | `team-sunig-sit` (**new**) |
| Final score | `{ home: 85, away: 70 }` |
| `trackBothTeams` | `false` |
| NTU roster in bundle | Full 15-player roster from Game 1 JSON (unchanged metadata) |
| SIT roster | `players: []` |
| SIT team row | `{ id: team-sunig-sit, name: "Singapore Institute of Technology", abbreviation: "SIT" }` |
| `tournament.teamIds` | `["team-sunig-ntu", "team-sunig-sutd", "team-sunig-sit"]` |
| `gameStats` | 10 NTU player rows only |
| `teamStats.home` | NTU totals from PDF TEAM line |
| `teamStats.away` | SIT: `total_points: 70` only; other fields `null` (like SUTD) |

#### NTU player stat mapping (PDF → JSON)

Reuse existing `player-sunig-ntu-*` ids. Minutes: **decimal minutes** (`38:05` → `38.0833333333`). Never round to whole minutes.

| # | PDF name | player id | PTS | Notes |
|---|----------|-----------|-----|-------|
| 8 | Cheng Shan | player-sunig-ntu-8 | 36 | 38 min |
| 20 | Minghui | player-sunig-ntu-20 | 15 | |
| 22 | Carl | player-sunig-ntu-22 | 10 | |
| 15 | Darren | player-sunig-ntu-15 | 7 | |
| 14 | Khaimun | player-sunig-ntu-14 | 6 | |
| 1 | Jing Jie | player-sunig-ntu-1 | 5 | |
| 33 | Han Qing | player-sunig-ntu-33 | 2 | |
| 45 | Sunzhe | player-sunig-ntu-45 | 2 | |
| 10 | Jeremy | player-sunig-ntu-10 | 2 | |
| 13 | Cliff | player-sunig-ntu-13 | 0 | |

Did not play (0 GP this game): #6, #12, #21, #4, #0 — remain on roster, no `gameStats` row.

#### High-level task breakdown (Executor — one step at a time)

- [x] **B2.1 — Confirm open questions with user**
- [x] **B2.2 — Author `game-2025-09-22-ntu-sit.json`**
- [x] **B2.3 — Dry-run import** (10 game_stats, NTU 85 – SIT 70)
- [x] **B2.4 — Run import** to Supabase
- [ ] **B2.5 — Manual QA:** Dashboard, game summary, NTU player minutes (38:05), Team Stats Sunig filter

#### Product decisions (confirmed 2026-05-30)

1. Date: **2025-09-22**
2. NTU home, SIT away
3. SIT = Singapore Institute of Technology, score-only
4. **Starters not required** — empty arrays (optional field for live games only)
5. **Minutes:** decimal (`minutes + seconds/60`), stored in JSON/DB as-is; app renders MM:SS on player pages

#### Success criteria

- Game appears in app as **NTU 85, SIT 70** with correct team pairing everywhere.
- NTU player totals match PDF; team totals match PDF TEAM line.
- Re-import is idempotent (upsert, no duplicates).
- Existing Game 1 (NTU vs SUTD) unchanged.

#### Open questions — all resolved (2026-05-30)

See **Product decisions** above.

---

User request: On **Team → Team Stats** tab, add a **Player Stats** list below the existing **Team Statistics** card — same table as **Tournament → Player Stats**, but:
- Only players on **this team**
- **Tournament filter** (team may play in multiple tournaments; stats should scope to selected tournament or all)

#### Current state (verified in code)

| Location | Behavior |
|----------|----------|
| `TeamPage.tsx` `StatsTab` | Single card: per-game **averages** of `game.teamStats` across **all** `teamGames` (no tournament filter). |
| `TeamPage.tsx` `RosterTab` | Simpler roster table (PPG/RPG/APG/FG%/3P%/FT%, height/weight) from **all** team games — different from tournament table. |
| `TournamentPage.tsx` `PlayersTab` | Full sortable table (~25 cols): GP, MPG, PPG, RPG, APG, SPG, BPG, FG%, FGM, FGA, 3P%, …, EFF. Aggregates `game.gameStats` across `tournamentGames`. Includes **Team** column. ~400 lines inline — not shared. |

#### Product decisions (proposed — confirm on Executor start)

1. **Filter applies to whole Team Stats tab** — one tournament selector drives **both** the Team Statistics summary **and** the Player Stats table (avoids contradictory numbers).
2. **Filter options:**
   - `All tournaments` — every completed game for this team (any `tournamentId` or none).
   - One option per tournament where the team has **≥1 game** in `teamGames` **or** `tournament.teams` includes `team.id` (union, deduped by tournament id).
3. **Default selection:** `team.currentTournamentId` if that tournament is in the list; otherwise `All tournaments`.
4. **Player Stats table columns:** Match tournament table **except omit Team column** (always this team). Keep sortable headers, sticky header, horizontal scroll, row click → player page.
5. **Players shown:** All players on `team.players` roster (include 0-GP rows with zeros, same as tournament tab).
6. **Games included in aggregation:** Completed games only (`isCompleted`), where `homeTeamId` or `awayTeamId` === `team.id`, and tournament filter matches (`game.tournamentId` or “all”).
7. **Do not change Roster tab** in this task — roster stays roster-centric; Team Stats tab is the tournament-scoped analytics view.

#### Key challenges

- **Duplication risk:** Tournament `PlayersTab` is large; copying into `TeamPage` creates two maintenance burdens.
- **Team stats source:** Top card uses `game.teamStats` (team-level box score lines); player table uses `game.gameStats` (player lines). Both must filter the **same game set**.
- **Optional advanced team stats:** `points_in_paint` etc. may be `null` on imports — existing `.toFixed(1)` on Team Stats card may show `NaN` for Sunig; optional small fix when touching `calculateTeamStats` (use `-` or `0` guard).

#### Recommended architecture (simplest correct approach)

**A. Shared aggregation util** — `src/utils/playerSeasonStats.ts`

```ts
export type PlayerSeasonRow = {
  player: Player;
  team: Team;
  totalStats: GameStats;
  gamesPlayed: number;
};

export function aggregatePlayerSeasonStats(
  games: Game[],
  teams: Team[],
  options?: { teamId?: string; tournamentId?: string | 'all' }
): PlayerSeasonRow[]
```

- Walk filtered games → `game.gameStats` → aggregate by `playerId` (same logic as `TournamentPage.getAllPlayersWithStats`).
- If `teamId` set, only stats for players on that team’s roster.
- Seed roster players with zero totals if no GP.

**B. Shared UI component** — `src/components/PlayerStatsTable.tsx`

- Props: `rows`, `sortField`, `sortOrder`, `onSort`, `onNavigateToPlayer`, `showTeamColumn?: boolean` (default true for tournament).
- Move sort switch + table markup from `TournamentPage` (no visual change on tournament page).

**C. Shared tournament filter** — `src/components/TournamentScopeSelect.tsx` (optional small component)

- Props: `tournaments`, `teamId`, `teamGames`, `value`, `onChange`.
- Builds option list + labels (`Sunig 2025`, etc.).

**D. `TeamPage` `StatsTab` layout**

```
[Tournament: All tournaments ▼]     (full width above cards)

┌ Team Statistics ─────────────┐   ← recalc from filtered games
└──────────────────────────────┘

┌ Player Stats — 15 Players ───┐
│  (PlayerStatsTable, no Team) │
└──────────────────────────────┘
```

#### High-level task breakdown (Executor — one step at a time)

- [x] **T1 — Extract `aggregatePlayerSeasonStats`** (`src/utils/playerSeasonStats.ts`)
- [x] **T2 — Extract `PlayerStatsTable`** + refactor `TournamentPage` Players tab
- [x] **T3 — Tournament filter** + scoped team statistics card
- [x] **T4 — Player Stats table on Team Stats tab** (no Team column)
- [ ] **T5 — Manual QA**
  - Team with 1 tournament (Sunig): filter works, table matches tournament page for same players.
  - Team in multiple tournaments (if available): switching filter changes GP/PPG.
  - `All tournaments` aggregates multiple tournaments correctly.
  - Mobile: horizontal scroll on player table.

#### Success criteria (Designer sign-off)

- Team Stats tab shows tournament filter + existing team summary + full player stats table.
- Player table matches tournament Player Stats (minus Team column), scoped to team + selected tournament.
- No copy-paste of 400 lines into `TeamPage.tsx`.

#### Out of scope (this P1)

- Refactoring `TournamentPageFixed.tsx` (unused in routes).
- Changing Roster tab columns.
- Stats Entry Step 2.

---

### Primary feature focus
- **Box score import (Sunig 2025)** — historical games from PDF → Supabase (pilot: NTU vs SUTD, 2025-09-19).
- Stats Entry Step 2 (finalize) paused until import pilot verified.

### Small UX fix (requested)
- Show player secondary position on player detail page as bracketed combo, e.g. `[PF/C]`.

### New feature request (Designer): metric input + profile formatting
- On player create/edit form, collect:
  - Height in `cm`
  - Weight in `kg`
- On player profile displays:
  - Height shown as feet/inches (rounded from cm), plus metric in parentheses (e.g. `6'3'' (191cm)`) ✅ confirmed
  - Weight shown as kg only (e.g. `88kg`)

#### Confirmed product decisions
- Scope applies to **both create and edit** player flows. ✅
- Legacy data handling will use a **one-time migration** to normalize all existing players. ✅
- Target profile height format is **feet/inches + cm**. ✅

#### Key challenges / assumptions to validate
- Current `Player.height` and `Player.weight` are stored as `string` and may contain legacy mixed-format text (`6'3'' (1.91m)`, `185 lbs (84 kg)`).
- `PlayerForm` currently treats height/weight as free text and does not enforce numeric units.
- Profile rendering currently outputs `player.height`/`player.weight` directly in `src/components/PlayerPage.tsx`.
- Need a conversion strategy for legacy data so existing players do not show broken values after we switch to cm/kg input.

#### High-level task breakdown (for Executor; one step at a time)
- [x] **Step A: Define normalization and conversion helpers**
  - Add utility helpers (file-local or shared) to:
    - normalize cm/kg input strings (numeric only, optional decimal handling policy)
    - convert cm to display feet/inches (rounded to nearest inch)
    - format weight as `XXkg`
  - Success criteria:
    - deterministic output for valid numeric input
    - safe fallback for empty/legacy unparseable values
- [x] **Step B: Update PlayerForm UX + validation**
  - Replace free-text placeholders/labels with explicit metric input affordances:
    - Height label/placeholder indicates cm
    - Weight label/placeholder indicates kg
  - Add input constraints (numeric entry, reasonable min/max) without blocking optional fields.
  - Success criteria:
    - creating/editing a player stores normalized metric values only for new edits
    - invalid text formats are prevented in form entry
- [x] **Step C: Update profile rendering logic**
  - In profile display locations, render:
    - height via cm -> feet/inches formatter
    - weight via kg formatter (no lbs)
  - Success criteria:
    - screenshot-style output retained (`6'3'' (...)`, `88kg`)
    - no `undefined`, `NaN`, or malformed unit strings
- [x] **Step D: Legacy compatibility pass**
  - Implement one-time migration to normalize all stored player height/weight values into cm/kg.
  - Success criteria:
    - all existing players have normalized metric storage after migration runs
    - profile display uses consistent formatted output across old + new players
- [x] **Step E: Verification**
  - Build and lint pass.
  - Manual checks:
    - create new player with cm/kg input
    - verify profile display formatting
    - verify existing legacy players do not regress

### Navigation bug (Designer): Back requires two clicks

#### Observed/verified in code
- `TeamDetailRoute` and `PlayerDetailRoute` currently wire Back buttons to `navigate(-1)` in `src/routing/AppRoutes.tsx`.
- `navigate(-1)` is history-dependent and can land on intermediate states (previous tab/query route entries) instead of the logical parent page.
- Because tabs are encoded in query params and navigation pushes history entries, users can perceive this as “need to click Back twice”.

#### Root cause hypothesis (high confidence)
- Back behavior is tied to browser history stack, not explicit app hierarchy.
- Detail views should have deterministic parent destinations:
  - Player detail -> Team detail (or Teams list fallback)
  - Team detail -> Teams list

#### Minimal fix plan
- Replace history back for detail pages with explicit route targets in `AppRoutes.tsx`:
  - Team page `onBack`: `navigate(paths.teams)`
  - Player page `onBack`: `navigate(teamPath(team))`
- Keep `navigate(-1)` only where browser-history semantics are desired (e.g., game summary, optional).

#### Success criteria
- From player page, one Back click always returns to the intended parent screen (no extra click).
- From team page, one Back click always returns to teams list.
- Deep links still work without odd back-stack behavior.

#### Follow-up finding: browser Back still sometimes needs two clicks
- Even after deterministic page Back, browser history can still contain duplicate same-route entries.
- Likely source: tab navigation callbacks in `AppRoutes.tsx` always call `navigate(target)` without checking if `target` is already current URL.
- In controlled tab flows (and helper buttons like “View All”), this can create extra no-op history pushes, so browser Back appears to require two clicks.

#### Proposed fix (browser-history preserving)
- Keep tab changes as normal history pushes **when target URL differs** (so browser Back walks prior tabs as desired).
- Add URL dedupe guard in route-level tab change handlers:
  - Build `target` path for next tab.
  - If `location.pathname + location.search === target`, skip `navigate`.
  - Else `navigate(target)` (push).
- Apply same dedupe to helper tab buttons via shared handlers (by routing all tab changes through guarded handler).

#### Success criteria for follow-up
- Browser Back returns to the previously viewed tab in one click (when tabs actually changed).
- Browser Back no longer gets “stuck” on duplicate same-tab entries.
- Page Back button behavior remains deterministic and unchanged.

#### Key challenges / assumptions to validate
- Player model already supports `secondaryPosition?: string` (confirmed in `src/App.tsx`).
- Player detail UI currently renders only `player.position` in **two places** in `src/components/PlayerPage.tsx`:
  - Overview card line (currently shows `{player.position}`)
  - Header subtitle line (currently `#{player.number} • {player.position} • {team.name}`)
- We should avoid changing search/list displays unless explicitly requested; scope is player page only.

#### High-level task breakdown (for Executor; do one step at a time)
- [x] **Step 1: Add a formatting helper** local to `PlayerPage.tsx` (or shared util if already exists) that returns:
  - If `secondaryPosition` is present and different from primary: `[\${primary}/\${secondary}]`
  - Else: `\${primary}`
  - Success criteria: function handles `undefined`, empty string, and same-as-primary secondary without showing `[]` or duplicate like `[PF/PF]`.
- [x] **Step 2: Replace the two UI render sites** to use formatted position text.
  - Success criteria: player page shows `#12 • [PF/C] • Team Name` in header subtitle and the same formatted position in the overview card row.
- [x] **Step 3: Smoke test manually**
  - Create/edit a player to set `secondaryPosition` and confirm the display updates immediately.
  - Confirm players without `secondaryPosition` still show plain `PF` (no brackets).
  - Confirm no other pages (team roster lists, search dropdown) changed.

### Stats Entry Revamp — Step 1: Game Setup (LOCKED SPEC — Designer)

**Status:** ✅ Complete (user QA signed off 2026-05-29).

#### Product decisions (confirmed)
| Topic | Decision |
|-------|----------|
| Tracked team | Always **Home** / **Your team** (left column) |
| Single-team mode labels | UI: **Your team** / **Opponent** (internal model may still use `homeTeam` / `awayTeam`) |
| Toggle default | **Track both teams individually = ON** |
| Opponent (single-team) | One **text field** for opponent name (required, trimmed non-empty) |
| Team dropdown | Teams **registered in selected tournament only** |
| Dropdown UX | One select per side: existing teams + **Create new team**; no parallel “or create new” path |
| Existing team | Show roster; user may **add players** if someone is missing |
| Create new team | Show team name + add-player form (Name, No., Position) |
| New team persist | **Save team + players to DB on Start Game**; link team to selected tournament |
| Players on existing team | Additions during setup **update DB** (via team update), not game-only |
| Same team both sides | **Allowed** (scrimmage / internal) |
| Min roster | **5 players** on each side that requires a roster (Your team always; Away also when both-team mode) |
| Positions | PG, SG, SF, PF, C only; **no secondary** in setup |
| Jersey numbers | **No duplicates** on the same team |
| Abbreviation | **Auto-generate** 3-letter uppercase from team name for new teams |
| Game date | User-selected date is **source of truth** on `Game.date` (supports past games) |
| Tournament | **Required** picker on setup; drives team list filter |
| Layout (single-team) | Two columns: full **Your team** card \| **Opponent** card with name field only (not dimmed placeholder) |

#### Persistence model (cross-cutting — applies to full stats-entry revamp)

Clarifies user note: *team/player changes → DB; game stats → DB at end of entry.*

| When | What gets persisted |
|------|---------------------|
| **During setup** (add player to existing team) | Update `Team` (+ players) in app state → debounced **Supabase save** (same as rest of app) |
| **Start Game** | New teams: `onCreateTeam` + register in tournament; active `Game` row/snapshot with metadata, rosters, `isActive: true`, empty stats/events |
| **During live entry** | Events/stats held in game state; optional debounced save of **in-progress** game for crash recovery (implementation detail; does not replace finalize) |
| **End Game (finalize)** | Full game payload: `gameStats`, `teamStats`, `events`, `shots`, `lineupStints`, `isCompleted`, `finalScore`, tournament `games` link |

**Reconciliation (Q5 vs “on completion”):** New teams are created in DB at **Start Game** so live entry uses real team/player IDs. **Completed game stats** are the authoritative write at **finalize**.

**In-progress / unfinished games (confirmed 2026-05-29):**
- If the user never finishes, the game stays **`isActive: true`** in DB (debounced saves during live entry).
- User must be able to **resume** later (reload `/live/:id` or explicit “Resume game” entry point).
- Not abandoned/orphan from a product perspective — only **finalize** marks completed and links full stats to tournament history.
- **Executor note:** Step 1 creates the active game shell; **minimal resume wiring** is required when touching start/live routes (see task **1.9**). Full live-entry rework remains later.

#### UI state machine (per side: Home / Away)

```
teamSelectionMode: 'none' | 'existing' | 'create_new'

Dropdown:
  [ Select team ▼ ]
    - {each tournament team}
    - ➕ Create new team

existing  → roster list + "Add player" row (Name, No., Pos)
create_new → Team name input + "Add player" row
none      → prompt to select
```

**Away when `trackBothTeams === false`:** No dropdown/roster; single **Opponent name** input only.

#### Start Game validation (enable button)

- Tournament selected
- Game date set (valid date input)
- **Your team (home):** resolved (existing or create_new with name) and **≥ 5 players**
- **Both teams ON:** Away same rules as home (≥ 5 players)
- **Both teams OFF:** Opponent name non-empty
- No duplicate jersey numbers on a given side’s roster
- (Optional warning only) Same team selected home and away — allowed, no block

#### Data written to `Game` on start (Step 1 scope)

- `date` = selected game date (not `new Date()` at click time)
- `tournamentId` = selected tournament
- `trackBothTeams`
- `homeTeam` / `awayTeam` snapshots (DB ids for persisted teams; opponent stub for single-team mode with user name + generated abbreviation)
- `homeStarters` / `awayStarters`: first 5 player ids per side when roster ≥ 5 (starters picker deferred)
- `isActive: true`, `isCompleted: false`, empty stats arrays

#### Executor task breakdown (Step 1 only — do one at a time)

- [x] **1.1** Add tournament selector to `GameSetup`; pass `tournaments` + filter teams by `tournament.teams`
- [x] **1.2** Refactor team side UI to dropdown state machine (`existing` \| `create_new`); remove redundant “or create new” split layout
- [x] **1.3** Single-team mode: Opponent name field; labels Your team / Opponent; remove dimmed placeholder card
- [x] **1.4** Wire setup callbacks: `onCreateTeam`, `onUpdateTeam` from `App.tsx` into `GameSetup` route
- [x] **1.5** Persist new team on Start Game; persist added players to existing teams on add
- [x] **1.6** Validation: min 5 players, duplicate jersey block, opponent name required, date on `Game.date`
- [x] **1.7** Abbreviation auto-generate (`src/utils/teamAbbreviation.ts`); opponent stub has abbreviation
- [x] **1.8** Manual QA gate for Step 1 (user verified)
- [x] **1.9** Resume: restore `currentGame` on load; `/live/:id` hydrates from `games`; `handleGameUpdate` keeps `games` in sync during live play

#### Step 1 manual QA gate

- Pick tournament → only its teams appear in dropdowns
- Existing team → roster shows; add 6th player → appears in DB team after save
- Create new team → add 5 players → Start → team exists under Teams/tournament; live route loads
- Single-team mode → opponent name “Lakers” → game shows Lakers as away name, 5+ home players
- Past game date → `/games/:id` and lists show that date
- Cannot start with &lt; 5 players or duplicate jersey # on same team
- Start game, record one event, leave site, return → resume same game at `/live/:id`

#### Defaults locked for Executor (no further user input required)

| Topic | Default |
|-------|---------|
| Opponent (single-team) | **Not** a DB team — name + generated abbreviation on game snapshot only |
| Players added in setup | `height`/`weight` empty string, `age` 0 (same as today) |
| Game `date` field | Store selected calendar date as ISO date string (`YYYY-MM-DD`) |
| Tournament dropdown default | First tournament in list (alphabetical by name) unless only one |
| Multiple active games | **One** active game at a time; starting a new game prompts to resume or abandon existing (abandon = keep `isActive` in DB but clear session — defer strict abandon UI to Step 2 if needed; MVP: restore most recent `isActive` on load) |
| Resume entry points | Header live badge (existing) + auto-restore `currentGame` on app load from newest `isActive` game |

#### Out of scope for Step 1

- Live entry UI rework, end-game finalize, save-status chip, starters UI, post-game edits
- Strict “abandon game” dialog / multiple concurrent active games

---

### Stats Entry — Step 1.5: Active session governance (Designer — LOCKED)

**Triggered by QA feedback:** cannot resume from Stats Entry; can start a second active game; need delete in live session.

#### Root cause analysis (why Step 1.9 feels broken)

| Symptom | Cause in current code |
|--------|------------------------|
| “Can’t resume in Stats Entry” | `/stats-entry` always renders full `GameSetup` with no resume UI. Header “Live” badge is **not clickable** (no `navigate` to `/live/:id`). |
| “Can start a second active game” | `handleGameStart` never checks for an existing `isActive` game; old active games stay `isActive: true` in `games` when a new one starts. |
| “Resume after refresh unclear” | `currentGame` restores on load, but user must know URL `/live/:gameId` — not discoverable from Stats Entry tab. |
| Possible data issue | If multiple `isActive` rows exist in Supabase, app picks “newest by date” on load but does not prevent creating more. |

**Conclusion:** Persistence plumbing exists; **product rules + entry-point UX** were not enforced. Step 1.5 fixes that.

#### Product rules (confirmed from user request)

1. **At most one active game** globally (`isActive === true && !isCompleted`).
2. **Cannot start a new game** while an active game exists — must **resume** or **delete** the current one first.
3. **Resume must be obvious** from Stats Entry (not only deep URL or silent header text).
4. **Delete game** available **during live session** — removes in-progress game from app + database (hard delete, not “completed”).
5. ~~Teams/players created during that game’s setup **remain** in DB~~ → **Updated in Step 1.6** (see below).

#### Stats Entry page states

```
/stats-entry
  ├─ NO active game     → show GameSetup (current)
  └─ HAS active game    → show ActiveGameBanner (blocks setup)
        - Title: "Game in progress"
        - Meta: date, tournament, Your team vs Opponent
        - [Resume game]  → navigate /live/:activeGameId
        - Helper text: "Finish or delete this game before starting another"
        (GameSetup hidden or fully disabled — prefer hidden to avoid confusion)
```

#### Live session (`/live/:id`)

- Top bar adds **Delete game** (destructive, secondary).
- Confirm dialog: “Delete this game and all stats recorded so far? This cannot be undone.”
- On confirm: remove game from `games`, clear `currentGame`, persist to Supabase, navigate to `/stats-entry`.

#### Header (global)

- “Live: ABC vs XYZ” badge becomes **clickable** → same as Resume (`/live/:id`).
- Optional: show badge on Stats Entry tab when active (already shows when `currentGame` set).

#### App-level logic (`App.tsx`)

- **`getActiveGame(games, currentGame?)`**: return the single active game; prefer `currentGame` if it matches; else newest `isActive` by `date` then `id`.
- **`handleGameStart`**: if `getActiveGame()` exists and id ≠ new game id → **abort** (toast or inline error); do not add second active.
- **`handleDeleteActiveGame(gameId)`**: filter out game, `setCurrentGame(null)`, trigger save.
- **On load**: if multiple actives in DB, keep newest active, set others `isActive: false` on next save (cleanup helper) — prevents legacy duplicates.
- **Fix `handleGameComplete`**: replace game in array by id (avoid duplicate completed + active rows).

#### Executor task breakdown (Step 1.5 — one at a time)

- [x] **1.5.1** Add `getActiveGame` helper + active-game cleanup on load (dedupe actives) — `src/utils/activeGame.ts`
- [x] **1.5.2** Guard `handleGameStart` — reject second active game
- [x] **1.5.3** `ActiveGameBanner` on `/stats-entry` when active exists; hide `GameSetup`
- [x] **1.5.4** Clickable header Live badge → `liveGamePath(activeGame.id)`
- [x] **1.5.5** `handleDeleteActiveGame` in App + wire to `LiveGameEntry` with confirm dialog
- [x] **1.5.6** QA: cannot start second game; resume from Stats Entry + header; delete removes game and returns to setup (user verified)

#### Step 1.5 manual QA gate

- Start game → leave → open **Stats Entry** → see in-progress banner, **no** new setup form.
- **Resume** opens same `/live/:id` with prior score/events.
- **Start game** disabled/blocked while active exists.
- **Delete** from live screen → game gone from DB/lists; can start fresh game on setup.
- Header Live pill click → resumes live game.

#### Open question for user (optional — default if no answer)

- **Delete copy:** OK to permanently discard all events/stats for that session? **Default: Yes** (hard delete).

---

### Stats Entry — Step 1.6: Delete setup-added players on existing teams (Designer — LOCKED)

**Triggered by QA (2026-05-29):** User added **Dobby tan** (#25) to existing **City Warriors** during setup, started live game, deleted game. **Team preserved** (Step 1.5 fix works). **Player still in DB** on team roster — bug.

#### Expected behavior (user-confirmed)

| Setup action | On delete game |
|--------------|----------------|
| Pick **existing** team (e.g. City Warriors) | Team **kept** |
| Add **new player(s)** during setup only | Those player(s) **removed** from DB |
| **Create new team** during setup | Team + all its players **removed** |

#### Root cause analysis (why Dobby remained)

| Likely cause | Explanation |
|--------------|-------------|
| **A. Empty roster baseline → safe default** | `addedPlayersFromBaseline()` returns `[]` if no snapshot when team was selected. Then `setupRosterChanges` is **never stored** on the game → delete has nothing to remove. |
| **B. Metadata lost before delete** | `setupRosterChanges` lives on `Game` and in `team_stats.__meta` in Supabase. Delete uses `games.find(id)` **before** `currentGame`; stale row may lack meta. Live saves may overwrite game without meta if field was dropped. |
| **C. Player delete not run** | `deletePlayersFromSupabase()` only runs when `setupRosterChanges` has IDs. If empty, roster rollback skipped → player remains. |
| **D. Save re-upserts player** | Less likely: after delete, debounced save could theoretically re-upsert if state out of sync (verify in Executor). |

**Distinguishing ID formats (important):**

- Catalog players: `player-1`, `player-17`, … (import/seed) → **never** auto-delete on game delete.
- Setup-added on existing team: `home-player-{timestamp}-{jersey}` or `away-player-…` → **should** delete on game delete.

#### Product rules (locked)

1. Deleting a game **must not** delete existing catalog teams (`team-warriors`, etc.).
2. Deleting a game **must** remove players added during **this game’s setup** to an existing team.
3. Removal is **hard delete** from `players` table + update team roster in app/DB.
4. Use **primary** source: `game.setupRosterChanges` persisted at **Start game** (before DB sync).
5. Use **fallback** if metadata missing: any player on game snapshot whose id matches `^(home|away)-player-\d+-\d+$` on a non-deleted team.

#### Technical design (Executor)

**1. At Start game (`GameSetup`)**

- Compute `setupRosterChanges` **before** `resolveTeamForGame` / `onUpdateTeam` (already done).
- **Also** store `setupRosterBaselines` on game optional audit: `{ [teamId]: playerId[] }` at selection time.
- Require baseline: if `existing` mode and baseline missing for team id, set baseline from `teams` prop at start (last resort).

**2. Persist on game**

- Keep `setupRosterChanges` on `Game` + `team_stats.__meta` (current).
- Ensure debounced save after start includes meta (verify).

**3. On delete (`handleDeleteActiveGame`)**

- Resolve game: **prefer `currentGame`** if id matches, else `games.find` (richer metadata).
- `playerIdsToRemove` = from `setupRosterChanges` OR fallback `inferSetupAddedPlayerIdsFromGameSnapshot(game)`.
- Order: delete **game** row → delete **players** → update **teams** in state (strip players) → save teams (no deleted player rows re-upserted).
- Do **not** call `deleteTeamsFromSupabase` except for `setupCreatedTeamIds` (unchanged from 1.5).

**4. One-time cleanup**

- Script or manual: remove orphan `home-player-*` / `away-player-*` rows on catalog teams with 0 games (optional admin tool later).

#### Executor tasks (Step 1.6)

- [x] **1.6.1** Add `inferSetupAddedPlayerIdsFromGameSnapshot(game)` fallback in `activeGame.ts`
- [x] **1.6.2** Delete handler: prefer `currentGame`; merge primary + fallback player IDs
- [x] **1.6.3** GameSetup: seed baseline from DB catalog ids when snapshot missing (`addedPlayersFromBaseline` + `teams` prop)
- [x] **1.6.4** After player removal, explicit `saveAppDataToSupabase` with computed state
- [x] **1.6.5** Manual QA: City Warriors + 1 setup player → delete game → player gone, team + catalog players remain (user verified)
- [x] **1.6.6** Deleted orphan Dobby tan from Supabase (if present)

#### Step 1.6 manual QA gate

- Existing team + add 1 player → start → delete → **only** new player removed from team page.
- Existing team, no adds → delete → roster unchanged.
- Create new team + players → delete → team and players gone.
- Catalog `player-*` ids never removed when deleting a game.

---

### Immediate next tasks
1. **Executor B2.x** — Game summary / box score display fixes (QA feedback on Sunig Game 1).
2. Re-import Game 1 JSON after B2.5.
3. Stats Entry Step 2 — after Sunig Game 1 signed off.
4. Save/sync status indicator (later).

---

### Box Score Import — Sunig 2025 (Designer — LOCKED for Game 1)

**User request (2026-05-29):** Import historical games one at a time from PDF box scores. Pilot game: `Importingboxscores/sunig 2025/NTU_vs_SUTD_BoxScore_2025-09-19.pdf`.

#### Scope for Game 1

| Entity | Action |
|--------|--------|
| **Tournament** | Create **Sunig 2025** (`tournament-sunig-2025`) |
| **Team NTU** | Create **Nanyang Technological University** — abbrev **NTU** |
| **Team SUTD** | Create **Singapore University of Technology and Design** — abbrev **SUTD** (4 letters) |
| **NTU roster** | Create **15 players** (full season roster); **12 played** this game (stats from box score) |
| **SUTD roster** | **Empty for now** — no individual lines on this PDF; final score only (37) |
| **Game** | Completed game **2025-09-19**, **NTU 96 – SUTD 37** |

#### Product decisions (confirmed)

- **Home team:** NTU (tracked team / primary roster).
- **Away team:** SUTD (DB team exists; no player `gameStats` this game).
- **`trackBothTeams`:** `false` — only NTU player lines imported (matches PDF).
- **Players not in box score** (#0, #4, #14): create on roster with **zero game stats** for this game (available for future imports).
- **Height/weight:** store as normalized **cm / kg** strings where provided; blank otherwise.
- **Positions:** split `SG/SF` → `position: SG`, `secondaryPosition: SF` (first token primary).
- **IDs:** stable deterministic ids for cross-game reuse:
  - Tournament: `tournament-sunig-2025`
  - Teams: `team-sunig-ntu`, `team-sunig-sutd`
  - Players: `player-sunig-ntu-{jersey}` (e.g. `player-sunig-ntu-22`)
  - Game: `game-sunig-2025-09-19-ntu-sutd`
- **Import path:** CLI script (like `import-localstorage`) with `--dry-run` + Supabase upsert; source JSON co-located with PDF.
- **Abbreviation length:** allow **3–5 uppercase letters** in UI + generator (DB already `text`, no migration).

#### Box score → `GameStats` mapping

| PDF column | App field |
|------------|-----------|
| MIN (`24:00`) | `minutes_played` (integer minutes) |
| PTS | `points` |
| FG `7-12` | `fg_made`, `fg_attempted` |
| 3PT `1-2` | `three_made`, `three_attempted` |
| FT `2-2` | `ft_made`, `ft_attempted` |
| REB / DRB / ORB | implied total; use `drb`, `orb` separately |
| AST, BLK, STL, TO | `assists`, `blocks`, `steals`, `turnovers` |
| FLS | `fouls` |
| FD | `fouls_drawn` |
| +/- | `plus_minus` |
| (missing) | `tech_fouls`, `unsportsmanlike_fouls`, `blocks_received` → `0` |

#### NTU full roster (create all 15)

| # | Name | Pos | Height | Weight | In box score? |
|---|------|-----|--------|--------|---------------|
| 8 | Chengshan Tan | SG / SF | — | — | ✅ |
| 33 | Hanqing Ming | SF / PF | — | — | ✅ |
| 10 | Jeremy Chew | SG / SF | 183 | — | ✅ |
| 22 | Carl Belanger | C / PF | 191 | 88 | ✅ |
| 6 | Daniel Delin | SF / SG | — | — | ✅ |
| 12 | Yuanyang Tan | C | — | — | ✅ |
| 13 | Cliff Louis | PF | — | — | ✅ |
| 45 | Sunzhe Lew | PF / SF | — | — | ✅ |
| 21 | Kovan Toh | C | 191 | — | ✅ |
| 20 | Minghui Pan | PG / SG | 185 | — | ✅ |
| 15 | Darren Ng | PG / SF | — | — | ✅ |
| 1 | Jingjie Lim | PG | — | — | ✅ |
| 14 | Khaimun Ng | PF / C | 188 | — | ❌ roster only |
| 4 | Louis Ho | PG | — | — | ❌ roster only |
| 0 | Shawn Lee | SG / PG | — | — | ❌ roster only |

#### Game 1 player stats (from PDF — NTU only)

| # | MIN | PTS | FG | 3PT | FT | REB | DRB | ORB | AST | BLK | STL | TO | PF | FD | +/- |
|---|-----|-----|----|----|-----|-----|-----|-----|-----|-----|-----|----|----|----|-----|
| 8 | 24 | 17 | 7-12 | 1-2 | 2-2 | 4 | 3 | 1 | 2 | 0 | 1 | 1 | 0 | 2 | +34 |
| 33 | 22 | 12 | 4-8 | 4-6 | 0-0 | 3 | 3 | 0 | 1 | 0 | 1 | 0 | 2 | 0 | +31 |
| 10 | 8 | 11 | 4-6 | 3-5 | 0-0 | 5 | 4 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | +11 |
| 22 | 20 | 10 | 4-7 | 0-0 | 2-2 | 5 | 4 | 1 | 1 | 0 | 0 | 1 | 0 | 1 | +29 |
| 6 | 16 | 9 | 3-5 | 1-1 | 2-2 | 2 | 2 | 0 | 1 | 0 | 2 | 1 | 1 | 1 | +23 |
| 12 | 11 | 7 | 3-4 | 0-0 | 1-1 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | +15 |
| 13 | 18 | 7 | 3-3 | 0-0 | 1-1 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | +26 |
| 45 | 15 | 6 | 2-4 | 2-4 | 0-0 | 4 | 3 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | +21 |
| 21 | 13 | 6 | 3-5 | 0-0 | 0-0 | 3 | 2 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | +18 |
| 20 | 20 | 5 | 2-4 | 0-0 | 1-2 | 4 | 3 | 1 | 4 | 0 | 1 | 0 | 0 | 2 | +29 |
| 15 | 16 | 4 | 1-1 | 0-0 | 2-2 | 3 | 2 | 1 | 3 | 0 | 1 | 1 | 0 | 1 | +23 |
| 1 | 17 | 2 | 1-2 | 0-0 | 0-0 | 5 | 4 | 1 | 4 | 0 | 1 | 1 | 2 | 1 | +24 |

**NTU team line (PDF):** 96 PTS, FG 37-61, 3PT 11-18, FT 11-12, REB 43 (DRB 35, ORB 8), AST 17, BLK 0, STL 9, TO 6, PF 7, FD 10 → use for `teamStats.home`.

**SUTD:** `teamStats.away.total_points = 37`; all other away fields **`null`** (not recorded). UI shows **No stats recorded** for null optional fields.

**NTU optional advanced fields** (paint, bench, etc.): **`null`** in JSON — not on PDF.

**Not imported:** `events[]`, `shots[]`, `lineupStints[]` (empty arrays). Optional: synthetic shots later — out of scope.

#### Key challenges / assumptions to validate

- **Assumption:** NTU is home. Score header `SUTD 37 - 96 NTU` is away–home ordering. **Default locked: NTU home.** User can correct before Executor runs if wrong.
- **Assumption:** Re-import is idempotent (same ids → upsert overwrites). Script must not duplicate tournament/teams on re-run.
- **Risk:** Existing catalog teams with conflicting abbrev — use unique ids (`team-sunig-*`), not generic names.
- **Risk:** UI still caps abbreviation at 3 chars — **must fix before import** or SUTD save fails in app UI later.

#### Prerequisite: Team abbreviation 3–5 characters

| File | Change |
|------|--------|
| `src/utils/teamAbbreviation.ts` | Allow generated/suggested abbrev up to 5 chars; collision suffix within 5 |
| `src/components/forms/TeamForm.tsx` | `maxLength={5}`, validate 3–5 on submit |
| `src/components/TournamentPage.tsx` | Same for team create dialog |
| `src/App.tsx` | Update comment on `Team.abbreviation` |

No DB migration required (`abbreviation text`).

#### Executor task breakdown (one at a time)

- [x] **B0.1** Abbreviation 3–5 chars in UI + generator
- [x] **B1.1** Add `Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json`
- [x] **B1.2** Add `scripts/import-boxscore.ts` + `npm run import:boxscore`
- [x] **B1.3** Dry-run verified (2 teams, 15 players, 12 game stat rows)
- [x] **B1.4** Import run against Supabase — success
- [x] **B1.5** Manual QA — user feedback received (2026-05-29); display fixes required before sign-off

#### Game 1 display fixes — QA feedback (Designer — LOCKED 2026-05-29)

User verified import is **almost good**; five display/data rules below. Applies to **Sunig Game 1** and **all future imported/live games**.

##### Root cause analysis

| # | Symptom | Cause in code |
|---|---------|----------------|
| 1 | Team TOTALS row shows +/- | `BoxScore.tsx` `getTeamTotals()` sums player `plus_minus`; TEAM row renders badge (PDF has no team +/-) |
| 2 | SUTD shows **0** not **37** | `GameSummary.tsx` scores = sum of `gameStats` only; SUTD has no players/stats. Ignores `finalScore` / `teamStats.away.total_points` |
| 3 | Paint/bench/TO pts shown; DRB = 0 | `TeamStats.tsx` **fabricates** advanced stats (lines 56–61: `pointsInPaint`, `benchPoints`, etc.) and uses broken `stat.rebounds` (field doesn't exist on `GameStats`). Ignores imported `game.teamStats.home.drb` (35 in JSON) |
| 4 | Player Performance chart includes DNP players | Chart maps **full roster** (`homeTeam.players`); roster includes #0/#4/#14 with 0 MIN |
| 5 | Leaders at bottom; no tie support | `BoxScore.tsx` Quick Stats at bottom uses `.reduce()` → single winner only |

##### Product rules (confirmed)

1. **Team TOTALS +/-:** blank / em dash (`—`), never sum player +/- (matches PDF).
2. **Opponent score-only teams (SUTD pattern):** When a side has **no player `gameStats`** but **`teamStats[side].total_points`** or **`finalScore`** exists → show that score everywhere (header, comparison charts, lists). Permanent pattern: user will **never** have SUTD player/box-score detail — only final points.
3. **Optional team advanced stats:** Fields **not on the box score** (points in paint, bench points, fast break points, points off turnovers, second chance points, biggest lead, biggest run) must **not** show fabricated numbers. Display **`No stats recorded`** when not provided.
   - **Box-score team line stats** (FG, 3PT, FT, REB, DRB, ORB, AST, STL, BLK, TO, PF, FD) **are** recorded when on PDF or in import JSON → show actual values (including legitimate `0` for BLK).
   - **SUTD away team:** only **37 PTS** is recorded; all other away team detail → **`No stats recorded`**.
4. **Player Performance chart:** exclude players with **`minutes_played === 0`** (DNP / not in box score). Global rule for all games.
5. **Game leaders:** move **Leading Scorer, Most Assists, Most Rebounds, …** **above** the box score table (in `GameSummary` or top of Box Score tab). **Include all tied players** (e.g. `"Name A, Name B (12pts)"`).

##### Data model tweak (import JSON + `TeamStats` type)

Optional advanced team fields use **`null` = not recorded** vs **`0` = recorded zero**:

```typescript
// Display-only convention in teamStats JSON:
points_in_paint: number | null  // null → "No stats recorded"
```

- Update `game-2025-09-19-ntu-sutd.json`:
  - **home:** keep box-score line values; set optional advanced fields to `null`
  - **away:** `total_points: 37`; all other numeric fields `null` (not `0`)
- Add `opponentStatsLevel?: 'full' | 'score_only'` on `Game` optional meta **OR** infer: `score_only` when side has zero `gameStats` rows for that team but `total_points > 0`.

##### Technical design (Executor)

**New shared util** `src/utils/gameScore.ts` (or `gameDisplay.ts`):

- `resolveSideScore(game, 'home' | 'away')` — player sum → `teamStats.total_points` → `finalScore`
- `hasPlayerBoxScore(game, teamId)` — any `gameStats` for that team's players
- `getPlayersWhoPlayed(game, team)` — filter `minutes_played > 0` OR has row in `gameStats` with any counting stat
- `getGameLeaders(game, statKey)` — returns `{ value, players: Player[] }` with **all ties**
- `formatOptionalTeamStat(value: number | null | undefined)` → number string or `"No stats recorded"`
- `getTeamStatDisplay(game, side, field)` — prefers `game.teamStats[side]`; never estimates

**Files to change:**

| File | Changes |
|------|---------|
| `src/utils/gameDisplay.ts` | New helpers (above) |
| `src/components/GameSummary.tsx` | Use `resolveSideScore`; add **Game Leaders** row above tabs |
| `src/components/BoxScore.tsx` | TEAM row +/- → `—`; filter DNP from tables; remove bottom Quick Stats (moved up); use `teamStats` for totals when present |
| `src/components/TeamStats.tsx` | Remove estimation block (lines 56–61); use `game.teamStats` + null semantics; DRB from `teamStats.drb` or sum player `drb`; filter chart to played players only; SUTD away panel shows 37 PTS + "No stats recorded" for rest |
| `src/App.tsx` | Optional: `TeamStats` fields `number \| null` for optional advanced stats |
| `Importingboxscores/.../game-2025-09-19-ntu-sutd.json` | `null` for unrecorded optional fields; away = score only |
| Re-run `npm run import:boxscore` | After JSON + type updates |

##### Executor task breakdown (B2 — one at a time)

- [x] **B2.1** Add `gameDisplay.ts` helpers (score resolve, leaders w/ ties, optional stat formatting)
- [x] **B2.2** Fix `GameSummary` header scores (SUTD 37) + leaders section above tabs
- [x] **B2.3** Fix `BoxScore`: team +/- blank; DNP filter; remove duplicate leaders
- [x] **B2.4** Fix `TeamStats`: remove fake estimates; use `teamStats` + null; DRB fix; chart filter; SUTD score-only UI
- [x] **B2.5** Update import JSON + re-import; verify all 5 QA items (build + import OK; **awaiting user manual QA**)

##### B2 manual QA gate

- Game header: **NTU 96 – SUTD 37**
- Box score TEAM row: **no +/-** value
- NTU team stats: **DRB 35**; paint/bench/fast break → **No stats recorded**
- SUTD: **37 points** visible; other team stats → **No stats recorded**
- Player Performance chart: **12 players** only (not 15)
- Leaders above box score; ties show multiple names if applicable
- Carl 10 PTS / Chengshan 17 PTS unchanged

#### Out of scope (Game 1)

- SUTD player roster or stats
- Play-by-play, shot charts, quarter splits (PDF has no quarter lines)
- Automating PDF parsing (Game 1 is hand-transcribed JSON; future games may repeat pattern)

#### Future games (Designer note)

- Reuse same ids for NTU players across Sunig box scores.
- Add SUTD players when a PDF includes them.
- Consider promoting JSON schema + import script to generic `npm run import:boxscore -- --file ...`.

---

## Dashboard UI Redesign (Designer — 2026-05-30)

### Background and Motivation

User feedback on the home dashboard after Sunig import:
- **Latest Games** shows truncated team names (`Nanyang Te…`, `Singapore Univers…`) — unreadable.
- Three equal-width cards force a horizontal “logo vs logo score” layout that cannot fit real team names (NTU full names are 30+ chars).
- Demo teams (Thunder Bolts) still show Unsplash logos; imported teams (NTU, SUTD) show **no avatar** — inconsistent.
- Card headers are center-aligned; preview lists use arbitrary array order (first 3 teams/tournaments), not “most relevant.”
- **Recent Games** page already uses a better match-row pattern (full names, abbreviations, centered score) — dashboard preview was never updated to match.

**Note:** Executor already fixed date sorting (`sortGamesByDateDesc`) locally; may need commit. Dashboard layout fix is separate.

### Key Challenges and Analysis

| Issue | Root cause | Design response |
|-------|------------|-----------------|
| Truncated names | Single-row flex with `truncate` in ~1/3 viewport width | Give Latest Games **full width** or ESPN-style **stacked row** |
| Missing logos for real teams | Hardcoded `getTeamLogo` map keyed on demo team names only | Shared **`TeamAvatar`**: `team.icon` → abbreviation fallback (already on `Team` model) |
| Cramped 3-column grid | All sections equal weight | **Asymmetric layout**: stats cards top, games full-width below |
| Inconsistent with app | `RecentGames.tsx` has mature layout; `Dashboard.tsx` diverged | Reuse same visual language (abbrev under name, score block) |
| “7 Games Completed” | Count is correct after sort fix; preview still only 3 | Keep count + “View all” link; show 3 **best-formatted** rows |

### Assumptions to challenge

- **Assumption:** Users need full team names always visible on dashboard.  
  **Counterpoint:** Abbreviation-primary (`NTU vs SUTD`) with full name on tooltip may suffice in a compact preview — but user explicitly complained names aren’t visible, so **full names must show** in the redesigned games section (at least on one line each or stacked home/away blocks).

- **Assumption:** Three equal cards is “balanced.”  
  **Counterpoint:** Games are the highest-value content post-import; they deserve more space than tournament/team counts.

### Proposed layout (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│  [Search bar — unchanged]                                    │
├──────────────────────────┬──────────────────────────────────┤
│  Tournaments        →    │  Teams                      →    │
│  3 active                │  7 created                       │
│  · Sunig 2025 (2)        │  · NTU (15)                      │
│  · IVP 2026 (0)          │  · SUTD (0)                      │
│  · Summer League (5)     │  · …                             │
├──────────────────────────┴──────────────────────────────────┤
│  Latest Games                                    View all → │
│  7 completed                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Sep 19, 2025 · Sunig 2025                               ││
│  │  NTU          96  –  37          SUTD                   ││
│  │  Nanyang Technological University                       ││
│  │  Singapore University of Technology and Design          ││
│  └─────────────────────────────────────────────────────────┘│
│  (2 more compact rows…)                                      │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:** Stack Tournaments → Teams → Latest Games (games still full width).

### Latest Games row spec (match card)

Each preview row (click → game summary):

| Zone | Content |
|------|---------|
| Meta line | `{short date} · {tournament name if linked}` |
| Match line | `{home abbrev}` **score** `{away abbrev}` — large, scannable |
| Names line | Full home name (left) · Full away name (right) OR stacked under each abbrev |
| Avatar | `TeamAvatar` both sides (abbrev fallback, no Unsplash hack) |

**Score:** Use `resolveSideScore` / `finalScore` (already correct for SUTD).

**Empty state:** “No completed games yet” + subtle CTA to Stats Entry.

### Tournaments / Teams card polish (lighter touch)

- Header: **left-aligned** title + optional `ChevronRight` “View all” (card still clickable).
- Preview lists: sort by **name** or **most teams** (pick: **name alphabetical** for predictability).
- Teams preview: prefer teams with **recent game activity** (optional v2 — v1: alphabetical first 3).
- Use shared `TeamAvatar` / tournament `Avatar` (already partially there).

### Shared components (Executor)

| Component | Purpose |
|-----------|---------|
| `TeamAvatar.tsx` | Icon, abbrev fallback, optional size sm/md |
| `DashboardGamePreview.tsx` | Single match row for dashboard |
| `DashboardStatCard.tsx` | Reusable card shell (icon, title, count, list slot) |

Extract **remove** duplicated `getTeamLogo` from `Dashboard.tsx` only in v1; defer RecentGames/TournamentPage dedup to optional follow-up.

### Out of scope (this task)

- Redesigning global header / search dropdown
- Tournament/team **detail** pages
- Custom team logo upload (future)
- Replacing all demo seed data in Supabase

### High-level task breakdown (Executor — one at a time)

- [ ] **D1** Create `TeamAvatar` + `DashboardStatCard` shells  
  **Success:** Renders NTU/SUTD with abbrev avatar; demo teams unchanged or use abbrev too.

- [ ] **D2** Restructure `Dashboard.tsx` grid: 2-col top (Tournaments \| Teams), full-width Latest Games below  
  **Success:** Latest Games card spans full container width on md+.

- [ ] **D3** Implement `DashboardGamePreview` row (full names visible, score, date, tournament)  
  **Success:** NTU vs SUTD row shows full names without truncation on desktop; abbrev + tooltip on mobile if needed.

- [ ] **D4** Wire `recentGames` (sorted completed, top 3); add “View all” affordance  
  **Success:** Sunig game is row 1; click opens game summary.

- [ ] **D5** Polish: left-aligned headers, consistent spacing, hover states  
  **Success:** Visual pass matches mockup; `npm run build` passes.

- [ ] **D6** Commit pending `sortGamesByDateDesc` fix if not yet pushed  
  **Success:** Dashboard order matches date sort.

### D manual QA gate

- [ ] Latest Games row 1: **NTU vs SUTD**, **Sep 19, 2025**, score **96–37**
- [ ] Full team names readable (no `…` truncation on desktop ≥1024px)
- [ ] NTU/SUTD show abbrev avatars (not blank)
- [ ] Tournaments + Teams cards still navigate correctly
- [ ] Mobile: no horizontal overflow; names wrap or stack cleanly
- [ ] “View all” / card click → Recent Games list

---

#### Goal
- Make live game stat entry fast, reliable, and recoverable under real courtside pressure.

#### Assumptions to challenge
- Assumption: one stat keeper can keep up with every event using the current 3-pane layout.
  - Skeptic view: cognitive load is too high without quick-action presets and clearer state feedback.
- Assumption: in-memory `currentGame` is sufficient during live entry.
  - Skeptic view: refresh/navigation loss will happen in real use; resume must be first-class.
- Assumption: all events should have equal UI weight.
  - Skeptic view: 80/20 actions (made/missed 2, made/missed 3, FT, TO, foul, rebound, sub) need priority lanes.

#### End-to-end user workflow (target behavior)
1. **Pre-game setup (`/stats-entry`)**
   - Choose tournament, home team, opponent mode (tracked team only vs both teams).
   - Confirm rosters, jersey numbers, and starters.
   - Optional quick presets: period length, overtime rules, foul tracking mode.
   - Start game -> create active game record and navigate to `/live/:id`.
   - Success criteria: setup completed in under 60 seconds for a known roster.
2. **Live entry session (`/live/:id`)**
   - Persistent top status strip: period, clock, score, possession, foul counts, save state.
   - Primary action rail (one-tap common actions): +2, +3, FT make/miss, TO, foul, rebound, substitution.
   - Context dialogs only when needed (assist, block, shot location, foul type, sub pairings).
   - Immediate optimistic update to scoreboard + play-by-play + player/team totals.
   - Undo always available for last action chain.
   - Success criteria: common event recorded in <= 2 taps and <= 2 seconds.
3. **In-game resilience**
   - Auto-save every meaningful state change with visible status transitions:
     `Saving...` -> `Saved` or `Save failed (retrying...)`.
   - Recovery path: reload `/live/:id` restores active game session from persisted data.
   - Conflict guard: if stale client state detected, notify and offer reload.
   - Success criteria: refresh does not lose active game context.
4. **End game and finalize**
   - End period flow supports Q1-Q4/OT progression; explicit "Finalize game" action after game end.
   - Finalize confirms score, marks `isCompleted`, persists final payload, clears active session.
   - Redirect to `/games/:id` summary, with links back to tournament and recent games.
   - Success criteria: final game appears in history and tournament views immediately.
5. **Post-game corrections**
   - Lightweight correction mode from summary page:
     - edit/remove recent events
     - auto-recompute box score and team totals
   - Audit trail retained in events log.
   - Success criteria: common correction can be completed without replaying full game.

#### Product decisions still open (post Step 1)
- Device priority: phone-first, tablet-first, or laptop-first layout optimization.
- Must-have recovery: full resume on reload now vs defer.
- Correction depth: only last-N events editable vs full event timeline editing.
- ~~Abandoned-game orphan teams~~ → resolved: in-progress games persist + resume (task 1.9).

#### Recommended phased execution (small milestones)
- Phase 1: finalize + persistence integrity (end-game action, summary visibility, tournament linkage).
- Phase 2: save-state UX + resume-on-refresh for `/live/:id`.
- Phase 3: fast action rail and dialog reduction for top 80/20 events.
- Phase 4: post-game correction tools.
- Phase 5: polish (keyboard shortcuts, mobile ergonomics, visual density tuning).

#### Validation plan (manual acceptance)
- Start a new game from setup with existing teams and with ad-hoc opponent.
- Record a representative quarter (shots, rebounds, fouls, substitutions, turnovers).
- Refresh mid-game and confirm session restore.
- Finalize game and verify `/games/:id` plus tournament game list.
- Perform one post-game correction and verify derived stats update consistently.

### Manual test gate (required after each milestone)
- Setup new game works from `/stats-entry`.
- Live entry works at `/live/:id`.
- Completing game persists and shows in `/games/:id`.
- Refresh on deep links keeps context.
- No blank pages or console-breaking runtime errors.

---

## 3) Completed Milestones (Condensed)

### Stability & UX
- Fixed multiple white-screen causes (dialog control conflicts, null checks, player/team page defensive guards).
- Added error boundaries for critical screens.
- Fixed input focus-loss regressions by form/input refactoring.
- Fixed `/teams` blank route crash (TeamManager stale form state references).

### Data & backend
- Supabase schema created and tracked in repo.
- One-time import from localStorage backup completed successfully.
- App wired to load/save through Supabase when configured.

### Deployment
- Vercel deployment configured and live.
- Environment variable workflow validated.

### Routing
- Router-based navigation implemented.
- Canonical URL format: slug + stable id (`:slug--:id`).
- Tabs encoded in query params (`?tab=...`).
- SPA deep-link refresh support added.

---

## 4) Stats Entry Feature (Focused Summary)

### Scope
- `GameSetup.tsx`: team selection/creation, roster prep, game initialization.
- `LiveGameEntry.tsx`: live action capture, event log, score updates, shot tracking.
- `ActionFlowDialogs.tsx`: substitutions and event-detail workflows.
- Completion path: finalize game, persist stats, surface in summaries/history.

### Known strengths
- Comprehensive event/stat model already exists.
- Court + play-by-play + team/player stat structures are in place.
- Game summaries and downstream analytics are already connected.

### Current gaps to resolve next
- End-to-end QA confidence for all stats-entry paths is still insufficient.
- UX speed under live conditions (few-click actions, error-proof input) needs polish.
- Save-status visibility for users should be explicit.

---

## 5) Routing & Navigation Contract

### Canonical paths
- `/`
- `/tournaments`
- `/tournaments/:slug--:id?tab=home|teams|standings|players|games`
- `/teams`
- `/teams/:slug--:id?tab=overview|roster|stats|games`
- `/players/:slug--:id?tab=overview|gamelog|stats|advanced`
- `/games`
- `/games/:id`
- `/stats-entry`
- `/live/:id`

### Rules
- ID is source of truth; slug is canonicalized for readability.
- Invalid IDs render NotFound (no silent fallback).
- Legacy short aliases (`/t/:id`, etc.) are deferred for now.

---

## 6) Supabase & Data Model (Trimmed)

### High-level storage mapping
- Teams + players: normalized tables.
- Tournaments + tournament-team links.
- Games as primary records with JSON fields for rich stats payloads:
  - `game_stats`, `team_stats`, `shots`, `events`, `lineup_stints`.

### Important note
- Season/player aggregates are computed from game stats, not stored as separate aggregate tables.

### Operational note
- Import tooling is idempotent (`upsert`) and can be rerun safely.

---

## 7) Deployment (Current)

- Host: Vercel.
- Build: `npm run build`.
- Output: `build`.
- Required env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Deep-link support configured via rewrite rule.

---

## 8) Security / Auth Status

- Phase C (Google auth + strict RLS membership policies) is paused by decision.
- Until Phase C is implemented, treat the app URL as private/shared-with-trusted-testers only.

---

## 9) Lessons (Evergreen Only)

- Prefer stable, extracted form components; avoid fragile inline form state patterns.
- Defensive null checks on data-rich views prevent white-screen failures.
- For Vite, env vars are build-time; redeploy is required after env changes.
- Never commit `.env.local` or secret keys.
- Keep migration/import scripts idempotent.

---

## 10) Archive Policy

- Removed verbose, duplicate investigation logs and superseded plans.
- Detailed migration internals intentionally trimmed (per user request).
- If needed later, re-open from git history rather than re-expanding this file.

---

## 11) Status Board (Short)

- [x] Supabase connected and app persistence wired.
- [x] Production deploy live and functioning.
- [x] URL routing migration complete.
- [x] Stats Entry Step 1: Game Setup revamp (1.1–1.9, QA complete).
- [x] Stats Entry Step 1.5: Active session (resume, single active, delete game, QA complete).
- [x] Stats Entry Step 1.6: Delete setup-added players on existing teams (QA complete).
- [x] Dashboard UI redesign (D1–D5) — user QA complete (2026-05-30).
- [x] Sunig Game 1 display fixes (B2) — user QA sign-off (2026-05-30).
- [x] Team abbreviation 3–5 chars — verified done.
- [x] Team delete persistence — user QA complete (2026-05-30).
- [x] Team roster list view + sortable columns — done.
- [ ] **D6 / release:** commit + push local UI fixes (pending user request).
- [ ] **B4 Sunig Game 3: NTU vs NUS** (Designer plan — awaiting user answers).
- [ ] **B3.5 Manual QA** — box score starters/bench (Executor done B3.1–B3.4; user verify).
- [x] **B2 Sunig Game 2: NTU vs SIT import** (JSON + Supabase import done; B2.5 QA pending).
- [ ] **P1 Team Stats player table + tournament filter** (T1–T4 done; T5 user QA).
- [ ] Stats Entry live entry + finalize (Steps 2+) — **paused** (user decision 2026-05-30).
- [ ] Save/sync status indicator in UI.
- [ ] Phase C auth + RLS hardening (later).

---

### **C6.9 — NTU crest dark details punched out (Designer, 2026-05-31)**

User report: On black `TeamBadge` background, **dark areas inside the NTU crest** (lion mane, outlines) look **transparent/wrong** — black shows through where solid dark blue/black artwork should be.

#### Root cause (Designer analysis — verified with pixel audit)

| Factor | Finding |
|--------|---------|
| **Script** | `scripts/normalize-team-icon.py` lines 24–25 |
| **Logic** | Any pixel with `max(R,G,B) < 50` → forced **alpha = 0** (treated as background) |
| **NTU mane color** | Dark navy e.g. `[13, 24, 46]` → max channel **46 < 50** → **incorrectly deleted** |
| **Scale of damage** | ~**144k pixels** keyed out at threshold 50; only **14** dark pixels survived in current asset |
| **User's source** | Screenshot shows correct crest on **white** outer background with intact dark mane — our script destroyed interior darks |

**What user sees:** Not that crest black is transparent in the source — the **normalized PNG has holes** where dark artwork was removed; the black **badge background** shows through those holes.

**Secondary issue:** ~11.5k pixels have **partial alpha** (JPEG/compression artifacts) → soft halos at edges.

#### Product decision (Designer recommendation)

1. **Stop global dark-pixel keying** — never remove pixels by `max(RGB) < N` alone; crest art legitimately uses dark blues/blacks.
2. **Border flood-fill background removal** — sample corner color(s); remove only pixels **connected to the image border** within tolerance (standard logo matting).
   - For **white-bg sources** (user's screenshot): flood **near-white** from corners (`min(RGB) > 240` or similar).
   - For **black-bg sources**: flood near-black from corners only — **interior dark mane untouched**.
3. **`--bg auto|white|black|none` CLI flag** on normalize script; default `auto` from corner samples.
4. **Re-source NTU** — user drops clean PNG (white outer bg OK) into `public/team-logos/team-sunig-ntu.png` **before** re-run (screenshot asset is the right reference).
5. **Optional `--bake-bg #000`** — composite final crest onto opaque black 512×512 so asset matches badge UI exactly (eliminates all alpha edge cases). Recommended since badges are always black now.
6. **No `TeamBadge` CSS change needed** — fix is asset pipeline only.

#### High-level task breakdown (Executor)

- [x] **C6.9.1 — Rewrite `normalize-team-icon.py`**: border flood-fill; remove global dark threshold ✅
- [x] **C6.9.2 — Add `--bg` and `--bake-bg` flags** ✅
- [x] **C6.9.3 — User replaces NTU source PNG** ✅ (vector export PNG provided)
- [x] **C6.9.4 — Re-run normalize** ✅ — 3804 dark-blue mane pixels preserved; baked `#000`
- [ ] **C6.9.5 — User QA** on black badges at md + hero sizes

#### Success criteria

- Lion **dark blue mane + tail** solid on black badge (no see-through holes).
- Outer background transparent (or baked black) — no white fringing.
- Script safe for future institute logos (won't eat dark crest details).

**Designer confidence: ~95%** — root cause confirmed in code + pixel counts.

**User action before Executor:** Replace `public/team-logos/team-sunig-ntu.png` with the clean white-background crest (like screenshot), then say **Executor mode**.

---

### **C7 — Team logo editor in Team Manager (Designer, 2026-05-31)**

User request: Enable editing team logos through Team Manager — possibly a fixed crop window + bg removal + transparency. **Designer mode** — recommend best approach (not bound to user's crop-window idea).

#### Current state

| Piece | Today |
|-------|--------|
| **Team Manager** | `TeamForm` → `TeamIconField`: raw file → data URL → Supabase `teams.icon` |
| **Processing** | **None in browser** — Python `normalize-team-icon.py` is CLI-only |
| **Display** | `TeamBadge` — fixed square slot, `object-fit: contain`, transparent outside crest |
| **Storage** | Data URLs in DB, **512 KB** limit (`TEAM_ICON_MAX_BYTES`) |
| **Tournament create team** | Inline form — **no icon field** (gap) |
| **Bundled logos** | `BUNDLED_TEAM_ICONS` fallback when DB icon empty |

**Gap:** Upload saves unprocessed JPEG/PNG → bad bg, wrong size, or broken dark details unless user pre-processes offline.

#### Evaluating user's idea (fixed crop window)

| Aspect | Verdict |
|--------|---------|
| Fixed **square** crop window | **Reject** — heraldic shields are tall; square crop caused filler / tiny crest (C6.7–C6.9 lessons) |
| User **adjust** framing | **Good** — pan/zoom or drag crop handles |
| Auto **bg removal** | **Good** — but must be **preview + undo**, not silent on upload |
| Process on upload | **Good** — must run **client-side** (no backend in Vite app today) |

#### Recommended solution: **Logo Editor dialog** (not silent auto-crop)

**Flow:**

```
Upload → Logo Editor (modal) → Apply → data URL saved → TeamForm submit → Supabase
```

**Editor UI (single dialog, ~600px wide):**

1. **Source pane** — uploaded image with pan/zoom; optional rectangular crop overlay (free aspect, **not** forced square).
2. **Controls:**
   - **Background:** `Auto` | `White` | `Black` (same semantics as Python flood-fill)
   - **Trim:** Auto tight-trim (default on) + optional padding slider 0–8px
   - **Reset** to original upload
3. **Live preview row** — `TeamBadge` at **md (24px)**, **lg (32px)**, **hero (64px)** on checkerboard (shows transparency).
4. **Actions:** Cancel | **Apply logo**

**Default path (80% case):** Upload → editor opens → Auto bg + auto trim already applied → user confirms → Apply. No manual crop required.

**Advanced path:** Wrong bg detected → switch White/Black; still too much junk → drag crop; preview updates live.

**Explicitly NOT in v1:** ML background removal libraries, square-only crop, baking black bg (user prefers transparent crest).

#### Technical approach

**C7.1 — Port normalize pipeline to TypeScript (browser Canvas)**

New `src/utils/teamIconNormalize.ts`:

- `loadImageFromFile / dataUrl` → `ImageData`
- `removeBorderBackground(imageData, mode: 'auto'|'white'|'black')` — BFS flood from edges (port of Python)
- `trimAndResize(imageData, { paddingPx, maxSize: 512 })` — tight bbox, preserve aspect
- `imageDataToPngDataUrl(imageData)` — `canvas.toDataURL('image/png')`
- Unit tests with fixture pixels (mane color not removed when disconnected from border)

Keep Python script for dev/batch (`public/team-logos/` seeding); **single algorithm, two runtimes**.

**C7.2 — `TeamLogoEditorDialog` component**

- Props: `open`, `sourceDataUrl`, `onApply(processedDataUrl)`, `onCancel`
- Internal state: working copy, bg mode, crop rect (optional), processing debounced ~200ms
- Uses Dialog from ui/dialog

**C7.3 — Upgrade `TeamIconField`**

- Upload opens editor instead of immediate `onChange`
- Edit existing icon → re-open editor with current value
- Remove URL paste in v1? **Keep** for power users but warn "may need manual editing"
- Update help text: processed transparent PNG, max 512px longest side

**C7.4 — Size / storage guards**

- After processing, if data URL > 512 KB → reduce max dimension (448 → 384) or PNG re-encode loop
- Reject if still too large with clear error

**C7.5 — Wire TournamentPage create-team**

- Replace inline team form with `TeamForm` **or** add `TeamIconField` — same editor everywhere

**C7.6 — SVG**

- Rasterize SVG to canvas at 512px max then run same pipeline; or skip bg removal if already transparent

#### Out of scope (C7 v1)

- Supabase Storage bucket (still data URLs)
- Bundled `public/team-logos/` auto-sync on upload
- Eraser brush / manual mask repair (v2 if flood-fill fails often)
- Replace bundled NTU icon when user clears upload (already: DB icon wins)

#### High-level task breakdown (Executor — one step at a time)

- [x] **C7.1 — `teamIconNormalize.ts`** ✅ — flood-fill + trim + size limit
- [x] **C7.2 — `TeamLogoEditorDialog`** ✅ — bg toggle, padding slider, md/lg/hero previews
- [x] **C7.3 — Integrate into `TeamIconField`** ✅ — upload/URL opens editor; Edit logo button
- [x] **C7.4 — Storage size guard** ✅ — `processTeamIconWithSizeLimit`
- [x] **C7.5 — TournamentPage create-team icon field** ✅
- [ ] **C7.6 — User QA** — upload white-bg + black-bg crest in Team Manager + tournament create

#### Success criteria

- User uploads institute crest in Team Manager → sees editor → Apply → logo matches NTU-quality pipeline (transparent, tight trim, dark mane intact).
- Preview matches final `TeamBadge` appearance at list + header sizes.
- No new backend; build passes; icons persist in Supabase after refresh.

**Designer confidence: ~88%** — Canvas port is straightforward; edge cases (JPEG halos, complex bg) mitigated by bg mode toggle + optional crop.

**Awaiting user approval for Executor C7.1.**

---

### **C8 — Tournament logos (Designer, 2026-05-31)**

User request: **Tournament logos**, same UX as team logos (upload → editor → bg removal → badge display everywhere).

#### Current state (Designer analysis)

| Area | Today |
|------|--------|
| **DB** | `tournaments.icon` column exists (`text`, nullable) — already loaded/saved in `supabaseData.ts` ✅ |
| **`Tournament.icon` type** | `icon?: string` on `Tournament` interface ✅ |
| **`TournamentForm`** | Name, description, year, month, teams — **no icon field** |
| **`TournamentManager`** | Create/edit dialogs — **no icon**; cards show Trophy + text only |
| **`TournamentPage` header** | Generic `<Trophy />` icon — **never renders `tournament.icon`** |
| **Dashboard recent tournaments** | `AvatarFallback` with `tournament.icon \|\| initials` — **broken for image icons** (would show raw `data:image/...` text in fallback) |
| **`ParticipatedTournamentBadges`** | Text badge + Trophy — no logo |
| **Processing pipeline** | `teamIconNormalize.ts` + `TeamLogoEditorDialog` — **team-only wiring** |
| **Bundled assets** | `public/team-logos/` for teams — **no `public/tournament-logos/` yet** |

**Good news:** No schema migration needed. This is UI + display parity on top of existing `tournament.icon` persistence.

**Known tournament IDs (for bundled fallbacks):**

| ID | Name |
|----|------|
| `tournament-sunig-2025` | Sunig 2025 |
| `tournament-ivp-2026` | IVP 2026 (if imported) |
| `tournament-summer-2024` | Summer League 2024 |

#### Recommended approach — mirror team logo stack (don't refactor teams)

Reuse the **same image pipeline** (`processTeamIconWithSizeLimit`, flood-fill, trim, 512 KB guard). Add tournament-specific **display + form** layers only.

```
Upload → Tournament Logo Editor (modal) → Apply → data URL → TournamentForm → Supabase tournaments.icon
```

**New files (parallel to team stack):**

| File | Role |
|------|------|
| `src/utils/tournamentIcon.ts` | `BUNDLED_TOURNAMENT_ICONS`, `resolveTournamentIconSrc()`, `getTournamentAvatarLabel()` (2–5 char abbrev via `generateTeamAbbreviation`), re-export `readTeamIconFile` / accept constants |
| `src/components/TournamentBadge.tsx` | Fixed square slot + `object-fit: contain` + initials fallback (same sizing tokens as `TeamBadge`) |
| `src/components/TournamentLogoEditorDialog.tsx` | Same controls as team editor (bg mode, padding slider, checkerboard preview, md/lg/hero badge row) — previews use `TournamentBadge` |
| `src/components/TournamentIconField.tsx` | Upload / URL / Edit / Remove — mirrors `TeamIconField` |

**Optional small DRY (Executor choice):** Extract shared checkerboard + processing UI from both editor dialogs into a private helper — **not required for v1** if it risks touching stable team code.

#### Fallback when no logo (user decision — locked)

- **Square badge with 2–5 letter abbreviation** derived from tournament name — **reuse** `generateTeamAbbreviation(name)` from `teamAbbreviation.ts` (same rules as teams: multi-word → first letters, min 2 / max 5, stop words skipped).
- Reuse `getTeamAvatarLabelClass()` for smaller text when label is 4–5 chars (fits small badge slots).
- **Summer League 2024:** no bundled image — abbreviation only (e.g. `SL2` / `SUML` depending on generator).
- No Trophy icon in badge slots — keeps visual parity with `TeamBadge`.

#### Display sites to wire (v1)

| Location | Change |
|----------|--------|
| **Tournament Manager** — create/edit form | `TournamentIconField` |
| **Tournament Manager** — card grid | `TournamentBadge` + name |
| **Tournament Page** — header | `TournamentBadge size="hero"` replaces Trophy |
| **Dashboard** — recent tournaments list | `TournamentBadge size="sm"` (fixes broken Avatar fallback) |
| **`ParticipatedTournamentBadges`** | Mini `TournamentBadge` + name (replace Trophy) |

**Defer v1.1 (optional):** Game Setup tournament `<SelectItem>` with badge — nice polish, not blocking.

#### Bundled tournament logos (user decision — locked)

**User has source assets ready** (Sunig + IVP only; **no** Summer League logo).

| Tournament | Bundled? | Source (today) | Normalized output |
|------------|----------|----------------|-------------------|
| `tournament-sunig-2025` | ✅ | `public/Tournamentlogos/480x288-sunig24db92be-….webp` | `public/tournament-logos/tournament-sunig-2025.png` |
| IVP 2026 | ✅ | `public/Tournamentlogos/480-x-288-ivp-logoee76c56b-….webp` | `public/tournament-logos/tournament-ivp-2026.png` (confirm exact tournament id in Supabase on C8.7) |
| `tournament-summer-2024` | ❌ | — | Abbreviation fallback only |

**C8.7 Executor steps:**

1. Create `public/tournament-logos/` + `ATTRIBUTION.md` (mirror team-logos layout).
2. Run `npm run normalize:team-icon` (or equivalent) on each WebP → transparent tight PNG, max 512px longest side, **no square padding**.
3. Register paths in `BUNDLED_TOURNAMENT_ICONS` keyed by stable tournament id.
4. DB `tournaments.icon` still wins when user uploads via UI; bundled is fallback when DB empty.

**Note:** Raw assets live under `public/Tournamentlogos/` (legacy folder); normalized canonical copies go under `public/tournament-logos/` (kebab-case, matches `team-logos`).

#### Out of scope (C8 v1 — same as C7)

- Supabase Storage bucket (still data URLs in Postgres)
- Auto-replace bundled icon when user clears upload (DB icon wins when set)
- ML bg removal / manual eraser brush
- Forced square crop

#### High-level task breakdown (Executor — one step at a time)

- [x] **C8.1 — `tournamentIcon.ts`** ✅
- [x] **C8.2 — `TournamentBadge`** ✅
- [x] **C8.3 — `TournamentLogoEditorDialog`** ✅
- [x] **C8.4 — `TournamentIconField`** ✅
- [x] **C8.5 — Wire `TournamentForm` + `TournamentManager`** ✅
- [x] **C8.6 — Wire display** ✅ — TournamentPage header, Manager cards, Dashboard, ParticipatedTournamentBadges
- [x] **C8.7 — Bundled assets** ✅ — Sunig + IVP normalized PNGs in `public/tournament-logos/`
- [ ] **C8.8 — User QA**

#### Success criteria

- Create/edit tournament in Tournament Manager → upload logo → editor → Apply → logo visible on Manager card + Tournament page header + Dashboard.
- Same transparent, tight-trim quality as team logos (shared pipeline).
- No Supabase schema changes; build passes; icons persist after hard refresh.
- Dashboard no longer shows garbled `data:image/...` text when icon is set.

#### User decisions (locked 2026-05-31)

1. **Bundled logos:** Sunig 2025 + IVP 2026 assets **already provided** (`public/Tournamentlogos/*.webp`). Summer League 2024 — **no logo**; abbreviation badge only.
2. **Fallback:** **2–5 letter** abbreviations (same generator as teams), not fixed 2-letter initials.

**Designer confidence: ~95%** — assets on disk; team pipeline reusable; only IVP tournament id needs verification at C8.7.

**Awaiting user “Executor mode” to start C8.1.**

---

### **C9 — Tournament page “Create Team” dialog closes on keystroke (Designer, 2026-06-01)**

User report: On **Tournament → Teams tab**, clicking **Create New Team** opens a popup, but **every keystroke** makes the dialog glitch, disappear, and the tab “refreshes” — cannot create a team.

Screenshot context: empty tournament (0 teams), e.g. “National Basketball League (Men) Division 2 2024”.

#### Root cause (confirmed in code)

**Anti-pattern:** `TournamentPage.tsx` defines tab bodies as **inline component functions** inside the render body:

```tsx
const HomeTab = () => ( ... );
const TeamsTab = () => ( ... );  // Create Team Dialog lives HERE
// ...
<TabsContent value="teams"><TeamsTab /></TabsContent>
```

On **every parent re-render**, `TeamsTab` is a **new function reference** → React treats it as a **different component type** → **full unmount + remount** of the entire Teams tab subtree (including the Dialog, form, and inputs).

**Trigger introduced in C7/C8:** Create-team form `onChange` handlers call:

- `setTeamIconPreviewName(e.target.value)` (team name input)
- `setTeamIconPreviewAbbrev(e.target.value)` (abbreviation input)

Each keystroke → state update → `TournamentPage` re-renders → `TeamsTab` remounts → dialog destroyed/recreated → user sees flicker/close/reset (“whole thing refreshes”).

Dialog open state (`isCreateTeamDialogOpen`) lives in the **parent** and stays `true`, but the **Dialog DOM unmounts** — Radix portal loses focus/state; form `defaultValue=""` inputs reset on remount.

**Same latent bug** exists for all five inline tabs (`HomeTab`, `TeamsTab`, `StandingsTab`, `PlayersTab`, `GamesTab`). Also present on `TeamPage.tsx` (four inline tabs) — not reported yet.

#### Why Team Manager works

`TeamManager` renders `<Dialog>` + `<TeamForm>` at **page level** — not inside a remounting inline tab component. Keystrokes only re-render `TeamForm`, not destroy the dialog tree.

#### Recommended fix (Executor)

**Primary (structural — fixes root cause):**

1. **Hoist both team dialogs** (`Create New Team`, `Add Team`) to **`TournamentPage` root return** — siblings of `<Tabs>`, **not** inside `TeamsTab`.
2. **Replace inline create-team form** with shared **`TeamForm`** (same as Team Manager / C7.5 intent):
   - `initialTournamentIds={[tournament.id]}` — current tournament pre-selected
   - Optional prop `hideTournamentPicker?: boolean` when creating from tournament context (or show picker with current tournament checked + disabled)
   - `onSubmit` → `onCreateTeam({ name, abbreviation, icon, players: [] }, { tournamentIds: [tournament.id] })`
   - `createFormKey` increment on open (reset form between opens — TeamManager pattern)
3. **Delete** `teamIconPreviewName`, `teamIconPreviewAbbrev`, inline refs form, and `handleCreateTeam` inline form handler from `TeamsTab`.

**Secondary (optional hardening — can defer):**

4. Refactor inline `HomeTab` / `StandingsTab` / etc. to **plain JSX variables** (`const teamsTabContent = (...)` ) or **module-level components** — prevents remount on unrelated state changes. Lower priority if dialogs are hoisted.

**Do NOT use as sole fix:** removing `setTeamIconPreviewName` only — would stop the trigger but **any future state update** in `TournamentPage` would still remount tabs.

#### High-level task breakdown (Executor)

- [x] **C9.1 — Hoist Create Team + Add Team dialogs** ✅
- [x] **C9.2 — Replace inline form with `TeamForm`** ✅ + `hideTournamentPicker` prop
- [x] **C9.3 — Verify** ✅ — build passes
- [ ] **C9.4 — User QA**

#### Success criteria

- Create Team dialog stays open and stable while typing in all fields.
- Team created successfully and appears in tournament teams list.
- No full-tab flash/remount on keystroke.
- Build passes.

**Designer confidence: ~98%** — classic React inline-component remount bug; trigger line identified; fix pattern proven in TeamManager.

**Awaiting user “Executor mode” for C9.1.**

---

### **C10 — Global players + multi-team rosters (Designer, 2026-06-01 — REVISED)**

User request (clarified): **Players are independent** — same person, **same `player.id`**, can appear on **multiple teams / tournaments**. No copying or new IDs. Player profile shows **stats across all tournaments and teams**. Add Player: **searchable dropdown** of the whole player pool.

This is a **data-model change**, not just a UI toggle.

#### Current state (blockers)

| Area | Today | Problem for multi-team |
|------|--------|-------------------------|
| **DB `players`** | `team_id NOT NULL` — one team per row | Cannot link same player to Kai Xuan + NTU |
| **App `Team.players[]`** | Nested roster; player “belongs” to one team | Add to team B requires duplicate or move |
| **Game stats** | `gameStats[].playerId` only | ✅ Already global — Sunig stats stay linked if same ID |
| **PlayerPage stats** | Filters games by `playerId` | ✅ Cross-tournament totals mostly work |
| **PlayerPage UI** | Single `team` in header; `#player.number` global | Wrong when # differs per team |
| **Game log** | Uses route `team.id` for home/away | Breaks when player played for another team |
| **Tournament stats rows** | Group by tournament only | Need **Team** column when player switched teams |
| **`findPlayer()`** | Returns first team containing ID | Ambiguous for multi-team |

#### Target model (Designer recommendation)

**Split identity vs roster:**

```
players (global)          team_players (roster link)
─────────────────         ───────────────────────────
id                        team_id + player_id (PK)
league_id                 number, position, secondary_position
name, height, weight…     (jersey/role can differ per team)
```

- **`players`**: who they are (profile shared everywhere).
- **`team_players`**: which teams they’re on + jersey # / position **for that team**.
- **Add to second team**: insert junction row only — **same player ID**.
- **Remove from team**: delete junction row; keep global player + all game stats.
- **App hydration**: still build `team.players[]` from join (minimal UI churn).

**Stats:** `gameStats.playerId` unchanged. Profile aggregates all games for that ID. Derive “which team in this game” from home/away roster membership.

#### UI — Add Player dialog

| Mode | Behavior |
|------|----------|
| **New player** | Create global `players` row + `team_players` link |
| **Existing player** | Searchable **Command/combobox** over **full league pool**; exclude already on this team; on select → set **# / position for this team** → add link |

Hoist dialog outside inline `RosterTab` on TeamPage. Wire TeamPage + TeamManager.

#### Player profile (same epic)

- Header: list **all teams** player is on.
- Stats tab: tournament rows include **Team** column.
- Game log: home/away per game from roster, not route context.

#### Migration

1. Create `team_players`; copy from existing `players.team_id` rows.
2. Add `players.league_id`; drop/deprecate `players.team_id`.
3. Verify NTU player IDs + Sunig box scores unchanged.

#### User decisions (locked 2026-06-01)

1. **Jersey # and position:** **Per team** on `team_players` (e.g. #22 NTU, #10 Kai Xuan).
2. **Remove from roster:** **Unlink only** — global `players` row + all game stats preserved.
3. **Same player, two teams, same tournament:** **Not allowed** — block at roster-add time (see rule below).
4. **Player page header:** Show **all teams** the player is on (badges/links), not single context team.

#### Same-tournament conflict rule (Designer)

A player may be on **multiple teams** only if those teams share **no tournament** in common.

**Validation on “Add existing player to team”:**

```
sharedTournament = ∃ T : targetTeam ∈ T.teams AND otherTeam ∈ T.teams
                 where otherTeam is any team that already rosters this player
if sharedTournament → reject with clear error message
```

**Examples:**

| Player on | Adding to | Sunig 2025 | IVP 2026 | OK? |
|-----------|-----------|------------|----------|-----|
| NTU (Sunig+IVP) | Kai Xuan (new tourney only) | — | — | ✅ |
| NTU (Sunig only) | NUS (Sunig only) | overlap | — | ❌ |
| NTU | Kai Xuan | no overlap | — | ✅ |

**Also validate when:**

- **Adding a team to a tournament** (`tournament_teams`) — if any player appears on both that team and another team already in the tournament → block (or warn — **see open Q5**).
- **Creating team in tournament + picking existing players** — same roster rule.

Helper: `getPlayerTeamIds(playerId)`, `getTeamTournamentIds(teamId)`, `wouldRosterViolateTournamentOverlap(playerId, targetTeamId)`.

#### Profile edits (Designer assumption — confirm if wrong)

Editing name / height / weight / DOB on **Player page** updates the **global** `players` row → reflects everywhere. Jersey # / position edits on Player page should target **which team’s roster row?** — **see open Q6**.

#### Player page header (locked UI)

```
[Photo] Carl Belanger
#22 NTU · #10 Kai Xuan   ← per-team jersey in subtitle OR team badges each with #
[NTU badge] [Kai Xuan badge]   ← all teams, clickable → team page
PG • 6'3" • …
```

Stats tab: rows grouped by **tournament**, **Team** column shows which team they played for in that tournament (one team per tournament given Q3).

#### Open questions (remaining)

5. **Tournament enrollment conflict:** If NTU roster includes Carl and admin adds **Kai Xuan** to Sunig where NTU already plays — **block** adding Kai Xuan to Sunig, or only block adding Carl to Kai Xuan’s roster? *(Designer recommends: block **both directions** — any action that would put same player on two teams in one tournament.)*

6. **Editing # / position on Player page:** Edit **all teams at once**, **pick a team** dropdown, or **only editable from Team roster** (per-team fields live on team page)? *(Designer recommends: edit per-team roster fields from **Team roster** or Player page with **team selector**.)*

#### Phased tasks (Executor)

- **C10.1** — Supabase migration: `team_players`, `players.league_id`, migrate data
- **C10.2** — Load/save + hydrate `team.players[]` from join
- **C10.3** — App handlers + `wouldRosterViolateTournamentOverlap()`
- **C10.4** — `AddPlayerDialog` (New | Existing + searchable combobox)
- **C10.5** — Wire TeamPage + TeamManager; hoist dialog
- **C10.6** — PlayerPage: all-teams header, per-game team in game log
- **C10.7** — Stats tab: Team column; cross-tournament breakdown
- **C10.8** — User QA

#### Success criteria

- Same player ID on multiple teams (different tournaments); no copy.
- Block adding player to second team in shared tournament.
- Sunig stats remain on profile after joining new team in different tournament.
- Searchable full player pool; header shows all teams.

**Designer confidence: ~93%** — pending Q5–Q6 (minor UX); ready for Executor C10.1 once confirmed or defaults accepted.

**Awaiting Q5–Q6 or “Executor mode” (Designer defaults OK).**

---

## Project Status Board

- [x] B4 Game 3 (NUS vs NTU, 2025-09-26) — JSON created, stats-only import complete, player profiles verified unchanged
- [ ] B4.5 User QA — confirm score NUS 39 / NTU 70, box score starter/bench order on game page
- [x] B5 Game 4 (SUSS vs NTU, 2025-09-29) — JSON created, stats-only import complete, player profiles verified unchanged
- [ ] B5.5 User QA — confirm score NTU 86 / SUSS 41, starters, box score order
- [x] C1 Player Performance chart — sort x-axis by minutes desc (C1.1 done; awaiting C1.2 QA)
- [x] **C7 Team logo editor (Team Manager)** — C7.1–C7.5 complete; awaiting C7.6 user QA
- [ ] **C8 Tournament logos** — C8.1–C8.7 complete; awaiting C8.8 user QA
- [ ] **C9 Tournament create-team dialog bug** — C9.1–C9.3 complete; awaiting C9.4 user QA
- [ ] **C10 Global players + multi-team rosters** — C10.1–C10.7 complete; awaiting C10.8 user QA
- [x] B6 Game 5 finale (NUS vs NTU, 2025-10-03) — JSON created, stats-only import complete, player profiles verified unchanged
- [ ] B6.4 User QA — confirm score NUS 45 / NTU 80, starters, box score order
- [x] N1 Smart back navigation — N1.1–N1.4 implemented; awaiting N1.5 user QA
- [x] Player position display task - Step 2 apply helper to both player page render sites
- [x] Player position display task - Step 3 manual smoke test checklist documented/executed (build + targeted UI checks)

---

## Current Status / Progress Tracking

- **C11 Player identity (2026-06-01):** **C11.1–C11.7 + C11.9 implemented.** Migration `003_player_global_position.sql`, global position in data layer, `PlayerJerseyGrid`, `PlayerTeamBadges`, overview layout (jerseys on name row, team badges + tournament badges below bio). Build passes. **User must run migration 003 in Supabase SQL Editor if not done.** Awaiting C11.8/C11.9 user QA.

---

## C11 — Player identity + global position (Designer, 2026-06-01) — **REVISED**

### Background

User QA: overview identity block is messy (C10.8). User proposed **Basketball Reference** pattern: plain jersey icons on the **right**, one per team-number, tooltip = team name. Also **reverses C10 Q1**: **position is global** on the player profile; **only jersey # varies per team**.

### Decision log (supersedes C10 Q1 / Q6 partial)

| Field | Was (C10) | Now (C11) |
|-------|-----------|-----------|
| Position / secondary | Per team (`team_players`) | **Global** (`players`) |
| Jersey # | Per team (`team_players`) | Per team (unchanged) |
| Name, height, weight, DOB | Global | Global (unchanged) |
| Add existing player | # + position + secondary | **Jersey # only** |
| Edit position on Player page | Per-team via roster selector | **Single global** in Edit dialog |
| Edit jersey # | Per team | Per team (Edit dialog section or team roster) |

**Rationale:** Position is an attribute of the athlete, not the roster slot. Jerseys differ by program (NTU #22 vs Kai Xuan #10). BBR-style grid communicates multi-team numbers without prose duplication.

**Migration note:** Existing data where Carl is PF/C on one team and C/PF on another → migration picks one (deterministic: existing `players` row if present, else lexicographically first `team_players` row). User can fix once in Edit Player after migration.

### Target layout — Overview identity card (BBR-inspired)

```
┌────────────────────────────────────────────────────────────────────┐
│  [Photo]   Carl Belanger                    ┌──┐ ┌──┐              │
│            PF/C                              │22│ │22│  ← plain     │
│            6'3" (191cm) · 88kg               └──┘ └──┘    jerseys  │
│            [IVP 2026]  [Sunig 2025]         tooltip: team name   │
└────────────────────────────────────────────────────────────────────┘
```

**Left column:** name → **global position** → bio (height · weight · age) → tournament badges.

**Right column:** `PlayerJerseyGrid` — neutral outline tank-top SVG, number centered, **no team colors**. One cell per `(team, number)` roster link. Hover/focus tooltip: `{Team full name} — #{number}`. Click jersey → navigate to that team page.

**Single-team player:** one jersey on the right (same component, grid of 1). Bio line does **not** repeat `#` in text — jersey carries number.

**Sticky header (above tabs):** name only — `← Back · Carl Belanger · Edit`. No subtitle duplication.

### New component: `PlayerJerseyGrid`

- Props: `{ entries: { team: Team; number: number }[]; onTeamClick? }`
- Plain gray stroke jersey SVG (~40×48px), number in `font-bold tabular-nums`
- Wrap grid, top-aligned beside name block on `md+`; stacks below name on mobile
- Same number on two teams → two jerseys (tooltips differ)

### Add existing player (simplified)

**Existing tab fields only:**
1. Search / pick player
2. Jersey number (with taken check on **target team**)
3. Submit

No position / secondary selects. Linked player keeps global position from profile.

### Edit Player dialog (revised)

**Global section:** name, position, secondary, height, weight, DOB (one set).

**Jersey numbers section** (when on 1+ teams): compact list or mini grid

| Team (abbrev) | # |
|---------------|---|
| NTU | 22 |
| KX | 22 |

Remove “Roster team selector” that switched which position you edit. Optional: remove per-team selector entirely — jerseys edited in table above.

**Team roster page** still shows position from global profile; editing player from team page opens same global rules.

### Schema change — migration `003_player_global_position.sql`

1. Add `position`, `secondary_position` to `players` (if not exists)
2. Backfill from `team_players` (one row per player_id, `ORDER BY team_id LIMIT 1`; if conflict, first wins — document)
3. Drop `position`, `secondary_position` from `team_players`
4. `team_players` retains: `team_id`, `player_id`, `number` only (+ timestamps)

Update: `supabaseData.ts` load/save, import script, `Player` hydration (position from profile row, number from junction).

### What we remove (UI)

- Per-team position in overview prose / roster chips (C11 v1 draft **cancelled** — no `PlayerRosterChip`)
- Duplicate team name badges separate from jerseys (jersey click + tooltip replaces)
- Position fields on Add Existing flow
- Per-team position editing via roster team selector on Player page

### What stays

- Tournament overlap validation (C10.3)
- Game log Team column (multi-team)
- Stats tab Team column per tournament
- Global player pool search

### Task breakdown (Executor — after user OK)

| Task | Scope | Success criteria |
|------|--------|------------------|
| **C11.1** | `003_player_global_position.sql` + backfill | Supabase saves position on `players`; `team_players` number-only |
| **C11.2** | `supabaseData.ts` + import script | Load/save round-trip; legacy fallback if needed |
| **C11.3** | `PlayerJerseyGrid.tsx` | Plain jerseys, tooltip, click → team |
| **C11.4** | PlayerPage overview + slim header | BBR layout; no duplicate prose |
| **C11.5** | `AddPlayerDialog` existing tab | Jersey # only |
| **C11.6** | Edit Player dialog | Global position; per-team # list |
| **C11.7** | Team roster / PlayerForm | Position always global; new player form unchanged |
| **C11.8** | User QA | Carl multi-team; add existing; edit position once updates everywhere |

**Designer confidence: ~96%**

### Open question (optional)

**Jersey edit location:** Edit dialog table only (default), or also inline click on jersey grid? Default: **edit via Edit Player** + team roster page; grid is display + navigate.

**Awaiting user “Executor mode” to start C11.1.**

---

## C11.9 — Player card layout revision (Designer, 2026-06-01)

### User feedback (post C11.4)

1. **Miss team list** — want teams listed under player details **like tournament badges** (clickable pills with logo + name).
2. **Jersey placement** — jerseys feel orphaned at bottom-right; should sit **on the same row** as name/avatar (BBR-style top band), not in a separate stacked row.

### Revised layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [Avatar]  Carl Belanger                         [22]  [22]       │
│           C/PF                                  (top-aligned)    │
│           6'3" (191cm) · 88kg · 24 years old                     │
│                                                                  │
│           [NTU badge + name]  [Kai Xuan badge + name]  ← outline │
│           [IVP 2026]  [Sunig 2025]                     ← solid  │
└──────────────────────────────────────────────────────────────────┘
```

**One horizontal band:** avatar + text column on the left, **jersey grid on the right**, both `items-start` (top-aligned). No `flex-col` breakpoint that drops jerseys below the card body.

### Teams row — restore (mirror tournaments)

New component **`PlayerTeamBadges`** (parallel to `ParticipatedTournamentBadges`):

| Property | Teams | Tournaments |
|----------|-------|-------------|
| Variant | `outline` | `default` (existing) |
| Icon | `TeamBadge` sm | `TournamentBadge` xs |
| Label | Full team name | Tournament name |
| Click | → team page | → tournament page |
| Data | `playerRosterEntries` / teams on roster | `participatedTournaments` |

Two badge rows under bio, **teams first**, then tournaments. Visual distinction: outline vs filled avoids needing "Teams:" labels.

**No duplication:** jerseys show **number only**; team badges show **who** — different jobs (BBR numbers vs roster membership).

### Jersey grid tweaks

- Parent: `flex flex-row items-start gap-6` (not `flex-col md:flex-row` with large gap pushing jerseys down).
- Jerseys: `shrink-0 self-start` on the right column.
- Mobile (`< sm`): optional — jerseys inline to the right of name on same row if they fit; else wrap jerseys directly under name row (still **above** badge rows, not at card bottom).

### What does NOT change

- Global position, migration 003, Add Existing jersey-only, edit dialog jersey table.
- Sticky header name-only.
- Jersey tooltips + click → team (jerseys remain a second path to team page — acceptable).

### Executor tasks (after approval)

| Task | Success criteria |
|------|------------------|
| **C11.9.1** | `PlayerTeamBadges.tsx` — outline badges, TeamBadge + name, clickable | **Done** |
| **C11.9.2** | Overview card: single top row (avatar + details + jerseys aligned top) | **Done** |
| **C11.9.3** | Teams row + tournaments row under bio; mobile sanity check | **Done (build pass) — awaiting user QA** |

**Designer confidence: ~98%** — no open questions; ready for Executor on user OK.

---

## C12 — Player Stats: age-at-tournament column (Designer, 2026-06-01)

### Background

User wants an **Age** column on the **Player page → Player Stats** tab (tournament-breakdown table), placed **immediately after Team**. Value = player age **during that tournament season**, not current age.

### Data available

| Field | Source | Notes |
|-------|--------|-------|
| Tournament season | `Tournament.year` + `Tournament.month` | e.g. `2026` + `"Apr"` — month is 3-letter abbrev |
| Player DOB | `Player.dateOfBirth` | ISO `YYYY-MM-DD` in DB |
| Stored `Player.age` | Profile | Current/legacy age — **do not use** for per-tournament rows |

Tournament date is **month + year only** (no day). Existing helper `getTournamentDateMs()` in `tournamentSort.ts` parses `"Apr 1, 2026"`.

### Age rule (user-specified)

Compare at **month granularity**:

```
age = tournamentYear - birthYear
if tournamentMonthIndex < birthMonthIndex:
  age -= 1
# if tournamentMonthIndex >= birthMonthIndex → birthday counted as passed
# (same month counts as passed — Apr tournament + Apr birthday → older age)
```

**Examples** (DOB 2002-04-15):

| Tournament | Age |
|------------|-----|
| Mar 2026 | 23 |
| Apr 2026 | 24 |
| May 2026 | 24 |

Parse DOB from `YYYY-MM-DD` string parts (avoid UTC timezone shift from `new Date(isoString)`).

Return `null` when: no DOB, invalid month, invalid DOB, or computed age &lt; 0.

### Row display rules

| Row | Age cell |
|-----|----------|
| Tournament row (IVP 2026, Sunig 2025) | Computed age |
| **All Time** summary | `-` |
| **No Tournament** | `-` |
| Missing DOB | `-` |

All Time stays pinned at bottom (existing C11 sort behavior).

### UI scope

**In scope:** Player page `PlayerStatsTab` only (`layout="tournament-breakdown"`).

**Out of scope (for now):** Team page player stats table, roster tab Age (already shows current age), Overview tab.

Column order when Team column visible:

```
Tournament | Team | Age | GP | MPG | …
```

When `showTeamColumn` is false (single team): **still show Age after Tournament** (Team column hidden but Age remains useful).

New table prop: `showAgeColumn?: boolean` — `true` from `PlayerStatsTab` only.

- Sortable **Age** header (numeric asc/desc)
- Tooltip: `"Age during this tournament season (month and year)"`
- Display: integer or `-`
- Style: match Team column (`text-sm`, centered)

### Implementation plan (Executor)

| Task | Work | Success criteria |
|------|------|------------------|
| **C12.1** | `src/utils/playerAge.ts` — `parseDateOnly`, `getPlayerAgeAtTournamentSeason(dob, month, year)`, month index map | **Done** |
| **C12.2** | Extend `PlayerSeasonRow` with `ageAtScope?: number \| null`; set in `buildPlayerTournamentSeasonRows` via tournament lookup | **Done** |
| **C12.3** | `PlayerStatsTable`: `showAgeColumn`, Age header + cell after Team; add `'Age'` to `PlayerStatsSortField` + sort branch | **Done** |
| **C12.4** | Wire `PlayerStatsTab`: `showAgeColumn` | **Done — awaiting user QA** |

### Edge cases

- **DOB missing:** column shows `-` (column still visible — prompts user to add DOB in Edit Player).
- **Invalid tournament month string:** `-` for that row; log nothing (silent).
- **Future tournament season:** if age &lt; 0, show `-`.
- **Timezone:** parse DOB as local calendar parts only.

### What does NOT change

- Team roster Age column (current age from stored `player.age`).
- Overview "24 years old" line (unchanged this epic).
- Tournament form month/year fields.

**Designer confidence: ~97%** — one optional question below; can proceed without answer using proposed default.

**Optional:** Should Overview age eventually derive from DOB instead of stored `player.age`? **Deferred** — not part of C12.

**Awaiting user “Executor mode” for C12.1.**

---

## C13 — Restore Yuanyang Tan + allow duplicate jersey numbers (Designer, 2026-06-01)

### Background

User reports **Yuanyang Tan** missing from app. Investigation (live Supabase query):

| Asset | Status |
|-------|--------|
| `players` row `player-sunig-ntu-12` | **Exists** — Yuanyang Tan, C, DOB 1994-12-18, 186cm/90kg |
| `team_players` link to NTU | **Missing** — orphaned profile |
| Game stats | **Present** in `game-sunig-2025-09-19-ntu-sutd`, `game-sunig-2025-09-29-ntu-suss` |
| NTU jersey #12 today | **Haniel Muze** (`player-ivp-ntu-12`) |

**Why Add Existing shows "No players found":** `getLeaguePlayerPool()` only includes players **currently on a team roster in memory**. Orphans in `players` with no `team_players` row are invisible — not a search bug, a data-model gap.

**Why he vanished:** `savePlayersWithSchema` deletes all `team_players` for league teams and re-inserts only the in-memory roster. Stats-only imports don't refresh rosters; later saves persisted NTU without Yuanyang (Haniel took #12 for IVP).

Name note: data spells **Yuanyang** (one `u`); user said Yuanyuang.

### Duplicate jersey numbers — current state (not fully loosened)

| Layer | Enforces unique # per team? |
|-------|----------------------------|
| **Postgres** `team_players_team_number_uidx` on `(team_id, number)` | **YES** — blocks Yuanyang #12 while Haniel has #12 |
| **UI** `isNumberTaken()` in AddPlayerDialog, PlayerForm, PlayerPage | **YES** — blocks save in app |
| **`hasDuplicateJerseyNumbers()`** | **NO** — always returns `false` (comment says allowed; GameSetup dupe message is effectively dead) |

User assumption partially correct at app-logic level, but **DB + form validation still enforce uniqueness**. Must fix both for Haniel + Yuanyang both wearing #12.

### Restoration scope

Once back on NTU roster, these **auto-fix** (stats already keyed by `player-sunig-ntu-12`):

- NTU roster table
- Tournament Players tab (via roster)
- Player profile page / game log / stats
- Box scores (iterates `team.players` with minutes &gt; 0)

No game JSON or `game_stats` edits required.

### Target end state

- Yuanyang on **NTU roster**, jersey **#12**, position **C** (global on profile)
- Haniel Muze **keeps #12** on same team (duplicate allowed)
- Add Existing search finds **orphaned league players** (not only rostered ones)
- Future saves less likely to silently orphan stat-backed players

---

### High-level task breakdown

#### C13.1 — Allow duplicate jersey numbers (DB + UI)

| Step | Work |
|------|------|
| **C13.1a** | Migration `004_allow_duplicate_jersey_numbers.sql` — `DROP INDEX IF EXISTS team_players_team_number_uidx` |
| **C13.1b** | Remove blocking `isNumberTaken` checks (AddPlayerDialog, PlayerForm, PlayerPage edit) — optional soft warning only |
| **C13.1c** | Update GameSetup copy (remove contradictory dupe error if any paths remain) |
| **C13.1d** | `npm run db:migrate:004` script (mirror 002/003) |

**Success:** Two NTU players can both be #12; save succeeds in Supabase.

#### C13.2 — Restore Yuanyang to NTU

| Step | Work |
|------|------|
| **C13.2a** | Script `scripts/restore-player-roster.ts` (or one-off SQL) — upsert `team_players(team-sunig-ntu, player-sunig-ntu-12, number=12)` after 004 |
| **C13.2b** | Run against user's Supabase; hard-refresh app |

**Success:** Yuanyang visible on NTU roster; Sunig box scores show his lines; player page loads.

#### C13.3 — Orphan player pool (fix Add Existing)

| Step | Work |
|------|------|
| **C13.3a** | `loadAppDataFromSupabase` — compute `orphanPlayers`: league `players` rows with no `team_players` link |
| **C13.3b** | Extend `getLeaguePlayerPool(teams, orphanPlayers?)` or merge in App / AddPlayerDialog |
| **C13.3c** | Picker shows orphans with label e.g. "Not on a team" |

**Success:** Searching "yuan" finds Yuanyang even if orphan again.

#### C13.4 — Roster save safeguard (recommended)

| Step | Work |
|------|------|
| **C13.4a** | Before `team_players` delete in `savePlayersWithSchema`, merge in players referenced by `game_stats` in completed games for each team (read profiles from DB or in-memory games) |
| **C13.4b** | Or: warn in console when save would drop a player_id still in game stats |

**Success:** Re-saving roster after stats-only import doesn't orphan Yuanyang-class players again.

---

### Executor order

1. **C13.1** (migration 004 + UI) — user runs SQL in Supabase  
2. **C13.2** (restore Yuanyang) — verify in app  
3. **C13.3** (orphan pool) — Add Existing works for edge cases  
4. **C13.4** (safeguard) — prevent recurrence  

One executor step at a time per workflow; C13.1+2 may ship together since restore blocked without 004.

### Open decision

**Yuanyang jersey #:** Restore at **#12** (historical Sunig number) with duplicate allowed — **default**. Alternative: assign #12 to Haniel only and put Yuanyang on another # — reject unless user prefers.

**Designer confidence: ~96%** — ready for Executor on user OK.

**Awaiting user “Executor mode” for C13.1.**

---

### ~~C11 v1 draft (superseded)~~

~~Roster chips with abbrev + # + position~~ — replaced by BBR jersey grid + global position above.

### One decision for you

~~Single-team layout: chip vs bio line~~ — **Resolved:** always use jersey grid (1 cell if single team); bio = position + measurements only.

---

## Project Status Board

- [x] **C15 Roster contamination (C13.4 enrich bug)** — complete; QA passed; Carl on Kai Xuan (`team-1780252086140` #88) restored
- [ ] **C16 Jersey number sizing (+20% width, +60% height, top-anchored)** — C16.1–C16.2 complete; build passes; **awaiting C16.3 user QA**
- [x] **KX Div2 '24 full tournament import** — 13 games imported; awaiting user QA (KX.5)
- [ ] **C13 Restore Yuanyang + duplicate jersey #s** — C13.1–C13.4 code complete; **DB may need C15.2 repair after enrich corruption**
- [ ] **C12 Player Stats age-at-tournament column** — C12.1–C12.4 done; awaiting user QA
- [ ] **C11 Player identity (BBR jerseys + global position)** — C11.1–C11.7 + C11.9 done; awaiting C11.8/C11.9 user QA
- [ ] **C10 Global players + multi-team rosters** — C10.1–C10.7 complete; migration 002 applied; C10.8 folded into C11 QA
- **C9 Tournament create-team dialog bug (2026-06-01):** **C9.1–C9.3 complete.** Hoisted dialogs to `TournamentPage` root; replaced inline form with `TeamForm` + `hideTournamentPicker`. Build passes. **Awaiting C9.4 user QA.**
- **C8 Tournament logos (2026-05-31):** **C8.1–C8.7 complete.** TournamentBadge, TournamentIconField, editor, form/manager wiring, display on Dashboard/TournamentPage/badges. Bundled Sunig + IVP PNGs normalized. Build passes. **Awaiting C8.8 user QA.**
- **C6.8 bugfix (2026-05-31):** NTU logo rendered at full 512px — `size-6`/`size-8` etc. not in compiled Tailwind CSS (same class of bug as `object-contain`). Fixed `TeamBadge` to use `w-* h-*` + `overflow-hidden`. `TeamBadge` (fixed square slot + contain + square abbrev fallback) wired everywhere. NTU normalized to 512×512 transparent PNG. `npm run normalize:team-icon`. Build passes. **Awaiting C6.8.5 user QA.**
- **Dashboard D + Sunig B2 + team delete QA (2026-05-30):** User confirmed all optional QA complete.
- **Stats Entry Step 2+:** Paused by user (2026-05-30).
- **B6 Game 5 finale NUS vs NTU (2026-05-31):** JSON at `Importingboxscores/sunig 2025/game-2025-10-03-nus-ntu.json`. NUS home (45), NTU away (80). Start time 20:40. NTU away starters: Minghui #20, Chengshan #8, Daniel #6, Sunzhe #45, Carl #22. Imported with `--stats-only`; 12 NTU stat lines (80 pts); all 15 NTU player profiles unchanged. **Sunig 2025 import complete (5 games). Awaiting B6.4 user QA.**
- **C3 Player page Stats tab Standard/Advanced toggle (2026-05-31):** C3.1–C3.3 complete. Added `buildPlayerTournamentSeasonRows()` + `aggregateSinglePlayerSeasonStats()` in `playerSeasonStats.ts`. Extended `PlayerStatsTable` with `layout="tournament-breakdown"` (Tournament column, All Time summary row styling, no row nav). `PlayerStatsTab` now reuses `PlayerStatsTable` with Standard/Advanced toggle; tournament filter dropdown limited to tournaments player actually played in. Build passes. **Awaiting C3.4 user QA.**
- **C2 Player stats Standard/Advanced toggle (2026-05-31):** Designer plan — toggle in `PlayerStatsTable`, advanced cols FG/3PT/FT totals + ORPG/FDPG/Paint/FBPG/BAPG/TFPG/UFPG. **Awaiting user answers (4 questions).**
- **C1 Player Performance chart (2026-05-31):****** C1.1 complete — `TeamStats.tsx` sorts chart x-axis by `minutes_played` desc (name tiebreaker). Build passes. **Awaiting C1.2 user QA.**
- **B5 Game 4 SUSS vs NTU (2026-05-30):**** JSON at `Importingboxscores/sunig 2025/game-2025-09-29-ntu-suss.json`. NTU home (86), SUSS away (41). Start time 19:15. NTU home starters: Jingjie #1, Chengshan #8, Daniel #6, Sunzhe #45, Carl #22. Imported with `--stats-only` — created `team-sunig-suss` only; 12 NTU stat lines (86 pts); all 15 NTU player profiles unchanged. **Awaiting B5.5 user QA.**
- **B4 Game 3 NUS vs NTU (2026-05-29):**** JSON at `Importingboxscores/sunig 2025/game-2025-09-26-nus-ntu.json`. NUS home (39), NTU away (70). NTU away starters: Jingjie #1, Chengshan #8, Daniel #6, Cliff #13, Carl #22. Imported with `--stats-only` — created `team-sunig-nus` only; 12 NTU stat lines (70 pts); all 15 NTU player profiles unchanged. **Awaiting B4.5 user QA.**
- **B3 Box score order (2026-05-30):** B3.1–B3.4 complete. `boxScoreOrder.ts`, BoxScore starters/bench/divider, JSON starters fixed, both games re-imported (height/weight preserved). **Awaiting B3.5 user QA.**
- **B2 Sunig NTU vs SIT:** Import complete. Import script fixed to preserve player height/weight on re-import.
- **Active / release:** Local changes not yet committed since `487b516` — commit + push when ready (D6).
- **Step 1 complete (2026-05-29):** Game Setup, active session, delete cleanup — QA passed.
- Added `formatPlayerPositionLabel(primaryPosition, secondaryPosition?)` in `src/components/PlayerPage.tsx`.
- Helper behavior:
  - returns `primary` when secondary is empty/undefined
  - returns `primary` when secondary equals primary
  - returns `[primary/secondary]` when secondary is present and different
- Executor completed Step 2.
- Updated both player page display locations to use `displayPosition`:
  - overview info row
  - header subtitle row
- Executor completed Step 3 verification:
  - `npm run build` passes successfully
  - no linter errors in modified files
  - no additional render sites outside player page were changed for this task

---

- **C6.9 NTU crest (2026-05-31):** Executor complete. Border flood-fill normalize script; NTU re-processed from user PNG (~3804 mane pixels preserved); baked `#000` 512². **Awaiting C6.9.5 user QA (hard refresh).**

- **N1 Smart back navigation (2026-05-29):** Please hard-refresh and verify:
  1. Sunig tournament **Teams tab** → NTU → Back → returns to **Teams tab** (not Team Manager)
  2. Team Manager → NTU → Back → Team Manager
  3. Dashboard team tile → NTU → Back → Dashboard
  4. Tournament **Players tab** → player → Back → Players tab
  5. Direct URL to a team page → Back → Team Manager (fallback)
- **Release (2026-05-30):** All feature QA signed off.
- **Stats Entry Step 2+:** Paused — do not start until user unpause.
- **P1 Team Player Stats (2026-05-30):** T1–T4 shipped. **Fixed TeamPage crash** (`Cannot read properties of undefined (reading 'filter')`) — guarded `games`, `gameStats`, and `teamStats` in TeamPage + `playerSeasonStats.ts`. Please hard-refresh and QA NTU Team Stats: Sunig filter, player table matches tournament tab, sort works.
- **Sunig 2025 import:** B4 Game 3 imported stats-only. For future games always use `--stats-only` flag. Re-import idempotent: `npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-26-nus-ntu.json" --stats-only`.
- **Sunig 2025 import:** B1.4 complete. User should hard-refresh and confirm B1.5 checklist. Re-import is idempotent: `npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json"`.
- Milestone reached: Player measurements (cm/kg input + profile display) implemented.
- Rounding: cm -> feet/inches uses **nearest inch** (confirmed).
- Form validation: numeric cm/kg only, **no hard min/max** (confirmed).
- Files added/updated:
  - `src/lib/playerMeasurements.ts` (normalize, format, migrate helpers)
  - `src/components/forms/PlayerForm.tsx` (cm/kg inputs)
  - `src/components/PlayerPage.tsx` (formatted profile display)
  - `src/api/supabaseData.ts` + `src/App.tsx` (load migration + one-time Supabase save)
  - `scripts/migrate-player-measurements.ts` (optional CLI migration)
- `npm run build` passes.
- Manual UI check recommended:
  - create player with height `191` cm, weight `88` kg
  - profile shows `6'3'' (191cm)` and `88kg`
  - existing legacy player migrates after refresh (first load saves normalized values)
- Navigation bug fix completed (2026-05-29 — **superseded by N1**):
  - Team detail Back now routes directly to `paths.teams` (single click).
  - Player detail Back now routes directly to `teamPath(team)` (single click).
  - Removed dependency on browser history depth for these two Back buttons.
  - **Known regression:** Tournament → Team → Back lands on Team Manager instead of tournament tab. N1 plan addresses this with `navigateWithReturnTo` / `navigateBack`.

---

## Executor's Feedback or Assistance Requests (C13 — 2026-05-29)

**C13.1–C13.4 implemented.** `npm run build` passes.

**User action required (no `SUPABASE_DB_URL` in `.env.local`):**
1. Apply migration: `npm run db:migrate:004` (or paste `supabase/migrations/004_allow_duplicate_jersey_numbers.sql` in Supabase SQL Editor)
2. Restore Yuanyang: `npm run restore:yuanyang`
3. Hard-refresh app and QA:
   - Yuanyang Tan on NTU roster at #12 (alongside Haniel Muze #12)
   - Sunig box scores show Yuanyang stats
   - NTU → Add Player → Existing → search "yuan" finds Yuanyang before restore; after restore he won't appear (already on roster)
   - Duplicate jersey numbers save without error

**Changes summary:**
- Migration 004 drops `team_players_team_number_uidx`
- UI no longer blocks duplicate jersey numbers (`AddPlayerDialog`, `PlayerForm`, `PlayerPage`, `PlayerJerseyNumbersEditor`)
- `loadAppDataFromSupabase` returns `orphanPlayers`; wired to Add Existing picker via `getLeaguePlayerPool(teams, orphanPlayers)`
- `saveAppDataToSupabase` merges stat-referenced orphan players onto rosters before `team_players` delete/re-insert

---

## C15 — Roster contamination bug from C13.4 enrich (Designer, 2026-06-01)

### Background and Motivation

User edited Carl Belanger's jersey (#88 test → #22) while testing jersey icon sizing. After save, **many players appear on wrong team rosters** — opponent teams (NUS, SUTD, SUSS, SIT, IVP opponents, etc.) now list NTU players. Player pages show **many duplicate jersey icons** (one per wrongly-linked team).

**Expected state:**
- **`team-sunig-ntu` (NTU):** full roster only
- **All other teams:** **0 players**, except **Kai Xuan** on his one team (user to confirm team id + player id)
- Players should **not** be tied to teams they merely played **against**

User hypothesis (correct): *games somehow registered players on both teams*. Partially true — see root cause below.

### Root cause analysis (confirmed in code)

**C13.4 `enrichTeamsWithStatReferencedPlayers`** in `supabaseData.ts` runs on **every auto-save** before writing `team_players`:

```tsx
for (const stat of game.gameStats ?? []) {
  // BUG: no filter for which SIDE this stat belongs to
  const profile =
    onTeam.players?.find(...) ??
    allRosterPlayers.get(playerId) ??  // ← pulls NTU player from league memory
    orphanById.get(playerId);
  extras.push({ ...profile });  // ← adds to CURRENT team being processed
}
```

For each league team, for each completed game that team played in:
1. It loops **all** `gameStats` (both home AND away players)
2. For opponent stats not already on roster, it falls back to **`allRosterPlayers`** (NTU players live here)
3. It **appends NTU players to the opponent team's roster**

Then **`savePlayersWithSchema` deletes ALL `team_players` for league teams and re-inserts** from the poisoned in-memory rosters → **persists corruption to Supabase**.

**Why stats-only imports made this worse:** Sunig/IVP opponent teams have **`players: []`** in JSON and in game snapshots. Every stat line is NTU-only (`player-sunig-ntu-*` / `player-ivp-ntu-*`). When enrich runs for `team-sunig-nus` in the NUS vs NTU game, **all 12 NTU stat lines get added to NUS roster**.

**Trigger:** Any save after C13 shipped (jersey edit → auto-save → enrich → DB write).

**Secondary UI bug (reverted locally):** `handleUpdatePlayer` called `onUpdateTeam` in a loop; duplicate team rows in memory amplified jersey grid duplicates. Fix bundled into C15.3.

### What is NOT corrupted

- **`players` table** (global profiles) — likely fine
- **`games` table** / `gameStats` — unchanged; stats still correct
- **Box scores** — still keyed by `playerId`; display may look odd if roster filters wrong

### Target end state

| Team | Roster |
|------|--------|
| `team-sunig-ntu` | Canonical NTU roster (Sunig JSON + IVP `player-ivp-ntu-*` if separate, + Yuanyang #12 if desired) |
| Sunig opponents (`team-sunig-nus`, `team-sunig-sutd`, `team-sunig-sit`, `team-sunig-suss`) | **Empty** |
| IVP opponents (`team-ivp-*` except NTU) | **Empty** except Kai Xuan's team → **1 player** |
| Multi-team legitimate links | Only if intentionally designed (e.g. same person on two teams in different tournaments — rare) |

---

### High-level task breakdown

#### C15.1 — Stop the bleeding (code fix, P0)

| Step | Work |
|------|------|
| **C15.1a** | **Remove** `enrichTeamsWithStatReferencedPlayers` from `saveAppDataToSupabase` OR rewrite to only add a player when `stat.playerId` is on **that game's side** (`game.homeTeam.players` / `game.awayTeam` snapshot for the team being saved) — **never** `allRosterPlayers` cross-team fallback |
| **C15.1b** | Preferred v1: **delete enrich entirely**; keep Yuanyang restore as explicit script (`restore:yuanyang`) |
| **C15.1c** | Add unit-style test or inline comment documenting invariant: *save must never assign a player to a team unless they are already on that team in app state* |

**Success:** Editing Carl's jersey and saving does **not** change opponent `team_players` rows.

#### C15.2 — Repair Supabase data (one-off script)

| Step | Work |
|------|------|
| **C15.2a** | `scripts/repair-rosters.ts` (+ `npm run repair:rosters`) |
| **C15.2b** | **Dry-run** mode: print `team_players` counts per team before/after |
| **C15.2c** | Delete all `team_players` where `team_id != 'team-sunig-ntu'` **except** preserve Kai Xuan row (user confirms `player_id` + `team_id`) |
| **C15.2d** | Rebuild **`team-sunig-ntu`** roster from canonical JSON: `Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json` (15 Sunig players) + merge IVP NTU players from `Importingboxscores/ivp 2026/game-2026-01-13-ntu-np.json` (`player-ivp-ntu-*`) + optional Yuanyang `player-sunig-ntu-12` #12 |
| **C15.2e** | User runs script, hard-refreshes, verifies rosters |

**Success:** NUS/SUTD/etc. show 0 players; NTU shows ~15–18; Carl shows **1–2 jerseys max** (Sunig + IVP if both linked); Kai Xuan only on his team.

#### C15.3 — Hardening (prevent recurrence)

| Step | Work |
|------|------|
| **C15.3a** | `dedupeTeamPlayers` / `dedupeTeamsById` on load + every `handleUpdateTeam` |
| **C15.3b** | Batch player profile saves (`handleUpdatePlayerProfile`) — single `setTeams`, no loop |
| **C15.3c** | `handleAddPlayerToRoster`: skip if `isPlayerOnTeam` |
| **C15.3d** | Consider: stop delete-all `team_players` on every save (upsert-only diff) — **defer** unless needed |

#### C15.4 — Verification checklist (user QA)

1. Each opponent team roster page → **0 players** (except Kai Xuan team → 1)
2. NTU roster → expected names only
3. Carl player page → **one jersey per real team** (not 8+)
4. Edit Carl #22 → save → opponent rosters **unchanged** (re-query `team_players`)
5. Sunig box scores still show Carl / Yuanyang stats

---

### Open decisions for user (before Executor)

1. **Kai Xuan** — which `team_id` and `player_id` should be preserved? (Executor can query Supabase in dry-run.)
2. **IVP NTU players** (`player-ivp-ntu-*`) — same people as Sunig roster with different ids; confirm both sets should be on `team-sunig-ntu` or separate team entity?
3. **Yuanyang #12** — keep on NTU after repair?

### Executor order

1. **C15.1** first (stop corrupting on next save)
2. **C15.2** repair script + user runs it
3. **C15.3** hardening
4. **C15.4** user QA

**Designer confidence: ~99%** on root cause. Ready for Executor on user OK.

**Awaiting user “Executor mode” for C15.1.**

---

## Executor's Feedback or Assistance Requests (C15 — 2026-05-29)

**C15.1–C15.3 complete.** `npm run build` passes.

**C15.2 live repair executed:**
- Before: 200 `team_players` rows (demo teams 23 each, opponents 10–16, NTU 18)
- After repair + cleanup: **18 rows**, all on `team-sunig-ntu`
- Repair script initially preserved Carl Belanger on `team-1780252086140` (#88) via single-player rule — **incorrect** (contamination artifact). Deleted manually; script updated to skip canonical NTU player ids when preserving single-player opponent links.

**Kai Xuan:** User-created team `team-1780252086140`. Carl Belanger (`player-sunig-ntu-22`) on Kai Xuan at #88 only; repair script preserves this team and re-upserts Carl after NTU rebuild.

**User QA (C15.4):** Confirmed opponent teams empty, Carl page clean. Carl intentionally on NTU (#22) + Kai Xuan (#88).

---

## C16 — Jersey number sizing (Designer, 2026-06-01)

### Background and Motivation

User wants jersey numbers on the player-page jersey grid to feel **bigger and more “filled in”** inside the tank outline — closer to real jersey typography. Screenshot shows numbers sitting small in the upper chest with empty space below.

**Request (locked):**
- **+20% wider**
- **+60% taller (length)**
- **Top edge locked** — numbers must **not** grow upward toward the neckline
- Growth goes **downward** to fill the lower torso area (bottom of the number box ≈ jersey hem padding)

**Scope:** `JerseyIcon.tsx` only (used by `PlayerJerseyGrid` on player overview). No PNG asset change.

### Current implementation (baseline)

File: `src/components/JerseyIcon.tsx`

| Element | Value (md) |
|---------|------------|
| Icon dim | 48×48 px (`sm` 40, `lg` 60) |
| viewBox | `0 0 100 100` |
| White mask (covers baked `00`) | `x=34 y=37 w=32 h=26` → zone **y 37–63** |
| Text | `x=50 y=50`, `textAnchor=middle`, `dominantBaseline=middle`, `fontSize=17` |
| Font | system-ui, weight 800 |

**Problem:** Center-anchored text scales/grows symmetrically — wrong for “fill downward” requirement. Numbers also under-use the 26-unit vertical zone.

### Key challenges and analysis

1. **Anchor semantics** — “Height limit locked” means the **top of the digit box stays fixed** at the current upper bound (~y=37 in viewBox), not the vertical center at y=50.

2. **Independent axes** — User asked for 20% width and 60% height separately → use **`scale(1.2, 1.6)`**, not a uniform font-size bump.

3. **SVG transform origin** — Wrap the `<text>` in a `<g>` with transform anchored at top-center:
   ```svg
   <g transform="translate(50, 37) scale(1.2, 1.6) translate(-50, -37)">
     <text x="50" y="37" dominantBaseline="hanging" ... />
   </g>
   ```
   Switch from `dominantBaseline="middle"` at y=50 → **`hanging`** at y=37 so expansion is downward-only.

4. **Mask rect** — Wider digits after 1.2× scale may expose baked `00` at the sides. Widen mask ~20%: e.g. `x=31 w=38` (keep top y=37). Height may stay 26 or extend to y=64 if any bleed at bottom.

5. **Clip safety (optional)** — If aggressive scale clips into neckline on certain digits, add `<clipPath id="jersey-number-zone">` matching the mask rect so numbers never draw outside the torso box.

6. **What we are NOT doing** — Replacing the PNG, changing team logos, or touching roster/save logic.

### High-level task breakdown

#### C16.1 — Top-anchored scaled text (Executor)

| Step | Work |
|------|------|
| **C16.1a** | Add constants in `JerseyIcon.tsx`: `NUMBER_TOP_Y = 37`, `SCALE_X = 1.2`, `SCALE_Y = 1.6`, `ANCHOR_X = 50` |
| **C16.1b** | Wrap `<text>` in `<g transform="translate(50,37) scale(1.2,1.6) translate(-50,-37)">` |
| **C16.1c** | Change text to `y={NUMBER_TOP_Y}`, `dominantBaseline="hanging"`, keep `textAnchor="middle"` |
| **C16.1d** | Keep existing `fontSize` per size tier (14 / 17 / 19) — scaling applies on top |

**Success:** Single change in dev; numbers visibly taller and wider; top edge aligns with pre-change upper bound; bottom sits nearer jersey hem.

#### C16.2 — Mask + bleed tuning (Executor)

| Step | Work |
|------|------|
| **C16.2a** | Widen white mask ~20%: `x=31 width=38` (tune ±1 if needed) |
| **C16.2b** | Verify no baked `00` visible for digits **0, 1, 8, 22, 45, 88** at `sm` / `md` / `lg` |
| **C16.2c** | If bottom bleed, extend mask height 1–2 viewBox units (max ~y=65, still inside jersey outline) |

**Success:** No ghost `00` artifacts; no clipping of shoulder/armhole strokes.

#### C16.3 — Visual QA (user)

Hard-refresh player page (Carl or any multi-jersey player):

1. Numbers fill lower torso; neckline/armholes unchanged
2. Single-digit (#8) and double-digit (#22, #88) readable
3. `lg` overview grid and any `sm` usages still balanced
4. Side-by-side jerseys in grid don’t overlap

### Open decision (minor — Executor may tune without asking)

If strict `scale(1.6)` overshoots the bottom hem by 1–2px on wide digits (`88`), prefer **small `SCALE_Y` tweak (e.g. 1.55–1.6)** to land flush with the mask bottom rather than clipping. Width stays **1.2×**.

### Executor order

1. C16.1 → C16.2 → `npm run build`
2. User C16.3 QA

**Designer confidence: ~95%** — single-file SVG transform change; low regression risk.

**Awaiting user “Executor mode” for C16.1.**

---

## Executor's Feedback or Assistance Requests (C16 — 2026-06-01)

**C16.1–C16.2 complete.** `npm run build` passes.

**Changes in `JerseyIcon.tsx`:**
- Top anchor at y=37 with `dominantBaseline="hanging"`
- `scale(1.2, 1.6)` from top-center (50, 37) — grows downward only
- Mask widened to x=31 w=38 h=27

**User QA (C16.3):** Hard-refresh player page and check #22 / #88 jerseys fill lower torso; no baked `00` bleed; neckline unchanged.

---

## KX Div2 '24 — Full tournament import (Designer, 2026-06-01) — LOCKED

### User decisions (confirmed)

| Topic | Decision |
|-------|----------|
| **Team** | Existing `team-1780252086140` (Kai Xuan) |
| **Tournament** | Existing `tournament-1780251377063` — do not rename |
| **Tournament month** | **Apr** 2024 (starting month) |
| **Players** | **Already in DB + app roster** — **stats-only every game**, no player/roster writes |
| **Player IDs** | Reuse existing profiles only (Carl = `player-sunig-ntu-22` #22 on both teams). Haniel = same person as NTU/IVP Haniel. Jeremy = same as NTU Jeremy. **No new `players` rows** |
| **Opponents** | Empty roster teams; opponent stats not tracked |
| **Home team** | Kai Xuan **home** all games; `trackBothTeams: false` |
| **Minutes** | Spreadsheet screenshot only (not in HTML) |
| **PM / events / shots** | Zero/empty OK |
| **Game 9 walkover** | KX 20–0, date **2024-05-07**, no `gameStats`, no starters |
| **Starters** | Top **5 KX players by minutes** that game (from spreadsheet) |
| **Scope** | This tournament only; do not touch Sunig/IVP/NTU |

### Opponent team IDs & abbreviations (create on import if missing)

| Opponent | `team_id` (proposed) | abbrev |
|----------|----------------------|--------|
| Amity | `team-kx-div2-amity` | AMT |
| KTS | `team-kx-div2-kts` | KTS |
| Police | `team-kx-div2-police` | POL |
| GMAC | `team-kx-div2-gmac` | GMAC |
| Chong Ghee | `team-kx-div2-chong-ghee` | CG |
| SAFSA | `team-kx-div2-safsa` | SAFSA |
| Tungsan | `team-kx-div2-tungsan` | TGS |
| Loaded | `team-kx-div2-loaded` | LOAD |
| Tampines East | `team-kx-div2-tampines-east` | TPE |
| Clementi | `team-kx-div2-clementi` | CLEM |
| SinKee (SKC) | `team-kx-div2-skc` | SKC |

### Game schedule (import order)

| G# | `game_id` (proposed) | Date | Opponent | KX score | HTML source |
|----|----------------------|------|----------|----------|-------------|
| 1 | `game-kx-div2-2024-04-03-amity` | 2024-04-03 | Amity | W 68-42 | `KX vs Amity 010424.html` |
| 2 | `game-kx-div2-2024-04-06-kts` | 2024-04-06 | KTS | W 56-47 | `KX vs KTS 050424.html` |
| 3 | `game-kx-div2-2024-04-14-police` | 2024-04-14 | Police | L 59-67 | `KX vs Police 100424.html` |
| 4 | `game-kx-div2-2024-04-15-gmac` | 2024-04-15 | GMAC | W 67-56 | `KX vs GMAC 140424.html` |
| 5 | `game-kx-div2-2024-04-27-chong-ghee` | 2024-04-27 | Chong Ghee | W 55-51 | `KX vs Chong Ghee 210424.html` |
| 6 | `game-kx-div2-2024-05-01-safsa` | 2024-05-01 | SAFSA | L 50-58 | `KX vs SAFSA 280424.html` |
| 7 | `game-kx-div2-2024-05-06-tungsan` | 2024-05-06 | Tungsan | L 54-69 | `KX vs Tungsan 020524.html` |
| 8 | `game-kx-div2-2024-05-04-loaded` | 2024-05-04 | Loaded | L 61-67 | `KX vs Loaded 040524.html` |
| 9 | `game-kx-div2-2024-05-07-tampines-east` | **2024-05-07** | Tampines East | W 20-0 | **Walkover — no HTML** |
| 10 | `game-kx-div2-2024-05-12-clementi` | 2024-05-12 | Clementi | W 52-41 | `KX vs Clementi 110524.html` |
| 11 | `game-kx-div2-2024-05-30-skc` | 2024-05-30 | SKC (SinKee) | W 71-67 | `KX vs SinKee 150524.html` |
| 12 | `game-kx-div2-2024-06-03-tungsan` | 2024-06-03 | Tungsan | L 45-87 | `Tungsan vs KaiXuan box-scores-18 may 2024.html` |
| 13 | `game-kx-div2-2024-05-31-clementi` | 2024-05-31 | Clementi | W 57-56 | `KX vs Clementi 3:4 200524.html` |

### Minutes source (spreadsheet → decimal `minutes_played`)

Executor transcribes `Importingboxscores/KX Div2 '24/kx-div2-minutes.json` from screenshot. Format: `{ "game-kx-div2-...": { "Ram": 29.9, ... } }` using first-name keys matching HTML. Convert `H:MM:SS` → `hours*60 + minutes + seconds/60`. Grey/DNP = omit from that game's stats (unless HTML has box score line — then 0 min only if played with stats).

**Game 9:** no minute entries.

### HTML name → DB `player_id` mapping (Executor step 0)

Query Supabase `team_players` + `players` for `team-1780252086140`. Map HTML first names:

`Ram, Jeremy, Chenbin, Atif, Haniel, Enmao, Vernen, Stuwat, Sean, Wilbur, Zhanxian, Russell, Carl, Liam, Bryan`

Known cross-team links (user): **Carl** → `player-sunig-ntu-22`; **Jeremy** → NTU Jeremy Chew; **Haniel** → IVP/NTU Haniel Muze. Others: match by `players.name` on KX roster.

**Gate:** All 15 names resolve to existing `player_id` before any import. If any fail, stop and ask user.

### JSON bundle shape (every game)

- `tournament`: `{ id: tournament-1780251377063, name: <from DB>, year: 2024, month: "Apr", teamIds: [KX, ...all 11 opponents] }`
- `teams`: KX + opponent rows, **`players: []`** always
- `game`: `homeTeamId` = KX, `trackBothTeams: false`, `gameStats` = KX players only (from HTML + minutes), `homeStarters` = top 5 by minutes
- Import flag: **`--stats-only` for all 13 games**

### High-level task breakdown (Executor)

| Step | Task | Success criteria |
|------|------|------------------|
| **KX.0** | Query DB: tournament name, KX roster name→`player_id` map | 15/15 players mapped; printed table for user |
| **KX.1** | Add `kx-div2-minutes.json` (spreadsheet) | 12 games with minutes; game 9 absent |
| **KX.2** | `scripts/parse-easystats-html.ts` + generate 12 JSON bundles | Dry-run stats counts match HTML pts totals |
| **KX.3** | Hand-build game 9 walkover JSON | Score 20-0, empty stats |
| **KX.4** | `npm run import:boxscore -- --stats-only` × 13 (chronological) | No player upserts; games visible under tournament |
| **KX.5** | Verify: KX team page, player pages, box scores, minutes column | User QA checklist |

### Verification checklist (user QA)

1. Tournament shows **13 games** with correct W/L scores
2. Game 9 = 20-0, no box score lines
3. Each played game: KX player stats + **minutes** match spreadsheet
4. Carl / Jeremy / Haniel stats on **one player profile** each (multi-team jerseys OK)
5. Opponent teams have **0 roster players**
6. NTU / Sunig data unchanged

**Designer confidence: ~98%** — ready for **Executor mode** on user OK.

**Status:** Import complete (KX.0–KX.4). **KX.M** minutes discrepancy investigation below (Designer, 2026-06-01).

---

### KX.M — Minutes discrepancy investigation (Designer, 2026-06-01)

**User report:** Box score minutes in app don’t match spreadsheet (`Screenshot 2026-06-01 at 6.14.22 PM.png`).

#### Findings (verified)

| Check | Result |
|-------|--------|
| `kx-div2-minutes.json` vs screenshot (12 games) | **0 mismatches** — transcription is correct |
| Generated `json/*.json` bundles vs `kx-div2-minutes.json` | **0 mismatches** — builder applies sheet values |
| Easy Stats HTML box scores vs minutes | Minutes are **not** in HTML; only counting stats. No conflict expected. |
| Root cause of “slight” differences | **Import rounds to 1 decimal** + **UI `formatTime` reconstructs MM:SS from rounded decimal** |

**Mechanism (example — Game 1 Haniel):**

- Spreadsheet: `0:20:55` → exact decimal **20.9167** min  
- Import stores: `Math.round(20.9167 * 10) / 10` → **20.9**  
- `BoxScore.formatTime(20.9)`: floor 20 min + `round(0.9 × 60)` sec → **20:54** (not 20:55)

Automated check: **~90 / ~120** player-game rows show ±1s display gap vs spreadsheet when comparing MM:SS; only **9** have >0.05 min numeric gap from 1-decimal rounding (max 0.05 min).

**Not a data/transcription bug.** Supabase should match import JSON (same rounding).

**Spreadsheet footnote:** Summary row shows **16:00:00** total team minutes; 12 × 3:20:00 = **40:00:00**. That’s a spreadsheet formula error — ignore for import QA.

#### Recommended fix (Executor — two small changes)

| Step | Task | Success criteria |
|------|------|------------------|
| **KX.M1** | `build-kx-div2-imports.ts`: store **full precision** minutes from H:MM:SS (remove `*10/10` round) | JSON `minutes_played` equals `h+m/60+s/3600` to ≥4 decimals |
| **KX.M2** | `BoxScore.formatTime`: derive display from **total seconds** — `Math.round(minutes * 60)` then format `M:SS` | All 12 games: every played cell matches spreadsheet MM:SS (automated script) |
| **KX.M3** | `npm run build:kx-div2` + re-import all 13 with `--stats-only` | Supabase `game_stats.minutes_played` updated |
| **KX.M4** | User spot-check: Game 1 Amity, Game 13 Clementi (Ram 40:00) | Minutes column matches screenshot |

**Scope note:** KX.M2 affects **all** box scores app-wide (display only). Prefer this over KX-only hack — fixes any future imports with fractional minutes.

**Out of scope:** Changing counting stats from HTML; adding `seconds_played` DB column (unnecessary if float + display fix suffice).

**Designer confidence: 95%** — user discrepancies explained; ready for **Executor mode** on KX.M1.

---

## Executor's Feedback or Assistance Requests (KX Div2 — 2026-06-01)

**KX.0–KX.4 complete.**

- Mapped 15/15 KX roster players to existing `player_id` (Vernon in DB = “Vernen” in HTML).
- Added `kx-div2-minutes.json`, `scripts/build-kx-div2-imports.ts`, 13 JSON bundles under `Importingboxscores/KX Div2 '24/json/`.
- Imported all games with `--stats-only` (no new players).
- Supabase verify: **13 games** on `tournament-1780251377063`; walkover **20–0** with **0** stat lines; KX roster still **15** players.

**Re-import:** `npm run build:kx-div2` then import each JSON with `--stats-only`.

**User QA (KX.5):** Hard-refresh → tournament → 13 games; spot-check box scores, minutes (Ram ~29.9 min game 1), Carl profile has Div2 stats on games 4+.

**KX.M (Executor, 2026-06-01):** KX.M1–M3 done.

- Removed 1-decimal round in `build-kx-div2-imports.ts`; `formatTime` uses `Math.round(minutes * 60)` in `BoxScore.tsx`.
- Rebuilt 13 JSON bundles; automated check: **0** storage/display mismatches vs spreadsheet.
- Re-imported all 13 games `--stats-only` (all succeeded).
- **KX.M4:** Awaiting user spot-check (Game 1 Amity Haniel **20:55**, Game 13 Ram **40:00**).

---

## U21 Gemilang Cup — Kai Xuan import (Designer, 2026-06-02)

### Background

- **Tournament already in DB:** `tournament-1780333884144` — **Gemilang Cup U21**, year **2023**, month **Jun**.
- **Team:** Kai Xuan `team-1780252086140` (already on tournament; **no opponent teams** linked yet).
- **Sources:** 5 Easy Stats HTML files in `Importingboxscores/U21 Gemilang Cup/` + screenshot **average MPG** (decimal).
- **Minutes strategy (user):** Per game, each player who **played** gets `minutes_played = tournament_avg_mpg` from screenshot → season MPG matches screenshot.
- **Home/away:** KX **home** all games **except vs Gemilang** (KX **away**).
- **Roster:** Players already created on KX team (~28 `team_players` rows; some duplicate jersey #s from Div2 + U21).

### Games (from HTML titles + dates)

| G# | Date | Opponent | Score (KX–Opp) | HTML file | KX side |
|----|------|----------|----------------|-----------|---------|
| 1 | 2023-06-04 | Skudai | **86–41** W | `Kaixuan U21 vs Skudai 030623.html` | Home |
| 2 | 2023-06-12 | 新士乃 (XinShiNai) | **69–71** L | `Kaixuan U21 vs 新士乃 110623.html` | Home |
| 3 | 2023-06-13 | Gemilang | **92–75** W | `Kaixuan U21 vs Gemilang 110623.html` | **Away** |
| 4 | 2023-06-19 | Sunway | **99–30** W | `Kaixuan U21 vs Sunway 180623.html` | Home |
| 5 | 2023-06-26 | DianFeng | **61–62** L | `Kaixuan U21 vs DianFeng 240623.html` | Home |

**0 games imported** on this tournament so far.

### User overrides

| Game | Rule |
|------|------|
| **vs DianFeng** | **Exclude Bryan** — HTML has 0-stat line; user confirms DNP |
| **Starters (KX)** | See table below |

| Game | Starters (5) |
|------|----------------|
| DianFeng | Jeremy, Andre, Carl, Haniel, Liam |
| Sunway | Jeremy, Carl, Bryan, Joseph, Scott |
| @ Gemilang | Andre, Bryan, Jeremy, Carl, Russell |
| 新士乃 | Jeremy, Carl, Andre, Bryan, Russell |
| Skudai | Andre, Haniel, Bryan, Carl, Jeremy |

### Tournament average minutes (screenshot → `kx-u21-gemilang-mpg.json`)

Map by **jersey # from HTML** (not DB jersey if they differ):

| # | Name | GP | Avg MP |
|---|------|-----|--------|
| 2 | Joseph | 1 | 22.0 |
| 4 | Haniel | 2 | 26.5 |
| 88 | Andre | 4 | 26.8 |
| 22 | Carl | 5 | 26.2 |
| 10 | Jeremy | 5 | 31.7 |
| 87 | Bryan | 4 | 20.5 |
| 45 | Jeffers | 2 | 8.3 |
| 7 | Jacque | 1 | 10.0 |
| 0 | Leyang | 4 | 13.4 |
| 1 | Liam | 3 | 22.3 |
| 77 | William | 1 | 17.0 |
| 6 | Jaiganesh | 5 | 15.8 |
| 12 | Russell | 2 | 16.5 |
| 11 | Scott | 3 | 15.3 |
| 21 | Siuchun | 1 | 13.0 |
| 27 | Clarence | 3 | 10.7 |
| 14 | Terrell | 5 | 11.5 |
| 13 | Collin | 3 | 6.7 |
| 9 | Mingyao | 1 | 2.0 |

**Per-game minutes:** `minutes_played = avg_mp` for each included stat line.

### HTML → `player_id` (Executor KX.U21.0 gate)

Resolve each row by `(jersey #, first name)` against `team_players` + `players.name` on `team-1780252086140`. Known links: Carl **#22**, Jeremy **#10**, Haniel **#4**.

**HTML quirks:**

- Bryan listed as **#87** in HTML; DB roster may show Bryan as **#1** — match by **name**, not DB number.
- Skudai / 新士乃: Liam appears as **#16** in HTML — likely same player as **#1 Liam**; confirm with user.
- Names: `Ming Yao` / `Mingyao`, `Siu Chun` / `Siuchun`, `Jaiganesh` — normalize when matching.

### “Actually played” rule (user-confirmed, 2026-06-02)

**Screenshot GP is authoritative.** Many HTML rows are roster/scoresheet placeholders (name listed, no real participation).

**Include stat line only if** (after parsing):

1. Not an explicit per-game omit (Bryan @ DianFeng).
2. **Not** Liam jersey **#16** (wrong number; user: didn’t play those games).
3. **Meaningful box score activity:** at least one of — points, FG/3P/FTA attempted, ORB+DRB, AST, STL, BLK — is &gt; 0.  
   - Excludes all-dash rows and **all-zero** lines (e.g. Bryan @ DianFeng, Ming Yao 0-0 @ DianFeng).

**Validation:** This rule reproduces screenshot GP for **17/19** players. Remaining gaps below.

### GP validation (strict rule vs screenshot)

| Player | Screenshot GP | Games included (strict rule) | Status |
|--------|---------------|------------------------------|--------|
| Jeremy, Carl, Bryan*, Haniel, Andre, Russell, Jacque, Jeffers, Joseph, Leyang, Jaiganesh, Scott, Siuchun, Clarence, Collin, Terrell, William | per screenshot | match | OK |
| **Liam** | **3** | **2** — DianFeng, Gemilang only (Sunway #1 all-dash; #16 rows skipped) | **ASK** |
| **Mingyao** | **1** | **0** — only rows: Sunway all-dash, DianFeng 0-0 | **ASK** |

\*Bryan: omit DianFeng only.

**Inferred Liam candidates for game 3:** 新士乃 has `#16 Liam` with 2 pts — if that row **is** Liam (jersey typo) and only Skudai #16 should be ignored, GP becomes **3**. User said “ignore Liam #16” — clarify scope.

### Opponent teams (auto abbreviations)

| Opponent | Proposed `team_id` | Abbr |
|----------|-------------------|------|
| Skudai | `team-kx-u21-skudai` | SKD |
| 新士乃 | `team-kx-u21-xinshinai` | XSN |
| Gemilang | `team-kx-u21-gemilang` | GEM |
| Sunway | `team-kx-u21-sunway` | SUN |
| DianFeng | `team-kx-u21-dianfeng` | DF |

Empty rosters; linked to `tournament-1780333884144`.

### Player matching (user-confirmed)

- Match HTML → DB by **first name** (normalize `Ming Yao`→Mingyao, `Siu Chun`→Siuchun).
- **Bryan** → DB jersey **#1** (HTML may show #87).

### Proposed import shape (mirror KX Div2)

- `scripts/build-kx-u21-gemilang-imports.ts` — parse HTML, apply omit lists + starters, attach constant MPG, write `json/*.json`.
- `Importingboxscores/U21 Gemilang Cup/kx-u21-gemilang-mpg.json` — jersey → avg minutes.
- `Importingboxscores/U21 Gemilang Cup/kx-u21-game-config.json` — per-game `omitPlayers`, `starters`, `homeAway`.
- 5× opponent placeholder teams (`players: []`), abbreviations e.g. SKD, XSN, GEM, SUN, DF.
- `trackBothTeams: false`, `--stats-only` (no new players).
- `teamStats`: score-only shells (same as Div2); team page season card still needs aggregation fix (KX.M2 pattern) if not done globally.

### High-level task breakdown (Executor)

| Step | Task | Success criteria |
|------|------|------------------|
| **U21.0** | Query DB: KX roster name/# → `player_id`; print mapping table | All HTML names resolve; flag duplicates |
| **U21.1** | Add `kx-u21-gemilang-mpg.json` + `kx-u21-game-config.json` | Matches screenshot + user starters/omit |
| **U21.2** | Build script + 5 JSON bundles | KX pts per game match HTML team totals |
| **U21.3** | Link opponent teams to tournament; import 5 games `--stats-only` | 5 games visible; 0 new players |
| **U21.4** | Verify MPG on player profiles + box scores | Spot-check Carl/Jeremy/Bryan |
| **U21.5** | User QA | Tournament standings, game log, minutes |

### User clarifications (2026-06-02, final)

1. **Liam — option A:** Ignore `#16 Liam` **only on Skudai**. Count 新士乃 `#16 Liam` (2 pts) as Liam (jersey typo). → **3 GP** (DianFeng, Gemilang, 新士乃).
2. **Mingyao:** Played **DianFeng** — box score is not empty (0 pts but **2 DRB, 1 STL, 1 TO**). Include that game; **1 GP**, **2.0 MPG**.

### “Actually played” rule (final)

Include row if **any** counting stat &gt; 0: PTS, FGA (fg/3p/ft attempted), ORB, DRB, AST, STL, BLK, **TO**.

Plus:

- Explicit omit: **Bryan @ DianFeng**
- Skip: **Liam #16 on Skudai only**
- Name match to DB (Bryan by name → jersey #1 in DB)

**Validation:** All **19/19** screenshot GP counts match under this rule. KX team points per game match HTML finals (61, 92, 86, 99, 69).

### Minutes

`kx-u21-gemilang-mpg.json` — map normalized first name → `{ gp, mpg }` from screenshot.  
Each imported game for that player: `minutes_played = mpg` (decimal).

### Home / away + score (Gemilang game)

| Game | `homeTeamId` | `awayTeamId` | `finalScore` |
|------|--------------|--------------|--------------|
| KX home (4 games) | KX | opponent | `{ home: kxPts, away: oppPts }` |
| @ Gemilang | Gemilang (`team-kx-u21-gemilang`) | KX | `{ home: 75, away: 92 }` |

KX starters go in `homeStarters` when KX home, else `awayStarters` when KX away (`trackBothTeams: false`).

### Starters (user-provided — not top-5-by-minutes)

| Game | KX starters (`player_id` via name) |
|------|-----------------------------------|
| Skudai | Andre, Haniel, Bryan, Carl, Jeremy |
| 新士乃 | Jeremy, Carl, Andre, Bryan, Russell |
| @ Gemilang | Andre, Bryan, Jeremy, Carl, Russell |
| Sunway | Jeremy, Carl, Bryan, Joseph, Scott |
| DianFeng | Jeremy, Andre, Carl, Haniel, Liam |

Stored in `kx-u21-game-config.json` per `game_id`.

### Liam games (reference)

| Game | Liam row | Import? |
|------|----------|---------|
| Skudai | #16 (ignore) | No |
| 新士乃 | #16, 2 pts | **Yes** |
| Gemilang | #1, 12 pts | Yes |
| Sunway | #1, all `-` | No |
| DianFeng | #1, 5 pts | Yes |

### Files / script (Executor)

- `Importingboxscores/U21 Gemilang Cup/kx-u21-gemilang-mpg.json`
- `Importingboxscores/U21 Gemilang Cup/kx-u21-game-config.json`
- `scripts/build-kx-u21-gemilang-imports.ts` (fork Div2 parser + played filter + away-game score flip)
- `Importingboxscores/U21 Gemilang Cup/json/*.json` (5 games)
- `package.json`: `npm run build:kx-u21-gemilang`
- Import: `npm run import:boxscore -- --file … --stats-only` × 5

### Executor gate U21.0

Print name → `player_id` for all **19** MPG players; halt if any unresolved (watch duplicate jersey #s on KX roster — **name wins**).

### Out of scope (this task)

- Opponent player stats / rosters
- Per-game real minutes (only tournament avg proxy)
- Team-page season “Team Statistics” card (still reads empty `teamStats` unless separate TeamPage aggregation fix)

### Final check — one optional confirm

**Starters:** The five names you listed each game are **Kai Xuan starters only** (not opponent). Assumed **yes** — reply only if wrong.

**Designer confidence: ~98%** — ready for **Executor mode** on your go.

**Status:** Plan complete; say **Executor mode** to start U21.0.

### Executor progress (2026-06-02)

**U21.0–U21.3 complete.**

- Mapped 19/19 MPG players to `player_id` (name match on KX roster).
- Added `kx-u21-gemilang-mpg.json`, `kx-u21-game-config.json`, `scripts/build-kx-u21-gemilang-imports.ts`, `npm run build:kx-u21-gemilang`.
- Built 5 JSON bundles; point totals match HTML (86, 69, 92, 99, 61); all 19 GP counts match screenshot.
- Imported all 5 games `--stats-only`; created 5 opponent teams (SKD, XSN, GEM, SUN, DF).
- Gemilang game: KX away (`home_team_id` = Gemilang); Bryan omitted @ DianFeng.

**U21.4 / U21.5:** User QA — hard-refresh → Gemilang Cup U21 → 5 games; spot-check Carl/Jeremy/Liam MPG; DianFeng no Bryan line.

**Re-import:** `npm run build:kx-u21-gemilang` then import each JSON in `Importingboxscores/U21 Gemilang Cup/json/` with `--stats-only`.

---

## Team page — Team Statistics aggregation (Designer, 2026-06-02)

### User concern (valid)

Summing **each player’s per-game average** (e.g. add all players’ RPG) is **wrong** when not everyone plays every game. You double-count “slots” as if 15 players each averaged 3 rebounds meant the team gets 45 RPG.

**Toy example:**

| Game | Player A steals | Player B steals |
|------|----------------|-----------------|
| 1 | 5 | (DNP) |
| 2 | (DNP) | 5 |

| Method | Result |
|--------|--------|
| **Correct team SPG** | (5 + 5) / 2 games = **5.0** |
| **Wrong: Σ player SPG** | A avg 5 + B avg 5 = **10.0** (inflated) |

Same logic applies to ORB, DRB, fouls, etc.

### Correct definition (target)

For scoped team games:

1. **Per game *g*:** `teamStat(g)` = sum of box-score rows for **that game only** (roster `playerId`s who have a line in *g*).
2. **Team season average** = `Σ teamStat(g) / G` where **G** = team games in scope that have a usable box score (not Σ player averages).

Shooting %: recompute from **totaled** FGM/FGA across games (not average of player FG%).

### Current code audit (post-fix)

`TeamPage.calculateTeamStatsFromGames` (2026-06-02) **intends** the correct formula:

- Loop each completed scoped game → `sumPlayerStatsForRoster(game, rosterIds)` → divide by `completedGames.length`.

**Not** summing `aggregatePlayerSeasonStats` rows.

If UI still *looks* inflated, causes to check in Executor:

| Risk | Mitigation |
|------|------------|
| Denominator includes games with **no** box score (walkover) | Use only games where `rosterHasPlayerBoxScore` for **G** |
| User mentally sums **Player Stats table** RPG column | Add UI note: team card ≠ sum of player averages |
| Stale build before per-game fix | Hard refresh |

### High-level task breakdown (Executor)

| Step | Task | Success criteria |
|------|------|------------------|
| **TS.1** | Extract `aggregateTeamSeasonAverages(team, games)` → `gameDisplay.ts` | Unit test: alternating-DNP example → team SPG = 5, sum of player SPG = 10 |
| **TS.2** | Denominator = games with roster box score only | Walkover excluded from **G** |
| **TS.3** | Wire `TeamPage` + subtitle: “Per team game (N games)” | Label matches formula |
| **TS.4** | Manual QA: Kai Xuan all tournaments — team RPG ≈ reasonable vs eyeballing box scores | User confirms |

**Designer confidence: 95%** on problem definition; **90%** current code is already per-game-sum (verify with TS.1 test).

**Status (Executor 2026-06-02):** TS.1–TS.3 done.

- `aggregateTeamSeasonAverages` + `teamGameCountsForSeasonAverages` in `src/utils/gameDisplay.ts`
- `TeamPage` uses `totals` for FG%/3P%/FT%, `perGame` for counting stats; CardDescription with game count
- Denominator excludes completed games with no box score / no persisted counting stats (walkovers)
- `npm run test:team-season-aggregate` — alternating-DNP steals: team 5.0 ≠ player-sum 10.0

**Project Status Board:** [x] TS.1 [x] TS.2 [x] TS.3 — [ ] TS.4 user QA on Kai Xuan team page

### Designer audit — NTU (`team-sunig-ntu`) not “applying” (2026-06-02)

**Finding: The webapp does use the new logic for NTU on Team → Stats tab.** There is only one code path: `TeamPage` → `aggregateTeamSeasonAverages(filteredStatsGames, team)` (same for every team id, including NTU).

**Sanity check on import JSON (10 NTU games, SUNIG + IVP):**

| Metric | Correct (team per-game) | Wrong (Σ player per-game avgs) |
|--------|-------------------------|--------------------------------|
| Steals | **11.8** | 16.4 |
| Rebounds | **46.6** | 65.3 |

User-reported ~**11.4 steals** / **~42 RPG** aligns with the **correct** column, not the inflated sum-of-player-rows. So the card may already be fixed while still *feeling* high vs NBA or vs mentally adding the Player Stats table.

**How to confirm in browser (NTU team page → Stats):**

1. Subtitle under “Team Statistics”: *“Per team game from box scores (N games). Not the sum of player averages below.”*
2. If that text is **missing** → stale bundle: hard refresh or `npm run dev` / rebuild.
3. Optional check: add RPG column in Player Stats mentally — sum of rows ≈ **65**, not **42**; team card should be closer to **42–47**.

**Not yet wired (other surfaces):**

| Surface | Current logic | Needs TS.5? |
|---------|---------------|-------------|
| Team → **Stats** → Team Statistics card | `aggregateTeamSeasonAverages` | Done |
| Team → **Overview** (leaders) | Per-player GP averages | OK for leaders |
| **Tournament** standings extended stats (RPG, APG, %) | `game.teamStats.home/away` persisted only | Yes if user expects same formula there |

**Hypotheses if user still disagrees after seeing subtitle:**

| # | Hypothesis | Check |
|---|------------|-------|
| H1 | Comparing team card to **sum of Player Stats table** | Sum steals ≈ 16+, not 11 |
| H2 | Viewing **Tournament** page, not Team Stats | Different code path |
| H3 | Stale frontend | Subtitle absent |
| H4 | Supabase roster/game mismatch | `gamesInSample` &lt; expected game count |
| H5 | Expecting lower “real” basketball norms | One NTU game had 17 team steals, 40 reb (verified in import) |

**Recommended Executor (only if user confirms subtitle missing or wants parity):**

| Step | Task |
|------|------|
| TS.5 | Reuse `aggregateTeamSeasonAverages` in `TournamentPage` extended standings |
| TS.6 | Optional: show “Σ player avgs would be X” debug/tooltip on Team Stats card |

**Designer:** Do **not** re-implement NTU-only logic; issue is likely **expectation / wrong surface / stale build**, not a missing NTU branch.

---

## Team Statistics card — basketball UX redesign (Designer, 2026-06-02)

### Problem (user feedback)

Current **Team → Stats → Team Statistics** card is weak from a hoops perspective:

| Issue | Detail |
|-------|--------|
| **Missing core box-score stats** | **APG**, **TOPG**, **PPG** exist in `TeamSeasonStatBucket` but are **not rendered** |
| **Mis-grouped stats** | “Defense” shows steals/blocks/fouls — fouls are not defensive metrics; assists/turnovers are playmaking, not shown |
| **Misleading “Advanced” column** | Paint / fastbreak / 2nd chance always **0.0** for Easy Stats imports → looks broken |
| **No efficiency metrics** | Per-game box score (`TeamStats.tsx`) shows eFG%, TS%, AST/TO; season card does not |
| **Inconsistent with player table** | Player Stats below has PPG, RPG, APG, SPG, BPG, TOPG — team card doesn’t mirror |

Data layer is fine (`aggregateTeamSeasonAverages` already sums assists, turnovers per team game). This is a **presentation + derived-metrics** gap.

### Design principles

1. **Team season = sum each game’s team line ÷ games** (keep current aggregation; no sum-of-player-avgs).
2. **Mirror what coaches expect**: box score categories + a few efficiency rates.
3. **Don’t show fake zeros**: optional team-level fields only when recorded (same rule as `TeamStats.tsx` / `OptionalStatBadge`).
4. **Stay scoped**: respect tournament filter; optional hook to Overview PPG/PAPG for consistency.

### Proposed layout (recommended)

Replace 4-column grid with **5 logical groups** (responsive: 2 cols mobile → 3–5 desktop).

#### Row A — Headline (4 compact KPIs, optional)

| KPI | Source | Notes |
|-----|--------|-------|
| **PPG** | Sum `resolveTeamScore(game, teamId)` per scoped game ÷ G | Matches Overview |
| **Opp PPG** | Opponent scores from `finalScore` ÷ G | Same as Overview `papg` |
| **AST/TO** | `totals.assists / totals.turnovers` | Show “—” if TO = 0 |
| **eFG%** | `(FGM + 0.5×3PM) / FGA` from `totals` | Standard |

#### Row B — Detail columns

| Column | Stats | Type |
|--------|-------|------|
| **Scoring** | FG%, 3P%, FT%, **2P%** (derived), FGM/G, FGA/G (optional) | % from totals; volume per-game from `perGame` |
| **Playmaking** | **APG**, **TOPG**, **AST/TO** | Per-game from `perGame` |
| **Rebounding** | ORB/G, DRB/G, **RPG** (total) | Already have; keep |
| **Defense** | SPG, BPG, **SPG+BPG** optional | Remove **fouls** from this column |
| **Discipline** | **FPG** (fouls per game) | Own small group — not “defense” |
| **Advanced** *(conditional)* | Paint, FB, 2nd chance, Pts off TO | Only if `getTeamAdvancedStatCoverage(games)` &gt; 0; else **hide column** or single line “Not tracked in this scope” |

**Remove** fouls from “Defense”. **Add** assists + turnovers prominently.

### Derived metrics (add helper in `gameDisplay.ts`)

```ts
export function computeTeamSeasonDerived(totals: TeamSeasonStatBucket, perGame: TeamSeasonStatBucket) {
  return {
    ppg: /* from points totals — see TS.7 */,
    efgPct, tsPct, twoPtPct, astTo,
    rpg: perGame.orb + perGame.drb,
    apg: perGame.assists,
    topg: perGame.turnovers,
    spg: perGame.steals,
    bpg: perGame.blocks,
    fpg: perGame.fouls,
  };
}
```

**TS.7:** Extend `TeamSeasonStatBucket` with `points` (sum player points per game in contribution fn) OR compute PPG in `TeamPage` from `filteredStatsGames` + `resolveTeamScore` (no schema change).

**TS%:** `totals` need total points — use sum of `resolveTeamScore` across sample games for numerator.

### Advanced stats coverage

New helper (parallel to `getShotDataCoverage`):

- `getTeamAdvancedStatCoverage(games, teamId)` → count games where persisted `points_in_paint` / `fastbreak_points` / `second_chance_points` / `points_off_turnovers` is non-null and &gt; 0.
- If **0 games**, omit Advanced section entirely (fixes NTU/KX import UX).

### Optional stretch (later)

| Item | Value | Effort |
|------|-------|--------|
| Mini comparison vs league avg | High | Needs league aggregates |
| Link “View game breakdown” | Medium | Reuse `TeamStats` per game |
| TS.5 Tournament standings same aggregation | Medium | Already noted |

### High-level task breakdown (Executor)

| Step | Task | Success criteria |
|------|------|------------------|
| **TS.7** | Add `points` to season bucket OR scoped PPG helper | PPG matches Overview for same scope |
| **TS.8** | `computeTeamSeasonDerived` + `getTeamAdvancedStatCoverage` in `gameDisplay.ts` | Unit test for eFG%, AST/TO |
| **TS.9** | Refactor `TeamPage` Stats card to new column layout | APG, TOPG visible; fouls under Discipline |
| **TS.10** | Hide Advanced when coverage = 0 | NTU/KX imports: no 0.0 paint column |
| **TS.11** | Optional headline KPI row (PPG, Opp PPG, AST/TO, eFG%) | Matches screenshot tournaments |

**Out of scope:** Changing aggregation math (already correct).

**Designer confidence:** 95% on layout; 90% PPG should come from `resolveTeamScore` per game for walkover/score-only edge cases.

**Status (Executor 2026-06-02):** TS.7–TS.11 done.

- `TeamSeasonStatBucket.points`; `computeScopedTeamScoring`, `getTeamAdvancedStatCoverage`, `computeTeamSeasonDerived` in `gameDisplay.ts`
- Team Stats card: KPI row (PPG, Opp PPG, AST/TO, eFG%); columns Scoring / Playmaking / Rebounding / Defense / Discipline; Advanced only when persisted data exists
- Tests extended in `npm run test:team-season-aggregate`

**Project Status Board:** [x] TS.7–TS.11

### TS% NaN + Advanced column restore (2026-06-02)

**Root cause TS% NaN:**
1. `totals.points` could become **NaN** when any `gameStats` row had missing numeric fields (`undefined + number` in `sumPlayerStatsForRoster`).
2. `formatPct` used `value != null` — **NaN passes** that check → renders `NaN%`.
3. TS% used box-score point sum while PPG used **final scores** (83.4 PPG) — mismatch when points sum was 0/NaN but FGA existed.

**Fix:** Safe numeric adds in roster sum; TS% uses `ppg × gamesWithScore` when available; `Number.isFinite` in `formatPct`; Advanced column always visible (TS%, Paint, Fastbreak, 2nd Chance, Pts off TO).

---

## Tournament-Scoped Rosters (Designer, 2026-06-03)

### Background and Motivation

**User problem:** Carl Belanger played for SAFSA Arion in **NBL Div 2 2023** and Kai Xuan in **NBL Div 2 2024**. Both clubs also participated in both years’ tournaments. The app blocks adding Carl to SAFSA because he is on Kai Xuan and both teams share **NBL Div 2 2024** — even though the intent is **cross-year**, not **same-season dual roster**.

**Root cause (data model):** Rosters live on `Team.players` / `team_players` (club-level, league-wide). Tournament enrollment (`tournament_teams`) only links **teams** to tournaments, not **which players** represent that team in that season. The overlap rule (`wouldRosterViolateTournamentOverlap`) is a band-aid: it prevents impossible *same-tournament* states but cannot express legitimate *different-tournament* club moves.

**Goal:** First-class **tournament-season roster membership** so a player can be on Team A in Tournament X and Team B in Tournament Y (including consecutive years), while still blocking “two teams in the same tournament.”

**Example that must work after this project:**

| Player | Tournament | Team | Jersey |
|--------|------------|------|--------|
| Carl Belanger | NBL Div 2 2023 | SAFSA Arion | (2023 #) |
| Carl Belanger | NBL Div 2 2024 | Kai Xuan | (2024 #) |

**Must still block:**

| Player | Tournament | Teams | Why |
|--------|------------|-------|-----|
| Anyone | NBL Div 2 2024 | Kai Xuan **and** SAFSA | Same season, two clubs |

---

### Key Challenges and Analysis

#### 1. Source of truth hierarchy

| Layer | Today | Proposed |
|-------|-------|----------|
| Player identity | `players` (global profile) | unchanged |
| Club template roster | `team_players` | **optional template** — not used for game/stats authority |
| Tournament roster | *missing* | **`tournament_rosters`** — authoritative for games + display in that tournament |
| Who played | `games.game_stats` by `playerId` | unchanged; roster validates / drives UI |
| Team in tournament | `tournament_teams` | unchanged |

**Principle:** For any game with `tournament_id`, roster eligibility and jersey/position display come from `tournament_rosters`, not `team.players`.

#### 2. Assumptions to challenge

| Assumption | Verdict |
|------------|---------|
| “Removing overlap check is enough” | **False** — without tournament rosters, club-level membership still lies about 2024 SAFSA. |
| “Stats will figure it out from games alone” | **Partially true** for player totals, **false** for team roster UI, game setup, and overlap prevention. |
| “One `team_players` row per player per team is enough” | **False** for multi-year club moves with one global player id. |
| “Tournament = season” | **Confirmed** — one tournament row per season (e.g. NBL Div 2 2023 vs 2024). No multi-year single tournament entity. |

#### 2b. Players not on a tournament roster (Q2 clarification)

When a team is enrolled in a tournament, **club template** (`team_players`) and **tournament roster** (`tournament_rosters`) are separate lists.

| Player state | Club template | Tournament roster | Game setup (that tournament) | Tournament-scoped team page | Player profile |
|--------------|---------------|-------------------|------------------------------|----------------------------|----------------|
| On template, **not** copied to tournament | Yes | No | **Not offered** | **Not listed** for that season | Global profile exists; no affiliation row for that tournament |
| Copied then **removed** from tournament roster | Yes | No | Not offered | Not listed | Same as above |
| Added manually later via “Manage roster” | Optional | Yes | Offered | Listed | Affiliation row appears |
| Appears in **imported box score** only (Q5) | Optional | **Auto-created** by import/backfill | Offered after import | Listed after import | Affiliation + stats from games |

**Copy prompt behavior (locked decision):**

When enrolling a team (or via “Copy club roster to tournament”):

> “Copy **N** players from club roster into **{Tournament name}**?”  
> **Copy all** · **Start empty** · **Cancel**

- **Copy all** — every `team_players` row → `tournament_rosters` for `(tournament, team)`. Admin **prunes** players not in that season (expected workflow).
- **Start empty** — no tournament roster rows. Only players you add manually or who appear in imports get tournament membership.
- **Cancel** — no roster change (enrollment may still proceed).

**Players left off the tournament roster are not deleted.** They remain on the club template and in the global player pool. They simply **do not exist for that season** until added or imported.

**Non-tournament games (Q1):** Those players **are** available via club template when `tournament_id` is null.

#### 2c. No mid-season transfers (Q3 — locked, stricter than draft default)

**Human decision:** Mid-season transfers **do not exist** in any tournament. Not modeled, not supported.

**Rules:**

1. **DB:** `unique (tournament_id, player_id)` — at most one team per player per tournament, forever.
2. **No team change within a tournament:** Once a player has a `tournament_rosters` row for `(T, team A)`, they **cannot** get a row for `(T, team B)` — even after delete. App blocks add to B if player ever had stats or roster entry for another team in T.
3. **Remove from roster:** Allowed only as **pre-season correction** — player has **zero completed games** in that tournament. If `game_stats` exist for that player in T, removal is **blocked** (or soft-block with admin override out of scope for v1).
4. **Cross-tournament moves (Carl case):** Allowed — different `tournament_id` (2023 vs 2024).

**UI copy:** “Players cannot change teams during a tournament. Remove only before they appear in any game.”

**Out of scope:** Transfer workflow, waiver wire, two-stint same-tournament history.

#### 3. Downstream systems affected

| Area | Change needed |
|------|----------------|
| `AddPlayerDialog` / overlap validation | Validate against **target tournament**, not shared club tournaments |
| `GameSetup` | Load `players` from tournament roster for selected `tournamentId` |
| `TeamPage` roster + stats | Scope roster/stats by tournament (reuse existing stats tournament filter) |
| `TournamentPage` | Per-team roster management (primary UX for season rosters) |
| `PlayerPage` | Affiliations table: Team × Tournament × Jersey |
| `aggregatePlayerSeasonStats` / `buildPlayerTournamentSeasonRows` | Resolve team via **game.tournamentId + tournament roster**, not `getTeamsForPlayer` |
| `resolvePlayerTeamInGame` | Prefer roster entry for `game.tournamentId` |
| `supabaseData` load/save | New table read/write |
| Import scripts | Map historical box scores → tournament roster entries |
| `TournamentManager` team checkboxes | Enroll **teams** only; rosters managed separately |

#### 4. Recommended architecture (Option A — preferred)

**New table: `tournament_rosters`**

```sql
create table public.tournament_rosters (
  tournament_id text not null references public.tournaments (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  number integer not null check (number >= 0 and number <= 99),
  position text not null default '',
  secondary_position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, team_id, player_id),
  -- Player may only represent ONE team per tournament (core basketball rule)
  unique (tournament_id, player_id)
);

-- team must be enrolled in tournament
-- enforce via app layer + optional FK trigger on tournament_teams
create index tournament_rosters_team_idx on public.tournament_rosters (tournament_id, team_id);
create index tournament_rosters_player_idx on public.tournament_rosters (player_id);
```

**Keep `team_players` as “club template” (optional UX):**

- Used to **seed** tournament rosters (“Copy club roster into this tournament”).
- Not authoritative for overlap checks across teams.
- Can diverge from any tournament (2024 Kai Xuan template ≠ 2023 SAFSA tournament roster).

**Why not add `tournament_id` to `team_players`?**

- Nullable tournament column mixes two concepts in one table, complicates unique constraints and queries.
- Separate table keeps migration/backfill isolated and makes “one player, one team per tournament” a DB constraint.

**In-memory shape (app layer):**

```ts
interface TournamentRosterEntry {
  tournamentId: string;
  teamId: string;
  playerId: string;
  number: number;
  position: string;
  secondaryPosition?: string;
}

// Loaded alongside teams/tournaments; helper merges profile + roster fields into Player view
function getPlayersForTeamInTournament(
  teamId: string,
  tournamentId: string,
  teams: Team[],
  profiles: Map<string, PlayerProfile>,
  rosters: TournamentRosterEntry[]
): Player[]
```

`Team.players` may remain during transition as **derived default** (union of all template rosters or latest tournament — TBD in R.2) but new code paths must accept explicit `tournamentId`.

#### 5. Overlap rule (replacement)

**Remove:** `wouldRosterViolateTournamentOverlap` (club shared-tournament check).

**Add:** `wouldTournamentRosterViolate(playerId, tournamentId, teamId, rosters)`:

- Violates if ∃ entry where `entry.tournamentId === tournamentId && entry.playerId === playerId && entry.teamId !== teamId`.
- Message: “Carl Belanger is already on Kai Xuan for NBL Div 2 2024.”

**Allow:** Same player on SAFSA (2023 tournament id) and Kai Xuan (2024 tournament id) — different `tournament_id` values.

#### 6. Migration / backfill strategy

**Phase R0 — schema + game-derived backfill (no UX break yet):**

##### Backfill rule (Locked — Human 2026-06-03)

> **Tournament roster membership = played in at least one completed game for that `(team, tournament)` pair.**  
> **Club template (`team_players`) does NOT imply tournament roster.**

| Source | Creates `tournament_rosters` row? |
|--------|----------------------------------|
| Player in `game_stats` for team X in tournament T (completed game) | **Yes** |
| Player on club template for team X, enrolled in T, **zero games** in T | **No** |
| “Copy all” prompt (R1.5, forward-only) | Yes — explicit admin action |
| Box-score import (R3.1) | Yes — when stats written |

**Acceptance example — Ram Sunda Putra (`player-1780304603336`):**

| Context | On club template (Kai Xuan)? | Has games? | On tournament roster? |
|---------|------------------------------|------------|------------------------|
| **NBL Div 2 2024** | Yes | Yes (Div2 import games) | **Yes** |
| **Gemilang Cup U21** | Yes | **No** | **No** |

Ram stays on Kai Xuan club template but must **not** appear on Gemilang U21 tournament roster or U21 game setup after backfill.

**Second acceptance example — Carl Belanger:**

| Tournament | Team | Games? | Tournament roster after backfill |
|------------|------|--------|----------------------------------|
| NBL Div 2 2023 | SAFSA | Yes (if imported) | Yes |
| NBL Div 2 2024 | Kai Xuan | Yes (if imported) | Yes |
| Same tournament, two teams | — | — | **Blocked** by `unique (tournament_id, player_id)` |

##### Backfill algorithm (`npm run backfill:tournament-rosters`)

```
INPUT:  all completed games, all teams (for jersey lookup), optional --dry-run

FOR EACH game G WHERE G.isCompleted AND G.tournamentId IS NOT NULL:
  FOR EACH distinct playerId P IN G.gameStats:
    teamId := resolvePlayerTeamSideInGame(P, G)  // home or away; see below
    IF teamId IS NULL: LOG warn; CONTINUE
    UPSERT tournament_rosters (G.tournamentId, teamId, P)
      number, position, secondary_position FROM team_players(teamId, P)
      OR defaults (0, '', null)

DO NOT:
  - Copy team_players → tournament_rosters for enrolled (T, team) pairs
  - Create rows for players with only club-template membership

POST-RUN REPORT:
  - rows inserted / updated / skipped
  - conflicts: same P on both home AND away in same T (data error — log for human)
  - sample assertions: Ram ∈ NBL2024 KX, Ram ∉ Gemilang U21 KX
```

**`resolvePlayerTeamSideInGame` (backfill disambiguation):**

1. If `P` appears only on `G.homeTeamId` side in `team_players` → `homeTeamId`.
2. Else if only on away side in `team_players` → `awayTeamId`.
3. Else if `P` in `G.homeStarters` or home roster snapshot → `homeTeamId`.
4. Else if `P` in away starters → `awayTeamId`.
5. Else default `homeTeamId` if stat row exists (log ambiguous).

**Scope:** Run against **Supabase** (production data) after R0.1–R0.2; also runnable against local backup JSON for dry-run.

**Idempotent:** Re-run safe; rows not in game-derived set are **not** auto-deleted in R0 (see prune policy below).

##### Prune policy (R0 vs R1)

| Phase | Orphan tournament roster rows (no games)? |
|-------|------------------------------------------|
| **R0 backfill** | **Do not delete** existing manual rows; **do not create** club-only rows |
| **R0.6 optional `--prune`** | Delete `tournament_rosters` rows where player has 0 completed games in `(T, team)` — use after human confirms |
| **Steady state (R1+)** | Manual remove allowed only if 0 GP in T (already locked) |

Human request implies initial population is **insert-only from games**. Recommend **`--prune` off by default** on first run; human verifies Ram case, then optional prune pass if any erroneous rows exist.

##### R0 deliverables (unchanged + expanded)

1. Add `tournament_rosters` table + RLS dev policy (**R0.1**).
2. Load/save in `supabaseData.ts` (**R0.2**).
3. App state + snapshot version bump (**R0.3**).
4. Helpers + unit tests (**R0.4**).
5. Backfill script + dry-run + report (**R0.5**).
6. **Verification script** `npm run verify:tournament-rosters` (**R0.6**): asserts Ram rule + counts per `(tournament, team)` vs distinct players in game stats.

**Phase R1 — read path switch:**

- Game setup, tournament team lists, player affiliation display read tournament rosters when `tournamentId` known.
- Team page “All tournaments” roster falls back to union or template with clear label.

**Phase R2 — write path switch:**

- Add/remove player from **tournament roster** (primary UX).
- Club template updates optional / secondary.

**Phase R3 — deprecate club overlap checks; keep `team_players` as template only.**

#### 7. UX design (high level)

| Screen | Behavior |
|--------|----------|
| **Tournament detail → Teams tab** | Each enrolled team shows roster count; “Manage roster” opens scoped editor |
| **Tournament roster editor** | Add existing player / create new; jersey + position per tournament; remove from this tournament only |
| **Team detail → Roster tab** | Tournament scope dropdown (default: latest participated or “Club template”) |
| **Add Player dialog** | Requires `tournamentId` context when opened from tournament; overlap check uses that tournament only |
| **Game setup** | Selecting existing team snapshots **tournament roster** for chosen tournament |
| **Player profile** | “Career” section: rows per (Tournament, Team, #, GP from games) |

**Carl workflow after R2:**

1. Open **NBL Div 2 2023** → SAFSA Arion → Manage roster → Add Carl (no conflict).
2. Open **NBL Div 2 2024** → Kai Xuan → Carl already on roster (or add there).
3. No block because checks are per `tournament_id`.

#### 8. Stats integrity

| Scenario | Expected behavior |
|----------|-------------------|
| Player page, per-tournament row | Team badge = roster team for that tournament (from `tournament_rosters`) |
| Team page stats, scoped to 2023 | Only players on **2023 tournament roster** appear in roster table |
| **Backfill / historical** | Roster row **only** if ≥1 completed game for `(team, tournament)` — Ram rule |
| **Manual add pre-season** (R1+) | On roster with 0 GP until first game — forward workflow only |
| Game already imported with `playerId` | Backfill creates roster row from game stats |
| Player on **club template**, no games in T | **Not** on tournament roster (Ram / Gemilang U21) |
| Player has games but not on roster (pre-R0) | Backfill adds row; stats unchanged |

**Recommendation:** Games are canonical for stats; roster is canonical for **eligibility, display, and prevention of invalid same-tournament dual membership**.

#### 9. Alternatives considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. `tournament_rosters` table** | Clear model, DB constraint, clean overlap | New table + backfill | **Recommended** |
| B. `tournament_id` on `team_players` | Fewer tables | Messy null semantics, harder migration | Reject |
| C. Remove overlap only | Zero schema work | Misleading rosters, game-setup bugs | Reject |
| D. Duplicate player profiles per stint | No schema change | Breaks all-time identity | Reject |
| E. Historical “inactive” flag on club roster | Small change | Still club-scoped, doesn’t scale | Reject as primary |

---

### Human Decisions (Locked — 2026-06-03)

| # | Question | Decision |
|---|----------|----------|
| 1 | Non-tournament games use club template? | **Yes** (default) |
| 2 | Copy club roster when enrolling team? | **Prompt:** Copy all / Start empty / Cancel — see §2b for players left off |
| 3 | Mid-season transfers? | **Not allowed.** One team per player per tournament for life; no team changes after roster/stats exist |
| 4 | Keep club template long-term? | **Yes** (default) |
| 5 | Import auto-creates tournament roster rows? | **Yes**, idempotent upsert (default) |
| 6 | One tournament row per season? | **Yes** — confirmed |
| 7 | **Initial backfill for all existing data?** | **Yes — game-stats only.** Player on tournament roster iff ≥1 completed game for that `(team, tournament)`. Club template alone never backfills. Ram rule. |

**Designer review:** Complete (incl. backfill spec 2026-06-03). Executor may begin **R0.1** immediately; **R1+** unblocked.

---

### Open Questions for Human ~~(need answers before Executor R2+)~~

~~Resolved — see Human Decisions above.~~

<details>
<summary>Original questions (archived)</summary>

1. **Non-tournament games** — **Yes** (club template).
2. **Copy on enroll** — **Prompt** (Copy all / Start empty / Cancel).
3. **Mid-season transfers** — **Not allowed** (stricter than draft).
4. **Club template** — **Keep**.
5. **Import auto-roster** — **Yes**.

</details>

---

### High-Level Task Breakdown (Executor)

Each step = one PR-sized unit. **Human decisions locked — R0 may start.**

| Step | Task | Success criteria |
|------|------|------------------|
| **R0.1** | Migration `005_tournament_rosters.sql` + types | Table exists in Supabase; dev RLS policy |
| **R0.2** | Load/save `tournament_rosters` in `supabaseData.ts` | Round-trip without losing rows |
| **R0.3** | App state: `tournamentRosters[]` + snapshot cache version bump | Refresh preserves roster data |
| **R0.4** | `getPlayersForTeamInTournament` + unit tests | Returns correct jersey per tournament |
| **R0.5** | Backfill script: **game-stats-only** for all existing teams/tournaments | Every `(T, team)` row has a matching completed game stat; no club-template-only rows |
| **R0.6** | `verify:tournament-rosters` + backfill report | Ram ∈ NBL Div2 2024 KX ✓; Ram ∉ Gemilang U21 KX ✓; counts logged |
| **R1.1** | Tournament-scoped overlap + **no-transfer** guard | Same-`tournament_id` block; cannot add to team B if ever on team A in T |
| **R1.2** | `GameSetup` uses tournament roster | Selecting SAFSA in 2023 game shows 2023 roster only |
| **R1.3** | `TournamentPage` — manage roster per team | Add/remove (remove only if 0 GP in T) |
| **R1.4** | `AddPlayerDialog` accepts optional `tournamentId` | Error names tournament + conflicting team |
| **R1.5** | Enroll-team **copy prompt** (Copy all / Start empty / Cancel) | Left-off players stay on template only |
| **R2.1** | `TeamPage` roster scoped by tournament dropdown | 2024 view doesn’t show 2023-only players |
| **R2.2** | `PlayerPage` career affiliations (tournament × team) | Carl shows two rows |
| **R2.3** | Update `resolvePlayerTeamInGame` + season stats helpers | No “Multiple teams” within single tournament scope |
| **R2.4** | “Copy club roster to tournament” action (same prompt as R1.5) | Bulk seed + prune workflow documented |
| **R3.1** | Import scripts create tournament roster rows | HTML/JSON import path covered |
| **R3.2** | Remove legacy club overlap checks; document template vs tournament roster | `wouldRosterViolateTournamentOverlap` deleted or deprecated |
| **R3.3** | Manual QA checklist + scratchpad sign-off | Designer confirms Carl scenario + head-to-head game |

**Out of scope (v1):** Mid-season transfers; changing a player’s team within a tournament after games exist; league-wide free agency pool; auth/RLS per league member.

---

### Success Criteria (Designer sign-off)

- [ ] Carl on SAFSA **NBL Div 2 2023** and Kai Xuan **NBL Div 2 2024** without bypassing rules.
- [ ] Cannot add Carl to SAFSA **and** Kai Xuan both in **NBL Div 2 2024**.
- [ ] Game setup for 2024 Kai Xuan game does not offer Carl on SAFSA side for that tournament.
- [ ] Team/player stats match existing imported box scores after backfill.
- [ ] **Ram Sunda Putra:** on KX roster for NBL Div 2 2024, **not** on KX roster for Gemilang Cup U21 (despite club template).
- [ ] Refresh + Supabase save preserves tournament rosters.
- [x] Human answers to Open Questions documented below.
- [ ] No mid-season transfer path exists in UI or API.

---

### Project Status Board — Tournament Rosters

- [x] **Human:** Answer Open Questions 1–5 (+ tournament-per-season)
- [x] **Human:** Backfill = game-stats-only for all existing data (Ram rule)
- [x] **Designer:** Review plan after human answers; Q2/Q3 + backfill spec expanded
- [x] **Executor:** R0.1–R0.6 (schema + game-derived backfill + verify) — code complete; **human must run migration 005 + backfill**
- [ ] **Human:** Apply `005_tournament_rosters.sql` (Dashboard or `npm run db:migrate:005` with DB URL)
- [ ] **Human:** `npm run backfill:tournament-rosters` then `npm run verify:tournament-rosters`
- [ ] **Human:** Verify backfill on real data (Carl, SAFSA, Kai Xuan, **Ram / Gemilang U21**)
- [x] **Executor:** R1.6 (Team Roster tournament filter) — **default: Club roster (all)**; build passes; **awaiting human QA**
- [ ] **Human:** Manual QA R1.6 — Kai Xuan → Club all = 28; NBL 2024 = 15 (Ram); Gemilang U21 = no Ram
- [ ] **Executor:** R1.1–R1.5 (overlap + game setup + tournament manage + copy prompt)
- [ ] **Human:** Manual test Carl workflow
- [ ] **Executor:** R2.1–R2.4 (team/player pages + copy roster)
- [ ] **Executor:** R3.1–R3.3 (import + cleanup)
- [ ] **Designer:** Final cross-check and mark project complete

### Executor's Feedback or Assistance Requests

- **R0 code complete (2026-06-03).** Dry-run backfill: 64 roster rows from 28 games; Ram on NBL 2024 yes, Gemilang U21 no (expected).
- **Human action required:** No `SUPABASE_DB_URL` in `.env.local` — apply migration 005 in Supabase SQL Editor, then run `npm run backfill:tournament-rosters` and `npm run verify:tournament-rosters`.
- **Note:** Snapshot cache version bumped to **2** (invalidates v1 local cache on refresh).
- **R1.6 complete (2026-06-03):** Team → Roster has `TournamentScopeSelect` with default **Club roster (all)**; tournament scope filters rows via `getPlayersForTeamInTournament` and scopes PPG/RPG/etc. via `filterTeamScopeGames`. Add Player still adds to club template (R1.5 unchanged).
- **R1.1–R1.5 not started** — overlap rules, game setup, tournament manage UI still use club `team.players`.

### Lessons
- **R0 backfill (locked):** Insert `tournament_rosters` **only** from completed `game_stats` grouped by `(tournament_id, team_id, player_id)`. Never seed from `team_players` for historical data.
- **R0.6:** Hard-code or lookup Ram’s player id in verify script as regression guard.
- **R1.5:** Copy prompt remains for **new** enrollments only — distinct from one-time backfill.

### Lessons

- Club-level rosters cannot express season/club transfers; tournament-scoped membership is required for multi-year leagues with stable team entities.
- Overlap validation must use the same granularity as the business rule: **per tournament**, not per shared enrollment graph on teams.
- Players not on a tournament roster are **intentionally invisible** for that season — not deleted, still on club template and available for non-tournament games and future adds/imports.
- **No transfers:** Track `player ever rostered or played in (tournament)` to block team B assignment, not just current roster row.
- **Played ≠ listed:** Club template is superset; tournament roster is subset defined by actual game participation (backfill) or explicit admin add (forward).

---

## Team Roster — Tournament Filter (Designer, 2026-06-03)

### Background and Motivation

User on **Team → Roster** (e.g. Kai Xuan) sees **28 players** — the full **club template** (`team.players`). After R0 backfill, **tournament rosters** exist in DB (e.g. **15** for NBL Div 2 2024, Ram included; Gemilang U21 excludes Ram) but the UI has no way to view them.

**Team Stats** already has a **Tournament** dropdown (`TournamentScopeSelect` + `getTeamTournamentScopeOptions`). **Roster** should get the same pattern, scoped to **`tournament_rosters`**, not club template.

### Goal

On Team → Roster, user can switch between:

| Scope | Kai Xuan example | Data source |
|-------|------------------|-------------|
| **Club roster (all)** | 28 players | `team.players` |
| **NBL Div 2 2024** | 15 players | `tournamentRosters` for `(teamId, tournamentId)` |
| **Gemilang Cup U21** | ~19 (no Ram) | same |

PPG / RPG / APG / shooting columns should use **games in the selected tournament** when a tournament is selected (consistent with Stats tab).

### UX design (recommended)

```
┌─────────────────────────────────────────────────────────────┐
│ Team Roster                                                 │
│ Tournament  [ NBL Div 2 2024 ▼ ]          15 Players  + Add│
├─────────────────────────────────────────────────────────────┤
│  #  Player  Primary  …  PPG  RPG  APG  FG%  …               │
│  … (only tournament roster rows)                            │
└─────────────────────────────────────────────────────────────┘
```

**Dropdown options** (reuse `getTeamTournamentScopeOptions`):

1. **Club roster (all)** — value `all` — shows full `team.players`; badge = club count.
2. **One row per tournament** the team participated in (from games + enrollment), sorted newest first — value = `tournamentId`.

**Default when opening Roster tab:** **Most recent tournament** the team has games in (not `all`). Rationale: user is verifying season squads; Kai Xuan should open on NBL 2024 (15), not 28. If no tournaments, default `all`.

**Independent from Stats tab scope** — separate state `rosterTournamentScope` vs `statsTournamentScope` so switching tabs does not surprise.

**Helper text** (muted, one line under dropdown when not `all`):

> Showing players who played for this team in {Tournament name}. Club roster has {N} players.

**Empty state** (tournament selected, 0 roster rows):

> No players in this tournament roster yet. Import a box score or add players from the tournament page.

(No “Add Player” path to tournament roster in this task — still R1.3.)

**Add Player button (this task):** Unchanged — always adds to **club template**. Optional tooltip: “Adds to club roster; use tournament page to manage season roster” (stretch).

**Overview header** (“28 Players”): Keep **club count** on Overview; Roster tab badge reflects **filtered count**.

### Data / implementation notes

| Piece | Change |
|-------|--------|
| `AppRoutes` → `TeamPage` | Pass `tournamentRosters` prop from `App` |
| `TeamPage` | New state `rosterTournamentScope`; reset to latest tournament on `team.id` change |
| Player list | `all` → `team.players`; else `getPlayersForTeamInTournament(team.id, scope, teams, tournamentRosters)` |
| Stats columns | `all` → `teamGames`; else `filterTeamScopeGames(teamGames, team.id, scope)` for `aggregateRosterPlayerSeasonStats` |
| Component reuse | `TournamentScopeSelect` with extended options (prepend “Club roster (all)”) OR shared helper `getTeamRosterScopeOptions` |

**Option list builder** (new helper in `tournamentRosters.ts` or extend existing):

```ts
getTeamRosterScopeOptions(teamId, teamGames, tournaments): TournamentScopeOption[]
// [{ value: 'all', label: 'Club roster (all)' }, ...tournament rows from getTeamTournamentScopeOptions minus duplicate 'all']
```

**Default scope helper:**

```ts
getDefaultRosterTournamentScope(options): TournamentScope
// first option where value !== 'all', else 'all'
```

### Acceptance criteria (Kai Xuan manual QA)

- [ ] Roster dropdown visible on Team → Roster
- [ ] **Club roster (all)** → 28 players
- [ ] **NBL Div 2 2024** → 15 players; Ram listed
- [ ] **Gemilang Cup U21** → Ram **not** listed
- [ ] PPG/RPG for Ram (NBL scope) match his NBL games only
- [ ] Stats tab tournament filter unchanged / independent

### Task breakdown (Executor)

| Step | Task | Success criteria |
|------|------|------------------|
| **R1.6a** | Wire `tournamentRosters` to `TeamPage` | Prop flows App → AppRoutes → TeamPage |
| **R1.6b** | Roster scope dropdown + default to latest tournament | UI matches mockup |
| **R1.6c** | Filter rows + scoped stat columns | Counts match verify script per tournament |
| **R1.6d** | Empty state + helper copy | 0-row tournament shows message |

**Scope:** Read-only filter only. Overlap fix, game setup, tournament manage UI remain R1.1–R1.5.

**Designer recommendation:** Pull **R1.6** ahead of full R1 overlap work — low risk, immediate value, uses R0 data already backfilled.

### Open question for human (optional)

Default to **latest tournament** vs **Club roster (all)** on first visit? **Human chose Club roster (all)** as default (2026-06-03).

---

## Entity Edit Buttons — Team / Tournament / Game (Designer, 2026-06-03)

### Background and Motivation

**Player page** already has a top-right **Edit Player** button (outline, pencil icon) opening a dialog with `PlayerForm` + jersey editor. User wants the **same placement and pattern** on:

| Page | Route | Component today |
|------|-------|-----------------|
| **Team** | `/teams/:slugId` | `TeamPage` — no edit button |
| **Tournament** | `/tournaments/:slugId` | `TournamentPage` — no edit button |
| **Game** | `/games/:gameId` (completed) | `GameSummary` — no edit button |
| **Game (live)** | `/live/:gameId` | `LiveGameEntry` — no metadata edit |

Edit flows **already exist** on list/manager pages (`TeamManager`, `TournamentManager`) but are **not reachable from detail pages** — user must go back to managers to edit. Goal: edit in context without leaving the page you're viewing.

### Reference pattern (PlayerPage — copy exactly)

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back   [avatar] Carl Belanger              [Edit Player]  │
├──────────────────────────────────────────────────────────────┤
│ Overview | Game Log | Player Stats | Advanced Stats          │
└──────────────────────────────────────────────────────────────┘
```

- Header: `flex items-center justify-between`
- Button: `variant="outline" size="sm"` + `Edit` icon + label
- Dialog: `max-w-2xl max-h-[80vh] overflow-y-auto`, `DialogTitle` + `DialogDescription`, existing form component, Cancel + Submit

### What already exists (reuse, don't rebuild)

| Entity | Form | Edit logic today | Detail page has handler? |
|--------|------|------------------|------------------------|
| **Team** | `TeamForm` (`isEditing`) | `TeamManager` edit dialog | ✅ `onUpdateTeam` on `TeamPage` |
| **Tournament** | `TournamentForm` (`isEditing`) | `TournamentManager` edit dialog | ❌ `onUpdateTournament` **not** passed to `TournamentPage` |
| **Game** | ❌ none | none | ❌ no `handleUpdateGame` for completed games |

**TeamForm edit fields:** name, abbreviation, icon. Tournament picker hidden when `isEditing` (by design — enrollment managed on tournament page).

**TournamentForm edit fields:** name, icon, description, year, month, enrolled teams (checkbox list).

**Team.description** exists on model + shown on Team overview, but **not in TeamForm** — gap to close in E1.2.

### Key Challenges and Analysis

1. **Game has two surfaces** — completed (`GameSummary`) vs in-progress (`LiveGameEntry`). Same `GameForm` can serve both with `mode: 'completed' | 'live'` and field locks.
2. **No `handleUpdateGame` for completed games** — `handleGameUpdate` only persists when `game.isActive`. Need new `handleUpdateGame` that updates `games[]`, syncs `tournament.games[]` when `tournamentId` changes, and saves to Supabase.
3. **Dangerous edits** — changing home/away teams or deleting stats after a game is played breaks box scores, tournament rosters, standings. **Metadata-only** for v1; teams read-only once game has stats.
4. **Tournament team checkbox changes** — adding/removing teams on tournament edit can hit overlap rules (`wouldTournamentEnrollmentViolateOverlap`). Reuse validation from `handleAddTeamToTournament` or warn on save.
5. **Tournament roster R1** — editing tournament teams from tournament form is separate from tournament-scoped rosters; no roster copy prompt needed here (existing enrollment only).

### UX design — fields per entity

#### Edit Team (TeamPage header)

| Field | Editable? | Notes |
|-------|-----------|-------|
| Name | ✅ | |
| Abbreviation | ✅ | uniqueness validated |
| Icon | ✅ | `TeamIconField` |
| Description | ✅ **add to form** | optional textarea; shown on overview |
| Tournament membership | ❌ | use Tournament page / Add team flows |
| Roster / players | ❌ | Add Player on Roster tab |

Dialog title: **Edit Team Details**

#### Edit Tournament (TournamentPage header)

| Field | Editable? | Notes |
|-------|-----------|-------|
| Name | ✅ | |
| Icon | ✅ | `TournamentIconField` |
| Description | ✅ | optional |
| Year / Month | ✅ | |
| Enrolled teams | ✅ | checkbox list; validate overlap on add |
| Standings / games | ❌ | derived |

Dialog title: **Edit Tournament Details**

Replace top-right **Teams • Games badge** with **Edit Tournament** button (badge can move to Home tab or stay as subtitle — recommend keeping count on Home tab only to mirror Player page simplicity).

#### Edit Game — completed (`GameSummary` header)

| Field | Editable? | Notes |
|-------|-----------|-------|
| Date | ✅ | |
| Start time | ✅ | optional `HH:MM`; field exists on model, not in GameSetup yet |
| Tournament | ✅ | dropdown; on change, move game id between `tournament.games[]` |
| Home / Away teams | ❌ read-only | display names only — changing breaks stats linkage |
| Final score | ✅ optional | manual override for import corrections; show warning if differs from computed stat totals |
| Stats / box score | ❌ | separate future "Edit box score" scope |

Dialog title: **Edit Game Details**

Header layout: match Player — Back + matchup summary left, **Edit Game** top right (above or beside "Recent Game" badge).

#### Edit Game — live (`LiveGameEntry`)

Same **Edit Game** button in a compact header row (live UI is dense — place next to existing controls or top bar).

| Field | Editable? | Notes |
|-------|-----------|-------|
| Date | ✅ | |
| Start time | ✅ | |
| Tournament | ✅ | if no stats entered yet; warn if events exist |
| Teams | ❌ | locked after start |
| Track both teams | ❌ read-only | |

### Proposed new component

**`GameForm`** (`src/components/forms/GameForm.tsx`) — extract metadata slice from `GameSetup`:

- Props: `initialData`, `tournaments`, `teams` (for read-only team labels), `isCompleted`, `onSubmit`, `onCancel`
- Fields: date, start time (optional), tournament select, final score (home/away numbers, only when `isCompleted`)
- Read-only row: `Home vs Away` team names with badges

Later: GameSetup can import shared date/tournament fields from `GameForm` (optional refactor, not required for v1).

### High-level Task Breakdown

| ID | Task | Success criteria |
|----|------|------------------|
| **E1.1** | TeamPage — Edit Team button + dialog | Header matches Player layout; opens `TeamForm isEditing`; save calls `onUpdateTeam`; name/icon/abbrev update on page |
| **E1.2** | TeamForm — add optional **description** | Edit + create show description; Team overview reflects after save |
| **E1.3** | TournamentPage — wire `onUpdateTournament` + Edit button + dialog | AppRoutes → TournamentPage prop; reuses `TournamentForm isEditing`; save updates header name/date/teams |
| **E1.4** | Tournament edit — overlap validation on team checkbox save | Adding team that violates overlap shows error, no save (same message as add-team flow) |
| **E1.5** | `GameForm` component | Renders metadata fields; unit-testable submit payload |
| **E1.6** | `handleUpdateGame` in App + Supabase save | Updates game in state; moves game between tournaments; persists |
| **E1.7** | GameSummary — Edit Game button + dialog | Completed games editable metadata; teams read-only in form |
| **E1.8** | LiveGameEntry — Edit Game button + dialog | Live game metadata editable; calls `onGameUpdate` |
| **E1.9** | Manual QA | Edit each entity from detail page; refresh; verify Supabase round-trip |

**Recommended execution order:** E1.1–E1.2 (Team, quick win) → E1.3–E1.4 (Tournament) → E1.5–E1.8 (Game, most new code) → E1.9.

### Out of scope (v1)

- Edit roster from Team edit dialog (use Roster tab Add Player)
- Change game teams after stats recorded
- Edit individual box score lines from Game edit dialog
- Delete entity from detail page (keep on manager pages only)
- Tournament roster management (R1.5)

### Open questions for human

1. **Team description** — include in Edit Team form? **Designer recommends yes** (field already on model).
2. **Final score override** on completed games — allow manual edit when imported score ≠ computed stats? **Designer recommends yes** with inline warning.
3. **Live game tournament change** — allow after events logged? **Designer recommends block** if `game.events.length > 0`.
4. **Tournament enrolled teams** in edit dialog — keep full checkbox list (same as manager)? **Designer recommends yes** for parity.

### Project Status Board — Entity Edit (E1)

- [x] **Human:** Confirm open questions 1–4 (or accept Designer defaults) — **defaults accepted via Executor proceed**
- [x] **Executor:** E1.1 — TeamPage Edit Team
- [x] **Executor:** E1.2 — TeamForm description field
- [x] **Executor:** E1.3 — TournamentPage Edit Tournament + wire handler
- [x] **Executor:** E1.4 — Tournament overlap validation on edit save
- [x] **Executor:** E1.5 — GameForm component
- [x] **Executor:** E1.6 — handleUpdateGame + save (via enhanced `handleGameUpdate`)
- [x] **Executor:** E1.7 — GameSummary Edit Game
- [x] **Executor:** E1.8 — LiveGameEntry Edit Game
- [ ] **Human:** E1.9 manual QA
- [ ] **Designer:** Cross-check and mark E1 complete

### Executor's Feedback or Assistance Requests

- **E1 complete (2026-06-03):** Edit buttons on Team/Tournament/Game detail pages. `TeamForm` + description; `TournamentForm` with overlap check; new `GameForm` + `gameMetadata` helpers; `handleGameUpdate` persists all games and syncs tournament membership.
- **Awaiting human:** E1.9 manual QA on each detail page.

---

## Remove Player from Team — Club Roster (Designer, 2026-06-03)

### Background and Motivation

User on **Team → Roster** (e.g. NTU, Club roster (all), 18 players) can **Add Player** but cannot **remove** someone mistakenly added. **Team Manager** (`/teams` grid) already has a per-player trash icon via `handleRemovePlayer` → `onUpdateTeam`; **TeamPage** never got the same affordance.

This is separate from **tournament-scoped roster** management (R1.5): removing from the club template is not the same as removing someone from “NBL Div 2 2024 only.”

### What “remove” means in this app (locked for v1)

| Layer | Remove action |
|-------|----------------|
| **Club template** (`team.players` / `team_players`) | **This feature** — player no longer on squad list for future adds/setup |
| **Tournament roster** (`tournament_rosters`) | **Out of scope** — derived from games + future R1.5 admin; rows stay for players who actually played |
| **Game stats / box scores** | **Never deleted** by this action — historical record preserved |
| **Global `players` row** | **Not deleted** — profile becomes **orphan** if this was their only team (re-addable via Add Player → existing) |

### Key Challenges and Analysis

1. **Two roster UIs** — TeamPage Roster tab has **Club roster (all)** vs **tournament filter**. Remove must only apply to **club template** editing, not the read-only tournament view.
2. **Player with game history** — Removing from club template should still be allowed (mistaken duplicate add, player left club, etc.) with a **stronger confirm**, not a hard block.
3. **Save path exists** — `onUpdateTeam` + Supabase `team_players` upsert already sync roster membership on save; no new API shape required.
4. **Active game** — If player is on an **in-progress** game for this team, removing from template could confuse live entry; **block or warn** when `isGameInProgress` and player on that game’s roster snapshot.
5. **Overlap rules** — `validateTeamRosterUpdate` only guards **adds**; removes do not need overlap checks.
6. **Don’t conflate with delete player** — Game delete path can `deletePlayersFromSupabase` for setup-added ids; club remove is **unlink only**.

### UX recommendation (match Team Manager + Roster table)

**Where:** Team → Roster, scope = **Club roster (all)** only.

**Row action:** Narrow **Actions** column (or icon at row end) with trash button — same ghost/destructive pattern as Team Manager.

```
┌─────────────────────────────────────────────────────────────────┐
│ Team Roster  [18 Players]                    [+ Add Player]     │
│ Tournament [ Club roster (all) ▼ ]                              │
├────┬──────────┬─────┬ ... ────────────────────────────┬────────┤
│ #  │ Player   │ ... │                                   │  🗑   │
│ 22 │ Carl B.  │ ... │                                   │  🗑   │
└────┴──────────┴─────┴ ... ────────────────────────────┴────────┘
```

**When tournament scope ≠ all:**

- **Hide** row remove buttons.
- Show one-line helper under filter: *“Switch to Club roster (all) to add or remove players from the squad list.”*

**Confirmation dialogs:**

| Case | Copy (summary) |
|------|----------------|
| **No games** for this player on this team | “Remove {name} from {team}? They can be re-added later from Add Player.” |
| **Has completed games** | “Remove {name} from the club roster? Past games, stats, and tournament roster views for seasons they played are unchanged.” |
| **On active live game** | Block: “Finish or delete the live game before removing this player.” |

Use `AlertDialog` (destructive confirm) — consistent with delete game elsewhere.

### Alternative approaches considered

| Approach | Verdict |
|----------|---------|
| Remove only from **Edit Team** dialog | Poor discoverability; reject |
| Remove on **Player page** (“Leave team”) | Good secondary later; not primary |
| **Bulk select** + remove many | Overkill for v1 |
| Auto-delete **tournament_rosters** row on remove | Wrong for historical accuracy; reject for v1 |
| Hard **block** if any game stats | Too strict for mistaken adds; reject |

### High-level Task Breakdown (Executor)

| ID | Task | Success criteria |
|----|------|------------------|
| **RP1** | `getPlayerTeamGameHistory(teamId, playerId, games)` helper | Returns `{ completedCount, activeGameId? }` |
| **RP2** | `canRemovePlayerFromTeam(...)` + messages | Active game blocks; copy strings centralized |
| **RP3** | Roster table: Actions column + trash (club scope only) | NTU roster shows remove; NBL 2024 scope hides it |
| **RP4** | `handleRemovePlayerFromRoster` → `onUpdateTeam` | Same as TeamManager filter; badge count updates |
| **RP5** | Confirm `AlertDialog` wired | No games vs has-games copy; block on live game |
| **RP6** | Optional: extract shared helper used by TeamManager + TeamPage | DRY; not required if copy-paste stays small |
| **RP7** | Manual QA | Remove no-game player; remove with games (still in box score); re-add via Add Player |

**Estimated scope:** ~1 Executor session (small; reuses existing save path).

### Open questions for human

1. **Remove when player has game history?** **Human chose block** (2026-06-03) — no remove if any `game_stats` for team.
2. **Show remove on tournament-filtered roster?** **Designer recommends no** — club template only.
3. **Also add remove on Player page** (multi-team “Remove from NTU”)? **Defer** unless you want parity in same PR.

### Project Status Board — Remove Player (RP)

- [x] **Human:** Block remove if player has any game stats for team
- [x] **Executor:** RP1–RP5 (helper + TeamPage + TeamManager)
- [ ] **Human:** RP7 manual QA
- [ ] **Designer:** Cross-check

### Relation to other work

- **R1.5** — Tournament roster **admin** (copy prompt, explicit adds) is still future; this does not replace it.
- **R1.6** — Tournament roster **view** filter stays read-only for membership edits.

---

## Roster header UI polish (RU) — Designer, 2026-06-03

### Background and Motivation

Human iterated on Team → **Roster** toolbar layout:

1. Remove awkward gap under tab bar
2. **Add Player** above **Remove player** (stacked, right-aligned)
3. **Remove player** visually ~half the size of **Add Player** (button + label, not text-only)

Current implementation still feels wrong (see screenshot 2026-06-03 ~3:52 PM).

### What’s wrong today (root cause)

| Issue | Cause |
|-------|--------|
| Buttons float beside **Team Roster** title, filter feels orphaned below | `sm:flex-row` + `items-start`: right column aligns to **top** of left block only — buttons sit next to title row, not beside title+filter as one unit |
| **Remove** still reads “almost full size” or awkwardly tiny | Prior `Button` bug (`className` not merged) fixed; then `h-4` / `text-[10px]` over-corrected — looks broken, not “half primary action” |
| Gap under **Roster** tab | `Tabs` root uses `gap-2`; minor. Perceived gap is mostly the misaligned 2-column flex leaving empty vertical band beside the tournament row |

**Assumption to challenge:** “Half size” ≠ literal 50% height (`h-4` = 16px). That fails tap-target and readability. Target is **half the width of Add Player** + **one step smaller** height (`h-6`, `text-xs`), not a miniature chip.

### Target layout (canonical)

Use a **2×2 CSS grid** so left content and right actions share one toolbar — no side-by-side title/button collision.

```
┌────────────────────────────────────────────────────────────────┐
│ Team Roster  [18 Players]              ┌───────────────────┐   │
│                                        │    + Add Player   │   │  ← full sm button
│ Tournament  [Club roster (all) ▼]      └───────────────────┘   │
│                                        ┌──────────┐            │
│                                        │ 🗑 Remove │            │  ← 50% width of Add, h-6, text-xs
│                                        └──────────┘            │
└────────────────────────────────────────────────────────────────┘
│ # │ Player │ Primary │ …                                          │
```

**Rules:**

- **Row 1 col 1:** title + player-count badge
- **Row 2 col 1:** `TournamentScopeSelect` (unchanged component)
- **Col 2 rows 1–2:** `row-span-2` action stack, `items-end`, `gap-1.5`
- **Add Player:** `size="sm"` (unchanged)
- **Remove player:** only when scope = `all`; `w-1/2` of action column ( = half of Add width ); `h-6`, `text-xs`, `px-2`, icon `size-3`; labels **Remove player** / **Done removing**
- **Tab gap:** `TabsContent value="roster"` → add `className="mt-0 pt-0"` (optional: `Tabs className="gap-1"` if still tight)

**Explicitly NOT doing:**

- Horizontal **[Remove][Add]** on title row (conflicts with earlier “Add on top” direction)
- Microscopic `h-4` button
- `sm:flex-row` split for this header

### Implementation notes (Executor)

```tsx
<div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-start">
  <div className="flex items-center gap-3">…title + badge…</div>
  <div className="row-span-2 flex flex-col items-end justify-center gap-1.5 self-stretch">
    <Button size="sm">Add Player</Button>
    <Button size="sm" className="w-1/2 h-6 text-xs px-2 …">Remove player</Button>
  </div>
  <TournamentScopeSelect … />
</div>
```

- Action column width = intrinsic width of **Add Player**; `w-1/2` on Remove = true half-width.
- `Button` `className` merge fix in `button.tsx` is prerequisite (already landed).
- Remove mode / trash column / club-only scope: **no behavior change**.

### Success criteria (human QA)

- [ ] No large dead band between tab bar and **Team Roster** line
- [ ] Title + badge on left; tournament filter directly below (tight `gap-y-2`)
- [ ] **Add Player** top-right; **Remove player** below it, **~half width**, clearly smaller but readable/clickable
- [ ] Wide desktop: buttons do **not** sit on same baseline as title only (filter no longer “orphaned”)
- [ ] Narrow mobile: grid stacks naturally (col 2 below col 1 or same grid with full-width actions — Executor verify ≤640px)

### High-level Task Breakdown

| ID | Task | Success criteria |
|----|------|------------------|
| **RU.1** | Replace roster header flex with 2×2 grid | Layout matches target mockup on desktop |
| **RU.2** | Resize Remove button (`w-1/2`, `h-6`, `text-xs`) | Visually half of Add; text not truncated to “Remove” |
| **RU.3** | Tighten tab → content spacing on roster tab | Gap ≤ ~8px under tab bar |
| **RU.4** | Human QA on NTU roster (club scope) | Sign-off on screenshot |

### Project Status Board — RU

- [x] **Designer:** RU plan (this section)
- [ ] **Human:** Confirm layout matches intent
- [x] **Executor:** RU.1–RU.3 (2×2 grid header, Remove h-6/w-1/2, roster tab mt-0 pt-0)
- [ ] **Human:** RU.4 QA

### Executor's Feedback or Assistance Requests

- **RU.1–RU.3 done (2026-06-03):** Roster header uses title row + filter below. Actions in `inline-flex` wrapper (width = Add Player) so Remove `w-1/2` is half of Add, not half the page. Roster `TabsContent` has `mt-0 pt-0`.
- **RU.5 (Designer, 2026-06-03):** Human wants **tight title→filter on left**, **unchanged button gap on right** — see below.

---

### RU.5 — Decouple left column spacing from right (Designer, 2026-06-03)

#### Problem

Current DOM nests filter **outside** the title row:

```
space-y-2
├── flex row: [Title + badge]  |  [Add / Remove stack gap-1.5]
└── TournamentScopeSelect
```

`space-y-2` adds gap between title row and filter. Buttons only align with the title, so the filter looks detached on the left while the right side has natural button spacing.

#### Target

```
┌──────────────────────────────────────────────────────────────┐
│ Team Roster [18 Players]           ┌─────────────────────┐   │
│ Tournament [Club roster (all) ▼]   │     + Add Player    │   │  ← gap-1.5 between buttons
│                                    │     Remove player   │   │
└────────────────────────────────────└─────────────────────┘───┘
     ↑ gap-y-1 (or none) between title & filter
```

**Left:** title + filter stacked tight (`gap-y-1` or `gap-y-0.5`)  
**Right:** action column `row-span-2`, internal `gap-1.5` **unchanged**

#### Implementation (Executor — one step)

Replace the `space-y-2` + flex-row wrapper with a **2-column grid**:

```tsx
<div className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1">
  {/* Left col */}
  <div className="flex items-center gap-3">…title + badge…</div>
  <TournamentScopeSelect className="col-start-1 row-start-2" … />

  {/* Right col — spans both left rows; button gap independent of gap-y-1 */}
  <div className="col-start-2 row-start-1 row-span-2 flex w-max flex-col gap-1.5 self-start">
    <Button>Add Player</Button>
    <div className="flex justify-end">
      <Button className="w-1/2 h-6 text-xs …">Remove player</Button>
    </div>
  </div>
</div>
```

**Notes:**
- `gap-y-1` (4px) only separates **grid rows on the left**; merged right cell is unaffected.
- Keep `w-max` + half-width Remove wrapper (fixes prior full-page width bug).
- Mobile: same grid works at all widths; if title row feels cramped, optional `max-sm:grid-cols-1` with actions after filter — **only if QA fails**; default = single grid at all breakpoints.

#### Success criteria

- [ ] Title and Tournament filter visually tight on left (no `space-y-2` band)
- [ ] Add → Remove vertical spacing unchanged (`gap-1.5`)
- [ ] Remove still half-width of Add, below Add, right-aligned
- [ ] No regression to side-by-side buttons

#### Task

| ID | Task | Owner |
|----|------|-------|
| **RU.5** | Grid layout with `row-span-2` actions + `gap-y-1` left rows | Executor |

#### Project Status Board — RU (updated)

- [x] **Designer:** RU plan
- [x] **Executor:** RU.1–RU.3
- [x] **Designer:** RU.5 plan (decouple left/right spacing)
- [x] **Executor:** RU.5 (grid `gap-y-1` left, `row-span-2` actions `gap-1.5`)
- [ ] **Human:** RU.4 / RU.5 QA

---

## R2 — Edit Players / tournament roster management (Designer, 2026-06-03) — **LOCKED**

### Background and Motivation

Human needs to manage which **club template** players appear on which **tournament roster** (`tournament_rosters`). Replace header **Remove** with **Edit Players** (Settings icon). In edit mode, table becomes `# | Player | Tournaments | 🗑` — tournament pills with per-tournament trash + `[+]`, plus **existing club-remove trash** at row end.

**Prerequisites (done):** `tournament_rosters` table + load/save; club overlap check removed from Add Player dialog.

---

### Human decisions (locked 2026-06-03)

| # | Decision |
|---|----------|
| **Q1** | **Keep club remove** — row-end trash still removes player from **club template** (existing rules: block if any game stats for team). Edit Players adds tournament management; does **not** drop club unlink. |
| **Q2** | Tournament remove with game history → **warning + confirm** (not hard block). User can proceed after acknowledging. |
| **Q3** | Add to tournament T when player already on **another team** for T → **hard block** with clear message. |
| **Q4** | **Immediate auto-save** on each add/remove (existing debounced Supabase save). |
| **Q5** | Edit mode: hide stat columns; show **`# | Player | Tournaments | (club 🗑)`** only. |
| **Q6** | **`[+]` UI:** **Popover** menu of tournament names (cleaner inline with pills). |
| **Q7** | On add: copy **jersey #** from club template; **position is global** on player profile. |
| **Q8** | Edit mode: **disable row navigation** to player page. |
| **Q9** | Team enrolled in zero tournaments → helper text; **`[+]` disabled**. |
| **Q10** | Header icon: **`Settings`** (lucide). Label **Edit Players** / **Done**. |

---

### Target UX

#### Normal mode (unchanged)
Club roster scope → full stats table, sortable.

#### Edit Players mode (club scope only)

**Header button:** `[⚙ Edit Players]` → toggled → `[⚙ Done]` (secondary when active)

**Table:**

```
┌────┬─────────────┬──────────────────────────────────────────┬────┐
│ #  │ Player      │ Tournaments                              │    │
├────┼─────────────┼──────────────────────────────────────────┼────┤
│ 3  │ Jerel Tan   │ [+]                                      │ 🗑 │
│ 5  │ Abel Au     │ [NBL Div 2 2023 🗑] [+]                  │ 🗑 │
│ 22 │ Carl B.     │ [NBL Div 2 2024 🗑] [+]                  │ 🗑 │
└────┴─────────────┴──────────────────────────────────────────┴────┘
```

- **Tournament pill:** compact chip — tournament name + small trash (removes from that tournament only).
- **`[+]`:** Popover of enrolled tournaments not yet assigned; click → add → auto-save.
- **Row-end 🗑:** Club remove (RP rules unchanged).
- **Row click:** disabled in edit mode.

**Zero tournaments:** helper *“Enroll this team in a tournament to assign players to season rosters.”* — all `[+]` disabled.

---

### Behavior rules

#### Add to tournament roster
1. Player on club template for this team (always true in this view).
2. Team enrolled in tournament.
3. Player not already on this team’s roster for T.
4. **Block** if player on another team for same T — e.g. *“Carl Belanger is already on Kai Xuan for NBL Div 2 2024.”*
5. New row: jersey # from club template; position from global player profile.
6. Immediate save via `onUpdateTournamentRosters`.

#### Remove from tournament (pill trash)
1. If ≥1 completed game with stats for `(teamId, tournamentId)` → **AlertDialog warning** with GP count; confirm proceeds.
2. No games → delete row immediately (no extra confirm in v1).
3. Does not remove from club template.

#### Remove from club (row-end trash)
- Unchanged (RP): block if team game stats; confirm if allowed.

#### Scope gating
- Edit button only when `rosterTournamentScope === 'all'`.
- Done or scope change exits edit mode.

---

### Architecture (Executor)

**New prop:** `onUpdateTournamentRosters: (entries: TournamentRosterEntry[]) => void`  
**App.tsx:** `handleUpdateTournamentRosters` → `setTournamentRosters` + existing debounced save.

**Helpers (`tournamentRosters.ts`):**

| Helper | Purpose |
|--------|---------|
| `getEnrolledTournamentsForTeam` | Tournaments team is in |
| `getPlayerTournamentRosterEntries` | Pills for one row |
| `getAddableTournamentsForPlayer` | Enrolled minus assigned |
| `wouldAddPlayerToTournamentRosterViolate` | Q3 cross-team block |
| `evaluateTournamentRosterRemoval` | GP count for warning |
| `buildTournamentRosterEntryFromClub` | Jersey from club, position from player |

**State renames:** `isRemovePlayerMode` → `isEditPlayersMode`; header `Settings` icon; labels Edit Players / Done. Keep club remove dialogs.

**Component:** extract `TournamentRosterCell` (pills + `[+]` popover).

---

### Task breakdown

| ID | Task | Success criteria |
|----|------|------------------|
| **R2.1** | Helpers + evaluators | Q3 block + Q2 GP count |
| **R2.2** | `onUpdateTournamentRosters` wiring | Persists to Supabase |
| **R2.3** | Header: Settings, Edit Players / Done | Club scope only |
| **R2.4** | Edit-mode table (4 cols, no row nav) | Stats hidden |
| **R2.5** | `TournamentRosterCell` | Pills, pill trash, `[+]` popover |
| **R2.6** | Tournament remove warning dialog | Confirm after GP warning |
| **R2.7** | Row-end club trash in edit mode | RP rules unchanged |
| **R2.8** | Manual QA | Carl SAFSA/Kai Xuan scenarios |

---

### QA checklist

- [ ] Edit Players ↔ Done toggles layout
- [ ] Jerel: only `[+]`; Abel: pill + `[+]`
- [ ] Carl SAFSA 2023 + Kai Xuan 2024 — allowed
- [ ] Same tournament, two teams — blocked
- [ ] Tournament remove with games — warning, can confirm
- [ ] Row-end trash — club remove rules
- [ ] Immediate save (no Done required)

---

### Project Status Board — R2

- [x] **Designer:** R2 spec locked
- [x] **Human:** Q1–Q10 answered
- [x] **Executor:** R2.1–R2.7 (helpers, TournamentRosterCell, Edit Players mode, save wiring)
- [ ] **Human:** R2.8 QA

### Executor notes (2026-06-03)

- `tournamentRosters.ts`: add/remove helpers, cross-team violation, GP eval for tournament remove warning
- `TournamentRosterCell.tsx`: pills + `[+]` popover
- `TeamPage`: Settings / Edit Players toggle; edit table `# | Player | Tournaments | club 🗑`
- `App.tsx` + routes: `onUpdateTournamentRosters` → immediate debounced save

---

### R2-PERSIST — `[+]` tournament add does not survive refresh (Designer, 2026-06-02)

#### Symptom (human)

Team → Roster → **Edit Players** → **`[+]`** → pick tournament → pill appears in session → **full page refresh** → pill gone (player not on tournament roster).

#### What should happen (locked R2 / Q4)

1. `TeamPage.handleAddToTournament` → `onUpdateTournamentRosters(upsertTournamentRosterEntry(...))`
2. `App.handleUpdateTournamentRosters` → `setTournamentRosters(entries)`
3. Debounced `saveAppDataToSupabase(..., tournamentRosters)` writes `tournament_rosters` (delete all rows for in-app tournament IDs, then upsert in-memory rows)
4. `loadAppDataFromSupabase` reads `tournament_rosters` on next load

UI is **not** game-derived in edit mode — pills come only from `tournamentRosters` state (`getPlayerTournamentRosterEntries`). So if refresh loses pills, either **save never ran**, **save failed**, or **load did not return rows**.

#### Root-cause analysis (ranked)

| # | Cause | Likelihood | Evidence |
|---|--------|------------|----------|
| **A** | **Save skipped during initial cloud load** | **High** | `skipSaveRef` starts `true` until first `loadAppDataFromSupabase` finishes. Persist `useEffect` returns early when `skipSaveRef.current` (`App.tsx` ~1192). If user adds via `[+]` while sync in flight, **no save is scheduled**. When `skipSaveRef` flips to `false`, effect **does not re-run** (deps unchanged). `handleUpdateTournamentRosters` does **not** set `localMutatedSinceMountRef`, so `finally` does **not** call `persistCurrentAppData()` (~1152–1157). Matches “works until refresh” if user acts in first ~1–3s after paint from snapshot. |
| **B** | **Migration 005 not applied** | **High** | `loadAppDataFromSupabase`: on `tournament_rosters` query error → warn + `tournamentRosterRows = []` (~662–680). Save `delete`/`upsert` on missing table → thrown error. Console: `[Supabase] tournament_rosters unavailable` + `MIGRATION_005_HINT`. |
| **C** | **Save failed (DB constraint) not noticed** | Medium | Table has `unique (tournament_id, player_id)`. Cross-team add blocked in UI (`wouldAddPlayerToTournamentRosterViolate`); stale state could still fail upsert. Red `saveError` banner should show — human may miss it. |
| **D** | **Refresh before debounced save** | Low–medium | Save uses `requestIdleCallback` + **500ms** timeout (~1236–1261). Refresh &lt; ~1s after add can beat write. Q4 promised “immediate” save — implementation is debounced. |
| **E** | **Cloud load overwrites in-session edit** | Medium (with A) | If add during sync without `localMutatedSinceMountRef`, cloud `applyProcessedToState` can replace `tournamentRosters` with DB (empty) **before** user refreshes — pill may vanish without refresh. |
| **F** | `buildTournamentRostersFromGames` on delete game/team | N/A for this bug | Only runs in `handleDeleteActiveGame` / delete team paths (~1351, ~1734) — strips manual rows without games, not on normal refresh. |

**Assumption to challenge:** “In-memory update = saved.” **False** — React state updates immediately; Supabase write is conditional on save pipeline.

#### How to confirm (human / Executor, before coding)

1. **Console on load:** `[Supabase] tournament_rosters unavailable` → run `npm run db:migrate:005` or SQL in `supabase/migrations/005_tournament_rosters.sql`.
2. **Repro timing:** Add via `[+]` within 2s of opening team page vs after 5s idle → if only early add fails, **Cause A** confirmed.
3. **Save banner:** After add, any red cloud save error?
4. **Wait then refresh:** Add → wait 3s → refresh. If pill survives, **Cause D**; if never survives, **A or B**.
5. **Supabase Table Editor:** After add + wait, row in `tournament_rosters` for `(tournament_id, team_id, player_id)`?

#### Fix plan (Executor — one task at a time)

| ID | Task | Success criteria |
|----|------|------------------|
| **R2.9a** | In `handleUpdateTournamentRosters`: set `localMutatedSinceMountRef.current = true` (same as `handleGameUpdate`) | Early add during sync triggers `persistCurrentAppData` in load `finally` |
| **R2.9b** | When clearing `skipSaveRef` after load: if `tournamentRostersRef` ≠ `prevTournamentRostersRef`, schedule save (or call `persistCurrentAppData`) even without `localMutated` | Any roster drift during skip-save window flushes after load |
| **R2.9c** | **Optional but matches Q4:** `handleUpdateTournamentRosters` calls `persistCurrentAppData()` directly (or dedicated `saveTournamentRosters`) — no reliance on debounced effect alone | Add → row visible in Supabase within 1s without waiting for other state churn |
| **R2.10** | If load returns `tournament_rosters` error: non-blocking UI banner with `MIGRATION_005_HINT` | Human sees migration requirement without opening console |
| **R2.11** | Re-run R2.8 QA: add/remove tournament, refresh, second device | Pills and Table Editor rows match |

**Do not** merge game-derived rosters over DB rows on load (would hide manual adds without games) — load path already uses DB only (~818–820); keep that.

#### Project Status Board — R2 (updated)

- [x] **Designer:** R2-PERSIST root-cause + fix plan (this section)
- [ ] **Human:** Confirm migration 005 applied; run confirm steps above
- [x] **Executor:** R2.9a–c (save gating fix) — 2026-06-02
- [ ] **Executor:** R2.10 (migration banner) — optional same PR
- [ ] **Human:** R2.8 / R2.11 QA after fix

#### Executor's Feedback or Assistance Requests

- **Designer (2026-06-02):** Most likely **dual** issue: (A) skip-save window + no `localMutated` on tournament roster handler, and/or (B) migration 005 not on Supabase project. Executor should implement **R2.9a–b** first, then verify DB with human.
- **Executor (2026-06-02) — R2.9a–c landed in `App.tsx`:**
  - `handleUpdateTournamentRosters`: sets `localMutatedSinceMountRef`, syncs `tournamentRostersRef`, calls `persistCurrentAppData()` via microtask when not in skip-save / loading.
  - Cloud load `finally`: also persists when `tournamentRostersRef` ≠ `prevTournamentRostersRef` (drift during skip-save).
  - `npm run build` passes.
  - **Human QA:** Edit Players → `[+]` add tournament → refresh (try immediately after page load and after 5s). If still missing, run migration 005 and check console for `tournament_rosters unavailable`.
- **Human (2026-06-02):** R2.9 still not working — wants **another approach** + **DB backfill**: any player with stats in a completed tournament game → on that **team’s tournament roster**.

---

### R3 — Game-derived tournament rosters (Designer, 2026-06-02) — **LOCKED pivot**

#### Why R2.9 was not enough

Patching the debounced save path does not help if:

| Blocker | Effect |
|---------|--------|
| **Migration 005 never applied** | Load returns `tournamentRosters: []`; every save to `tournament_rosters` throws — pills and DB stay empty no matter how fast we persist. |
| **Save still failing** (RLS, network, constraint) | UI state ≠ DB; refresh reads empty DB. |
| **Wrong mental model** | Human expectation: *“played in tournament → on roster.”* That is **`buildTournamentRostersFromGames`**, not manual `[+]`. DB was never backfilled; Edit Players only edits in-memory `tournamentRosters` rows that may never land in Supabase. |

**Conclusion:** Stop treating manual `[+]` as the primary way to establish membership. Use **completed game stats** as the canonical rule (already implemented in `src/utils/tournamentRosters.ts` + `scripts/backfill-tournament-rosters.ts`).

#### Human rule (locked)

> For each **completed** game with a `tournamentId`, every `playerId` in `gameStats` is on the **tournament roster** for the **team they played for** in that game (`resolvePlayerTeamSideInGame`). Jersey/position defaults from club template at backfill time.

Manual `[+]` remains for **pre-season** adds (no games yet) — optional overlay, not the main fix.

#### Alternative fix (app) — “always merge from games”

Do **not** rely on DB-only load for membership display or saves.

| Step | Where | Behavior |
|------|--------|----------|
| **R3.1** | `tournamentRosters.ts` | New `mergeTournamentRosters(stored, fromGames)` — union: all game-derived rows included; keep stored row for same `(tournamentId, teamId, playerId)` but prefer stored jersey/position when present; keep stored-only rows only if they do not violate `unique (tournament_id, player_id)` vs game-derived team. |
| **R3.2** | `processLoadedAppData` | After load: `fromGames = buildTournamentRostersFromGames(games, teams).entries`; `tournamentRosters = merge(stored, fromGames)`. **Refresh always shows correct pills for anyone who played**, even if DB table empty. |
| **R3.3** | `saveAppDataToSupabase` (or `App` before save) | Persist **merged** rosters, not raw in-memory DB mirror — self-heals Supabase on next save. |
| **R3.4** | `handleGameUpdate` / game complete | When a game becomes `isCompleted`, re-merge rosters into state (same as R3.2) so new box scores immediately update Edit Players + tournament scope roster. |
| **R3.5** | Load side effect (optional) | If `verify` would show `missing > 0`, queue one `persistCurrentAppData` after load — writes merged rows without human running script. |

**Revokes** R2-PERSIST note “do not merge on load” — human explicitly wants game participation to drive rosters.

**What this does *not* fix alone:** Supabase table still must exist for persistence across devices; merge fixes **UI truth** from games immediately.

#### DB backfill (Executor — run for human, no new script needed)

Existing tooling:

```bash
# 1. Ensure table exists
npm run db:migrate:005

# 2. Preview rows derived from all completed games
npm run backfill:tournament-rosters -- --dry-run

# 3. Write merged rosters to Supabase (replaces in-app tournament_rosters for all tournaments)
npm run backfill:tournament-rosters

# 4. Confirm DB matches game-stats rule
npm run verify:tournament-rosters
```

**What backfill does:** Loads teams/games from Supabase → `buildTournamentRostersFromGames` → `saveAppDataToSupabase(..., entries)` (full replace for league tournaments). Populates `tournament_rosters` for every player with stats in a completed tournament game.

**Caveats (report in dry-run):**

- `ambiguous` — player on both home/away club rosters in same game; side resolved via `resolvePlayerTeamSideInGame`.
- `conflicts` — same player stats for two teams in one tournament; DB `unique (tournament_id, player_id)` allows only one — must resolve in data before backfill succeeds.

#### Task breakdown (Executor, one at a time)

| ID | Task | Success criteria |
|----|------|------------------|
| **R3.1** | `mergeTournamentRosters` + unit tests in `scripts/test-tournament-rosters.ts` | Merge tests pass |
| **R3.2** | Wire merge in `processLoadedAppData` | After refresh, Edit Players shows pills for players with completed tournament game stats (DB empty OK) |
| **R3.3** | Merge before cloud save | `verify:tournament-rosters` passes after one normal app save |
| **R3.4** | Re-merge on game complete | Completing/editing box score adds roster row without `[+]` |
| **R3.5** | Run migrate 005 + backfill + verify (needs `.env.local`) | Human sees rows in Supabase `tournament_rosters`; verify exits 0 |
| **R3.6** | R2.10 migration banner (optional) | Console/table-missing surfaced in UI |

**Order:** R3.5 first if migration never applied (unblocks DB); then R3.1–R3.4 (app self-heal); human QA.

#### Success criteria (human QA)

- [ ] Player with box score in **NBL Div 2 2024** shows tournament pill / appears in that tournament roster scope **without** using `[+]`
- [ ] Refresh keeps them (from games merge even if DB was empty before backfill)
- [ ] After backfill, Supabase Table Editor shows matching rows
- [ ] `npm run verify:tournament-rosters` passes

#### Open questions

1. **Backfill overwrite:** Script saves **game-derived only** — manual `[+]` rows with no games are dropped on backfill. OK for v1? (Human focus = played → roster.)
2. **Conflicts:** If dry-run lists conflicts, human must fix game/team data before full backfill.

#### Project Status Board — R3

- [x] **Designer:** R3 pivot spec (this section)
- [x] **Executor:** R3.5 backfill — human applied migration 005; backfill wrote **64** rows; `verify:tournament-rosters` passed (2026-06-02)
- [x] **Executor:** R3.1–R3.4 app merge (2026-06-02)
- [ ] **Human:** QA success criteria above

#### Executor notes (2026-06-02) — R3.1–R3.4

- `mergeTournamentRosters`, `reconcileTournamentRostersFromGames`, `findTournamentPlayerTeamConflict` in `tournamentRosters.ts`
- `processLoadedAppData` reconciles on every load (refresh shows players who played)
- `App.tsx`: merge before cloud save / snapshot; re-merge on completed `handleGameUpdate` + `handleGameComplete`
- `npm run test:tournament-rosters` + `npm run build` pass
- **Human:** Run `005_tournament_rosters.sql` in Supabase SQL Editor (migrate script needs `DATABASE_URL`). Then retry `npm run backfill:tournament-rosters -- --dry-run` when load is fast enough, then write + `verify:tournament-rosters`

---

## P1 — Load/save reliability (Designer, 2026-06-05)

### Symptoms (human DevTools + UI, 2026-06-05)

| Symptom | Console / UI |
|---------|----------------|
| **Red banner** | `Could not save to cloud: teams: canceling statement due to statement timeout` |
| **Cache broken** | `QuotaExceededError` — `runitback_app_data_snapshot_v1` exceeds `localStorage` quota (×2–3 per refresh) |
| **Dashboard wrong** | Teams list shows **0 Players** on every team until cloud sync finishes |
| **Roster pills lag** | Tournament pills empty ~4–10s after refresh (same sync window) |
| **500** | Failed resource on `tournament_id` (likely `tournament_teams` / `tournament_rosters` delete during save) |

Cloud load in same session: `loadAppDataFromSupabase` **totalMs ~3948** — load is ~4s; pain is **stale cache + failed saves**, not a separate 10s roster API.

### Root-cause chain (single story)

```
Refresh
  → read localStorage snapshot (STALE — writes fail with QuotaExceeded)
  → paint UI: teams without players, empty tournamentRosters
  → ~4s cloud load completes → correct teams/players/rosters
  → applyProcessedToState → saveAppDataSnapshot (FAIL quota again)
  → state change / roster reconcile → debounced saveAppDataToSupabase (FULL LEAGUE WRITE)
  → Supabase statement timeout on `teams` upsert (or earlier table in chain)
  → red banner; cache still stale next refresh
```

**Assumption to challenge:** “Timeout is teams table being slow.” **Partially false** — `teams` upsert is 28 small rows; timeout is likely **DB under load from the monolithic save** (games JSON + `team_players` delete-all + `tournament_rosters` delete-all + junction deletes) on a **short `statement_timeout`** (Supabase default ~8s on some plans).

### Issue A — `QuotaExceededError` (localStorage snapshot)

**Cause:** `saveAppDataSnapshot` stores **entire** `games[]` with `gameStats`, `shots`, `events`, `lineupStints`, plus embedded `homeTeam`/`awayTeam` player snapshots. 28 games → multi‑MB JSON → exceeds ~5MB `localStorage` limit.

**Effects:**
- Every post-load snapshot write fails → cache **never refreshes** after backfill / R3.
- Next refresh reads **old** snapshot (possibly teams shells, no `gameStats`, no `tournamentRosters`) → 0 players + no tournament pills until cloud.

**Fix (Executor):**

| ID | Task | Success criteria |
|----|------|------------------|
| **P1.A1** | `toSnapshotPayload()` — **lite games** for cache only: keep `id`, `tournamentId`, `isCompleted`, `gameStats`, `homeTeamId`, `awayTeamId`, scores; **drop** `shots`, `events`, `lineupStints`; store team refs by id not full nested rosters | Serialized snapshot &lt; ~2MB for current league |
| **P1.A2** | Bump `APP_DATA_SNAPSHOT_VERSION` → **3**; on read v2 try migrate or discard | Old bloated key not used |
| **P1.A3** | Pre-write size check: if still &gt; 4MB, strip `gameStats` to `{ playerId }` only for roster reconcile (keep membership, drop counting stats in cache) | No QuotaExceeded in console after refresh |
| **P1.A4** | (Optional v2) IndexedDB via `idb-keyval` for full cache — defer unless A1–A3 insufficient |

### Issue B — Statement timeout on save

**Cause:** Any state change triggers **`saveAppDataToSupabase` full rewrite**: leagues → teams → **delete all `team_players` + reinsert** → tournaments → **delete all `tournament_teams`** → **delete all `tournament_rosters`** → **upsert all games** (largest payload). R3 **reconcile on save** changes `tournamentRosters` → triggers this after every load.

**Contributors:**
- `prev*Ref` updated **before** save succeeds (`App.tsx` ~1238–1242) — failed save still looks “synced” to debounce logic.
- Multiple overlapping saves: load `finally` → `persistCurrentAppData`, `applyProcessedToState` snapshot, debounced effect, side-effect migration saves.
- No save mutex.

**Fix (Executor):**

| ID | Task | Success criteria |
|----|------|------------------|
| **P1.B1** | **`saveTournamentRostersToSupabase(entries)`** — upsert rosters only (no teams/games touch) | Roster-only change saves in &lt;1s |
| **P1.B2** | **Partial save routing:** tournament roster drift → B1 only; game change → `saveGame`; team/player → targeted paths; **full save** only on explicit “import” or migration | Load + reconcile does not fire full league write |
| **P1.B3** | **Save mutex** — queue/coalesce; one in flight at a time | No parallel full saves in Network tab |
| **P1.B4** | Move `prev*Ref` update to **after** successful save (or rollback on failure) | Failed save retries on next change |
| **P1.B5** | Skip save when cloud load produced **identical** merged payload (hash compare) | No save immediately after read-only refresh |

**Human (Supabase ops, optional):** SQL Editor → check `statement_timeout`; consider raising for project if partial saves still tight.

### Issue C — Dashboard “0 Players”

**Cause:** Not a Dashboard bug — `team.players.length` from **stale snapshot** where player arrays empty. Cloud apply fixes ~4s later.

**Fix (Executor):**

| ID | Task | Success criteria |
|----|------|------------------|
| **P1.C1** | **Stale snapshot guard:** if snapshot teams all have `players.length === 0` but `team_players` count &gt; 0 expected (or snapshot age + empty), **skip paint** — keep loading spinner until cloud OR merge players from `orphanPlayers` heuristic | No “0 Players” flash on dashboard |
| **P1.C2** | Depends on **P1.A** — warm cache includes full `teams[].players` | After one good save, refresh shows correct counts instantly |

### Issue D — Tournament roster UI lag (ties to A + C)

Already addressed in app logic (R3 reconcile); **remaining lag is cache miss**. **P1.A + P1.C** are the fix; optional **P1.E1** derive pills from `games` prop in `TeamPage` useMemo so Edit Players never waits on `tournamentRosters` state alone.

### Recommended Executor order

1. **P1.A1–A3** (slim snapshot) — unblocks cache, fixes refresh UX fastest  
2. **P1.B1–B2** (partial roster save) — stops timeout banner after load  
3. **P1.B3–B5** (mutex + ref fix + skip redundant save)  
4. **P1.C1** (stale guard)  
5. **P1.E1** (optional TeamPage derive)  

### Success criteria (human QA)

- [ ] Hard refresh: no `QuotaExceededError` in console  
- [ ] Dashboard player counts correct **immediately** (or brief spinner, not “0 Players”)  
- [ ] Edit Players tournament pills visible without waiting for cloud (with warm cache)  
- [ ] No red `statement timeout` banner after idle refresh  
- [ ] Network: refresh does not POST entire `games` table when only viewing roster  

### Project Status Board — P1

- [x] **Designer:** P1 spec (this section)
- [x] **Executor:** P1.A1–A3 — lite snapshot v3, size guard, hydrate on read (`appDataSnapshot.ts`)
- [x] **Executor:** P1.B1–B2 — `saveTournamentRostersToSupabase` + roster-only routing
- [x] **Executor:** P1.B3–B5 — `enqueueCloudSave` mutex; prev refs after success; roster-only on drift
- [x] **Executor:** P1.C1 — skip stale snapshot (all teams 0 players)
- [ ] **Human:** P1 QA
- [x] **Executor:** Restored emptied `005_tournament_rosters.sql` in repo

### Executor's Feedback or Assistance Requests

- **Designer (2026-06-05):** DevTools confirms ~4s load + quota + full-save timeout — treat as **one reliability epic**, not separate roster bug. Start with slim snapshot before IndexedDB or Supabase plan changes.

---

## SAFSA-I — NBL Div 2 2023 box score import (Designer, 2026-06-05)

### Background

Human added `Importingboxscores/SAFSA Div2 '23/` with **4 Easy Stats HTML** exports. Goal: load completed games + SAFSA player stats into **NBL Div 2 2023** (same pipeline as KX Div2 '24).

### Human decisions (confirmed 2026-06-05)

| Topic | Decision |
|-------|----------|
| Tournament | **NBL Div 2 2023** (`tournament-1780425044074`) |
| Scope | **4 games only** (for now) |
| Opponent stats | **SAFSA-side only** — opp final score, no opp player lines |
| SAFSA team | `team-kx-div2-safsa` / **SAFSA Arion** |
| Opponents | Reuse enrolled IDs + **DB display names** (not HTML nicknames) |
| Dates | **Filename dates** (not HTML header dates) |
| Home/away | **SAFSA home** all 4 games |
| Player map | Approved (see below); Javier **#24** (KTS #22 Javier = typo) |
| Cross-club IDs | OK for Carl, Jingjie, Glen |
| New players | None |
| Minutes | Synthetic (see algorithm); **total 200** per game |
| Box score | **Full** from HTML |
| DNP rows | **Skip** |
| MOB opp stats row | **Ignore** — score only |
| Import | **4 new games** (one-shot; no re-run / `--stats-only` update path) |
| Backfill rosters | **Skip** — human says tournament rosters already correct |
| Exclusions | None |

#### F17 / F18 clarified for human

- **F17 (`--stats-only`)** was only about *re-importing* if games already existed. You said create fresh games from the 4 box scores — Executor will generate **4 new `game-*` IDs** and run normal `import:boxscore` once. No duplicate-update logic needed.
- **F18 (`backfill:tournament-rosters`)** rebuilds `tournament_rosters` rows from *who appeared in completed game stats*. Since you’ve already set tournament rosters via Edit Players, we **skip backfill** unless post-import verify shows missing rows.

### Locked game table

| Game ID | Date | File | Away @ Home | Score (away–home) |
|---------|------|------|-------------|-------------------|
| `game-safsa23-2023-03-22-kts` | 2023-03-22 | `SAFSA vs KTS Black 220323.html` | KTS NSC @ SAFSA Arion | 61–65 |
| `game-safsa23-2023-04-02-police` | 2023-04-02 | `SAFSA vs PoliceSA 2 020423.html` | Police SA @ SAFSA Arion | 53–69 |
| `game-safsa23-2023-04-16-tungsan` | 2023-04-16 | `SAFSA vs TungsanYH 160423.html` | Tungsan @ SAFSA Arion | 48–63 |
| `game-safsa23-2023-04-18-mob` | 2023-04-18 | `MOB Basketball vs SAFSA Arion box-scores-18 Apr 2023.html` | Team M.O.B @ SAFSA Arion | 64–103 |

### Opponent team IDs (enrolled — reuse as-is)

| Opponent ID | Enrolled name |
|-------------|---------------|
| `team-kx-div2-kts` | KTS NSC |
| `team-kx-div2-police` | Police Sports Association |
| `team-kx-div2-tungsan` | Tungsan |
| `team-1780430691078` | Team M.O.B |

### Player map (HTML nickname → `player_id`)

| HTML key | player_id | Notes |
|----------|-----------|-------|
| Jing Jie | `player-sunig-ntu-1` | cross-club — fixed MPG |
| Jerel | `player-1780430969043` | |
| Jun Wei | `player-1780430866865` | |
| Glen | `player-ivp-ntu-11` | cross-club — fixed MPG |
| Andy | `player-1780482964172` | |
| Carl | `player-sunig-ntu-22` | cross-club — fixed MPG |
| Zhi Kang | `player-1780483061760` | |
| Albert | `player-1780431036739` | |
| Abel | `player-1780431067944` | |
| Kynan | `player-1780483138222` | |
| Ernest | `player-1780482931133` | |
| Eldridge | `player-1780482892675` | |
| Jonah | `player-1780483098031` | |
| Javier | `player-1780431100788` | always #24; skip DNP |
| Wee Kong | `player-1780483029327` | |

### Minutes algorithm (E13 — synthetic)

**Constants:** `TOTAL_TEAM_MINUTES = 200` (5 players × 40).

**Cross-club players** (`player-sunig-ntu-22`, `player-sunig-ntu-1`, `player-ivp-ntu-11`):

1. At build time, `loadAppDataFromSupabase()` and compute **career minutes per game** = sum(`minutes_played`) / count(completed games with `minutes_played > 0`) across **all** their games in DB (same as profile MPG).
2. If no prior games → fallback **18.0** min (document in build log).
3. For each SAFSA 2023 game they **have box-score activity** in, assign exactly that MPG (not scaled).

**All other SAFSA players with activity:**

1. `remaining = 200 − sum(cross-club fixed minutes for active players this game)`.
2. Weight each player: `w = max(pts, 1) × (1 + uniform(−0.15, +0.15))` — seeded PRNG per `gameId` for reproducibility.
3. Allocate `remaining × (w / sum(w))`, round to 0.1 min, then **adjust largest share** so active players sum to **exactly 200**.

**DNP / no activity:** excluded (per E15); no minutes row.

**Starters:** top 5 SAFSA players by `minutes_played` (KX pattern).

### HTML parsing rules

- Reuse KX `parseHtmlStats` pattern; skip rows with no activity (`hasBoxScoreActivity`).
- Skip team total rows (`SAFSA Arion`, `MOB Basketball`, opponent names in stats table).
- Skip `#22 Javier` when all `-` (DNP typo row).
- `trackBothTeams: false` — SAFSA `gameStats` only; opp `emptyTeamStats` with final score.
- Validate SAFSA points sum = home score each game.

### High-level Executor plan

| ID | Task | Success criteria |
|----|------|------------------|
| SAFSA-I.1 | `scripts/build-safsa-div2-23-imports.ts` — parse HTML, synthetic minutes, write 4 JSON to `Importingboxscores/SAFSA Div2 '23/json/` | Dry-run logs 4 games; each JSON pts total matches score; minutes sum 200 |
| SAFSA-I.2 | Dry-run builder + human spot-check one JSON | Carl/Jingjie/Glen MPG printed; MOB game 103 pts |
| SAFSA-I.3 | `npm run import:boxscore -- --file …` × 4 with `--dry-run` then live | 4 games in Supabase, tournament still NBL Div 2 2023 |
| SAFSA-I.4 | Verify script output: 4 SAFSA games, 0 orphans, skip backfill unless gaps | `list-safsa-context` shows 4 SAFSA games |
| SAFSA-I.5 | Human QA in app | Tournament page shows 4 games, box scores + SAFSA stats |

**Import flags:** use `--stats-only` on `import:boxscore` (teams/players/tournament already in DB — only upsert game rows + tournament metadata; avoids touching player profiles).

### Project Status Board — SAFSA-I

- [x] **Designer:** SAFSA-I discovery + question set
- [x] **Human:** Answers A–F confirmed
- [x] **Designer:** Revised plan + minutes algorithm + locked game table
- [x] **Executor:** SAFSA-I.1 — `build-safsa-div2-23-imports.ts` + `npm run build:safsa-div2-23` wrote 4 JSON
- [x] **Human:** Spot-check SAFSA-I.2 (approved via proceed)
- [x] **Executor:** SAFSA-I.3 — `import:boxscore --stats-only` × 4 (all Import complete)
- [x] **Executor:** SAFSA-I.4 — verify: NBL Div 2 2023 has 4 SAFSA games; backfill skipped per human
- [ ] **Human:** SAFSA-I.5 QA in app

### Executor's Feedback or Assistance Requests

- **Designer (2026-06-05):** Plan ready for Executor. Start SAFSA-I.1 only; stop for human JSON spot-check before Supabase writes.
- **Executor (2026-06-05):** SAFSA-I.1 complete. Builder output:
  - `game-safsa23-2023-03-22-kts`: 12 lines, 65 pts, 200 min
  - `game-safsa23-2023-04-02-police`: 11 lines, 69 pts, 200 min
  - `game-safsa23-2023-04-16-tungsan`: 11 lines, 63 pts, 200 min
  - `game-safsa23-2023-04-18-mob`: 12 lines, 103 pts, 200 min
- **Executor note:** Cross-club MPG from Supabase career avg returned **18.0 fallback** for Carl, Jingjie, Glen — all their loaded `gameStats` rows have `minutes_played: 0` in DB today (pts may be present but minutes zero). Per plan, fallback used. Human may override MPG in builder constants if desired before import.
- **Executor (2026-06-05):** SAFSA-I.3–I.4 done. DB shows 4 games in NBL Div 2 2023 (KTS 65–61, Police 69–53, Tungsan 63–48, MOB 103–64). `backfill:tournament-rosters` skipped.
- **Blocked on human:** SAFSA-I.5 — open NBL Div 2 2023 in app; confirm 4 games, box scores, SAFSA player stats.

---
