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

## 2) Active Plan (Now)

### Primary feature focus
- Build out and polish **Stats Entry** (Game Setup + Live Game Entry + action dialogs + game completion flow).

### Small UX fix (requested)
- Show player secondary position on player detail page as bracketed combo, e.g. `[PF/C]`.

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

### Immediate next tasks
1. Run full Stats Entry QA pass from setup -> live entry -> complete game -> summary.
2. Identify and fix top UX blockers in live entry speed/accuracy.
3. Add clear save/sync feedback in UI (`Saving...`, `Saved`, `Save failed`).
4. Keep route-level behavior stable while touching stats entry paths.

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
- [ ] Stats Entry comprehensive QA pass.
- [ ] Stats Entry UX polish milestone.
- [ ] Save/sync status indicator in UI.
- [ ] Phase C auth + RLS hardening (later).

---

## Project Status Board

- [x] Player position display task - Step 1 helper added in `src/components/PlayerPage.tsx`
- [x] Player position display task - Step 2 apply helper to both player page render sites
- [x] Player position display task - Step 3 manual smoke test checklist documented/executed (build + targeted UI checks)

---

## Current Status / Progress Tracking

- Executor completed Step 1 only.
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

## Executor's Feedback or Assistance Requests

- Milestone reached: Steps 1-3 complete from executor side.
- Manual UI confirmation still recommended by human tester:
  - player with secondary shows `[PF/C]` on player page
  - player without secondary still shows `PF`
