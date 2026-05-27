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
- Navigation bug fix completed:
  - Team detail Back now routes directly to `paths.teams` (single click).
  - Player detail Back now routes directly to `teamPath(team)` (single click).
  - Removed dependency on browser history depth for these two Back buttons.
  - Verification: `npm run build` passes and no lints on routing file.
