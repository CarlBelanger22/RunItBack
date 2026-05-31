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

## Project Status Board

- [x] B4 Game 3 (NUS vs NTU, 2025-09-26) — JSON created, stats-only import complete, player profiles verified unchanged
- [ ] B4.5 User QA — confirm score NUS 39 / NTU 70, box score starter/bench order on game page
- [x] B5 Game 4 (SUSS vs NTU, 2025-09-29) — JSON created, stats-only import complete, player profiles verified unchanged
- [ ] B5.5 User QA — confirm score NTU 86 / SUSS 41, starters, box score order
- [x] C1 Player Performance chart — sort x-axis by minutes desc (C1.1 done; awaiting C1.2 QA)
- [x] C5 Game page clickable team names — C5.1–C5.4 implemented; build passes; awaiting C5.5 user QA
- [x] B6 Game 5 finale (NUS vs NTU, 2025-10-03) — JSON created, stats-only import complete, player profiles verified unchanged
- [ ] B6.4 User QA — confirm score NUS 45 / NTU 80, starters, box score order
- [x] N1 Smart back navigation — N1.1–N1.4 implemented; awaiting N1.5 user QA
- [x] Player position display task - Step 2 apply helper to both player page render sites
- [x] Player position display task - Step 3 manual smoke test checklist documented/executed (build + targeted UI checks)

---

## Current Status / Progress Tracking

- **N1 Smart back navigation (2026-05-29):** N1.1–N1.4 complete. Added `src/routing/navigation.ts` (`navigateWithReturnTo`, `navigateBack`). Detail routes (tournament/team/player/game summary) use `navigateBack`; forward navigations pass `state.from` with full path+tab. Dashboard search + shared `navigateToTeam`/`navigateToTournament` updated. Build passes. **Awaiting N1.5 user QA.**
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

## Executor's Feedback or Assistance Requests

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
