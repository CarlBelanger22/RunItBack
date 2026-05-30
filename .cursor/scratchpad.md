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

### **P1 — Team page: Player Stats table + tournament filter (Designer, 2026-05-30)**

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
- [ ] **P1 Team Stats player table + tournament filter** (T1–T4 done; T5 user QA).
- [ ] Stats Entry live entry + finalize (Steps 2+) — **paused** (user decision 2026-05-30).
- [ ] Save/sync status indicator in UI.
- [ ] Phase C auth + RLS hardening (later).

---

## Project Status Board

- [x] Player position display task - Step 1 helper added in `src/components/PlayerPage.tsx`
- [x] Player position display task - Step 2 apply helper to both player page render sites
- [x] Player position display task - Step 3 manual smoke test checklist documented/executed (build + targeted UI checks)

---

## Current Status / Progress Tracking

- **P0 Latest Games (2026-05-30):** **Complete** — G1–G5 signed off.
- **Dashboard D + Sunig B2 + team delete QA (2026-05-30):** User confirmed all optional QA complete.
- **Stats Entry Step 2+:** Paused by user (2026-05-30).
- **P1 (2026-05-30):** T1–T4 implemented. Team Stats tab: tournament dropdown, filtered team summary, full player stats table. **TeamPage crash fixed** (null-safe `games`, `gameStats`, `teamStats`). `npm run build` passes. **Awaiting T5 user QA.**
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

## Executor's Feedback or Assistance Requests

- **Release (2026-05-30):** All feature QA signed off. **Only remaining housekeeping:** git commit + push of local changes (dashboard, scores, roster, team delete, PlayerPage opponent names). User to request when ready.
- **Stats Entry Step 2+:** Paused — do not start until user unpause.
- **P1 Team Player Stats (2026-05-30):** T1–T4 shipped. **Fixed TeamPage crash** (`Cannot read properties of undefined (reading 'filter')`) — guarded `games`, `gameStats`, and `teamStats` in TeamPage + `playerSeasonStats.ts`. Please hard-refresh and QA NTU Team Stats: Sunig filter, player table matches tournament tab, sort works.
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
- Navigation bug fix completed:
  - Team detail Back now routes directly to `paths.teams` (single click).
  - Player detail Back now routes directly to `teamPath(team)` (single click).
  - Removed dependency on browser history depth for these two Back buttons.
  - Verification: `npm run build` passes and no lints on routing file.
