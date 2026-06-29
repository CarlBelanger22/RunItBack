# RunItBack

RunItBack is a full-stack web application for running basketball leagues and tournaments. It covers the complete lifecycle: create tournaments and teams, enroll rosters, set up games, enter live in-game stats from a desktop court UI, and review box scores, shot charts, and season aggregates on player and team pages.

The UI originated from a [Figma design](https://www.figma.com/design/HfGhAxS0n7PzOo2jSbKF7t/Basketball-Stats-Tracking-App) and is implemented as a **React + Vite** front end with **Supabase** (Postgres + Storage) for cloud persistence.

---

## Table of contents

- [Features at a glance](#features-at-a-glance)
- [Navigation & routes](#navigation--routes)
- [Dashboard & search](#dashboard--search)
- [Tournaments](#tournaments)
- [Teams & rosters](#teams--rosters)
- [Players](#players)
- [Games: setup → live → complete](#games-setup--live--complete)
- [Stats tracked](#stats-tracked)
- [Live stats entry](#live-stats-entry)
- [5v5 vs 3×3 formats](#5v5-vs-3×3-formats)
- [Post-game views](#post-game-views)
- [Data model & Supabase](#data-model--supabase)
- [Scripts & tooling](#scripts--tooling)
- [Development](#development)
- [Project layout](#project-layout)
- [Branches](#branches)

---

## Features at a glance

| Area | Capabilities |
|------|----------------|
| **League hub** | Dashboard with tournament/team/game counts, global search, dark mode |
| **Tournaments** | Create/edit, team enrollment, standings, per-tournament rosters & jerseys, 5v5 or 3×3 format |
| **Teams** | Club teams with icons (Supabase Storage), coaches, roster management, season stats scoped by format/tournament |
| **Players** | Global profiles, multi-team membership, jersey numbers per club and per tournament, game log, advanced metrics |
| **Games** | Full setup (starters, clock, both-team or single-team tracking), live entry, completion, edit/delete |
| **Stats** | Traditional + advanced box scores, team stats, shot charts, play-by-play event log, lineup stints |
| **Import / backup** | Box score JSON import, milestone backups, Supabase export/restore, tournament-specific build scripts |
| **Live entry** | FIBA horizontal court, tap-to-shoot, fouls/TO/subs, real-time box score & PBP (desktop, ≥1280px) |

---

## Navigation & routes

The app has two top-level modes via the header toggle: **Main** (dashboard & browsing) and **Stats Entry** (game setup).

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | League overview, search, quick links |
| `/tournaments` | Tournament manager | Create and list tournaments |
| `/tournaments/:slug` | Tournament page | Tabs: Home, Teams, Standings, Players, Games |
| `/teams` | Team manager | Create and list club teams |
| `/teams/:slug` | Team page | Tabs: Overview, Roster, Stats, Games |
| `/players/:slug` | Player page | Tabs: Overview, Game Log, Stats, Advanced |
| `/games/:id` | Game summary | Final/post-game view with leaders, team stats, box score |
| `/stats-entry` | Game setup | Start a new game (tournament, teams, starters) |
| `/live/:id` | Live stats entry | In-game desktop UI for active games |

**URL query parameters**

- `?tab=` — sub-tab on tournament, team, or player pages (e.g. `?tab=stats`, `?tab=gamelog`)
- `?format=` — stat scope filter: `5v5`, `3x3`, or `combined` (team/player stats pages)
- `?tournaments=` — comma-separated tournament IDs to filter aggregated stats

Slug URLs use readable names plus IDs (e.g. `/teams/celtics-team-abc123`).

---

## Dashboard & search

**Dashboard** (`/`) shows:

- Total tournaments (with links to recent ones)
- Real team count (ghost/score-only opponent teams listed separately)
- Recent games preview
- Shortcuts to managers and **Start new game**

**Search** (dashboard only) matches across:

- Tournament names
- Team names and abbreviations
- Player names, numbers, and team affiliations (including orphan/league-only players)
- Game opponents, dates, and abbreviations

Results are grouped by category (max 5 per group) and deep-link to the relevant page.

---

## Tournaments

### Creating a tournament

- Name, year, month, optional icon and description
- **Game format:** `5v5` (default) or `3x3` — drives clock defaults and stat display rules
- Teams are enrolled by ID; games are linked as they are created

### Tournament page tabs

| Tab | Content |
|-----|---------|
| **Home** | Summary, format badge, quick stats |
| **Teams** | Enrolled teams, add/remove enrollment |
| **Standings** | W–L, points for/against (derived from completed games) |
| **Players** | All players who appear on enrolled team rosters or in tournament games |
| **Games** | Games linked to this tournament |

### Tournament rosters (`tournament_rosters`)

Separate from club rosters: per-tournament player lists with **tournament-specific jersey numbers**. Populated from enrollment and reconciled when games complete. Migration `005_tournament_rosters.sql`.

### Standings

Each team tracks: wins, losses, points for, points against, games played. Updated when games are marked complete.

---

## Teams & rosters

### Club teams

- Name, **abbreviation** (2–5 letters, used in scoreboards and search)
- Optional **icon** (uploaded to Supabase Storage bucket `team-assets`, migration 006)
- Description, player list, optional `currentTournamentId`
- **Coach** metadata and coach stat row support on imported box scores

### Roster model (migration 002+)

- **Global players** — one profile per person (`players` table)
- **Team membership** — `team_players` junction (player on multiple club teams)
- **Positions** — global primary + optional secondary (`003_player_global_position.sql`)
- **Jersey numbers** — per team on `team_players`; duplicate numbers allowed per team after migration 004

### Team page tabs

| Tab | Content |
|-----|---------|
| **Overview** | Team info, icon, enrolled tournaments |
| **Roster** | Sortable player list, add/remove players, jersey edits |
| **Stats** | Season averages with **format** and **tournament** scope filters; team shot chart |
| **Games** | All games involving this team |

### Ghost teams

When a game is started with **Track both teams** off, the away side is a minimal “ghost” team (name only) used for score display — no individual away stats or live entry.

---

## Players

### Global profile fields

| Field | Notes |
|-------|--------|
| Name | Display name |
| Number | Default/club jersey (also overridable per team and per tournament) |
| Position / secondary position | e.g. PG, SG, SF, PF, C |
| Height | Stored in cm; displayed as ft/in + cm |
| Weight | Stored in kg |
| Age / date of birth | Profile and eligibility display |
| Picture | Optional avatar URL |

### Multi-team players

A player can belong to several club teams. Tournament participation is tracked separately via tournament rosters and game appearances.

### Orphan players

League-level player profiles not currently on any team roster — searchable and manageable from the team manager.

### Player page tabs

| Tab | Content |
|-----|---------|
| **Overview** | Profile card, team badges, tournaments played, jersey grid (club + tournament scopes), shot chart when data exists |
| **Game Log** | Row per game with traditional stat line and link to game summary |
| **Stats** | Aggregated traditional stats with scope bar (5v5 / 3×3 / combined + tournament multi-select) |
| **Advanced** | EFF, Game Score, shooting splits, per-game rates |

### Scope filtering

Team and player stat pages share a **StatScopeFilterBar**:

- **Format scope:** 5v5 only, 3×3 only, or combined (shows warning when mixing formats)
- **Tournament scope:** all tournaments or a selected subset

Filters persist in the URL (`?format=&tournaments=`).

### Player deletion

Blocked when deletion would break stat integrity; user sees a specific reason (stats in games, roster dependencies, etc.).

---

## Games: setup → live → complete

### 1. Game setup (`/stats-entry`)

1. Select **tournament** (required) — sets default clock from format
2. Set **date** and optional **start time** (HH:MM)
3. Configure **home team** — pick existing club team or create new (minimum **5 players** for tracked sides)
4. **Track both teams** toggle:
   - **On (default):** full away team setup identical to home
   - **Off:** enter opponent name only → ghost away team; only home stats tracked; **live entry disabled**
5. **Starter order** — drag-and-drop; top 5 become `homeStarters` / `awayStarters`
6. Add players during setup; roster changes are tracked for cleanup if the game is deleted before completion

**Constraint:** only **one active game** at a time. Starting a second game shows a banner; complete or delete the current game first.

### 2. Live entry (`/live/:gameId`)

See [Live stats entry](#live-stats-entry). Requires desktop width (≥1280px) and `trackBothTeams: true`.

Header shows a **Live: HOME vs AWAY** pill linking back to the live route.

### 3. Complete game

- Triggered from live UI (**Complete game**) or equivalent flow
- Final score computed from player points (or set explicitly)
- `isActive: false`, `isCompleted: true`
- Tournament rosters reconciled; game ID added to tournament’s game list

### 4. Game summary (`/games/:id`)

- Score header, **game leaders** (PTS, AST, REB, EFF)
- **Team Stats** tab — quarter scoring, eFG%, TS%, AST/TO, shot chart, advanced team lines (POT, paint, 2nd chance, fastbreak when recorded)
- **Box Score** tab — traditional + advanced per player; home/away tabs; starter/bench dividers
- Edit game metadata (date, time, tournament, final score) via game form

### Delete game

Removes the game and rolls back setup-created teams/players where applicable.

---

## Stats tracked

### Per-player box score (`GameStats`)

| Category | Fields |
|----------|--------|
| **Scoring** | PTS, FGM, FGA, 3PM, 3PA, FTM, FTA |
| **Rebounds** | ORB, DRB (REB = ORB + DRB) |
| **Playmaking / defense** | AST, STL, BLK, TO |
| **Fouls** | PF (personal), technical fouls, unsportsmanlike fouls, fouls drawn |
| **Other** | Blocks received, plus/minus, minutes played |

### Derived & advanced (player)

| Metric | Formula / notes |
|--------|-----------------|
| **FG%, 3P%, FT%, 2P%** | Standard; division-by-zero safe |
| **EFF** | PTS + REB + AST + STL + BLK − (FGA−FGM) − (FTA−FTM) − TO |
| **Game Score (GmSc)** | Hollinger-style composite |
| **Season averages** | Summed totals ÷ games played |

### Per-team box score (`TeamStats`)

| Category | Fields |
|----------|--------|
| **Scoring by period** | Q1–Q4, OT, total points |
| **Shooting** | FGM/A, 3PM/A, 2PM/A (derived), FTM/A |
| **Rebounds** | ORB, DRB, team rebounds, total |
| **Other** | AST, STL, BLK, TO, PF |
| **Advanced (when recorded)** | Points off turnovers, points in paint, second chance points, fastbreak points, bench points, biggest lead, biggest scoring run |
| **Team/Coach row (FIBA)** | Team ORB, DRB, turnovers, fouls on non-player line |

### Shot chart data (`Shot`)

Each field goal attempt stores:

- Court coordinates (x, y as percentages mapped to FIBA geometry)
- Made/missed, 2 vs 3, in-paint flag, fastbreak flag
- Period and game clock
- Optional assist, block, and-one foul flag

### Event log (`GameEvent`)

Play-by-play events with types:

| Type | Description |
|------|-------------|
| `shot_attempt` | Field goal with make/miss, 2/3, block, assist |
| `free_throw` | Make/miss |
| `rebound` | Offensive or defensive |
| `turnover` | Optional steal credited |
| `foul` | Category, committer, recipient, free throw count |
| `substitution` | Player in/out |
| `violation` | Clock violations, etc. |
| `technical_foul` | Technical foul |
| `timeout` | Timeout |

Each event stores period, game time, team, player(s), score after event, and type-specific `details`.

### Lineup stints (`LineupStint`)

Five-player units with start/end period and clock, used for minutes and plus/minus tracking.

---

## Live stats entry

### Requirements

- **Viewport ≥ 1280px** (`DesktopOnlyGuard`)
- **`trackBothTeams: true`** on the game
- Active game (`isActive: true`, not completed)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Scoreboard header — score, clock, fouls, Back, Undo, End Q  │
├──────────┬──────────────────────────────┬───────────────────┤
│ HOME     │ Context bar + horizontal     │ AWAY              │
│ on-court │ FIBA court (tap to shoot)    │ on-court          │
│ players  │ FOUL / TO / SUB action bar   │ players           │
├──────────┴──────────────────────────────┴───────────────────┤
│ Live play-by-play (horizontal card strip)                   │
├─────────────────────────────────────────────────────────────┤
│ Dual box score tables (home + away, sortable columns)       │
└─────────────────────────────────────────────────────────────┘
```

### Interaction flow

1. **Select a player** from home or away on-court column
2. **Tap the court** — zone detection (paint / 2pt / 3pt) sets shot value
3. **Shot overlay** — Make, Miss, or Block
4. On make — optional **assist** picker; fastbreak credit when applicable
5. On miss — **rebound** flow (type + player)
6. On block — **blocker** picker
7. **Action bar** — FOUL (full foul sequence + free throws + and-1), TO (optional steal), SUB (in/out)
8. **Undo** — revert last event; **End Q** — advance period and reset clock
9. **Double-click** PBP card — edit event via dialog (replays stat engine)

### State machine phases

| Phase | Steps |
|-------|--------|
| `idle` | Ready |
| `shot` | await outcome → assist / fastbreak / blocker |
| `rebound` | type → player |
| `turnover` | type → optional steal → stealer |
| `foul` | category → committer → recipient → FT count → FT attempts |
| `substitution` | out → in → confirm |
| `and1` | Foul after made basket |
| `free_throw` | Per-attempt sequence |

Logic lives in `src/liveEntry/liveEntryStateMachine.ts` and commits through `GameLogic` + `useLiveGameSession`.

### Court geometry

- FIBA half-court model (15 m × 14 m) in `src/lib/fibaCourtGeometry.ts`
- Live UI uses a **horizontal full-court** SVG (home attacks left, away attacks right)
- Click mapping converts to half-court coordinates for storage compatibility
- Shot markers: green (make), red (miss), orange (live session)

### Possession engine

Tracks offense team, second-chance points, and points-off-turnover attribution across event replay (`src/liveEntry/possessionEngine.ts`).

---

## 5v5 vs 3×3 formats

| | **5v5** (default) | **3×3** (FIBA) |
|---|-------------------|----------------|
| **Regulation** | 4 × 10 min | 1 × 10 min |
| **Overtime** | 5 min | 5 min |
| **Roster** | 5 starters, 5 on court | Same setup UI |
| **Scoring display** | Standard 2 / 3 / 1 | 1 pt inside arc, 2 pt from beyond arc, 1 pt FT |
| **3×3 points formula** | — | `PTS = FGM + 3PM + FTM` (3PM ⊂ FGM) |
| **Live court zones** | 2 and 3 point zones | Same geometry; display uses 3×3 formula on summaries |
| **Tournament flag** | Default | `tournament.gameFormat: '3x3'` or hard-coded tournament ID set |

Stat pages can filter **5v5 only**, **3×3 only**, or **combined** (with a warning when mixing).

Clock defaults: `src/utils/gameClock.ts` · 3×3 scoring: `src/utils/basketball3x3Scoring.ts`

---

## Post-game views

### Game summary

- Final score, tournament context, edit/delete
- **Game leaders** — top PTS, AST, REB, EFF per side
- **Team stats** — quarter breakdown, four factors style metrics, shot chart overlay
- **Box score** — Traditional columns (PTS, FGM/A, 3PM/A, FTM/A, REB, AST, STL, BLK, TO, PF, +/-, MIN) and advanced view

### Box score ordering

Starters listed first (from `homeStarters` / `awayStarters`), then bench, with a visual divider — `orderBoxScorePlayers`.

### Team/Coach row

Imported and live games can include a FIBA-style team/coach stat line for team rebounds, turnovers, and fouls not assigned to a player.

---

## Data model & Supabase

### Environment

```bash
cp .env.example .env.local
# Required:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_PUBLISHABLE_KEY
# Optional (migration scripts):
#   SUPABASE_DB_URL
```

Never commit `.env.local`.

### Schema migrations (`supabase/migrations/`)

| # | Purpose |
|---|---------|
| **001** | Core schema: leagues, teams, players, tournaments, games (JSONB stats/events/shots), preferences, RLS |
| **002** | Global players + `team_players`; roster off `players` row |
| **003** | Global `position` on players |
| **004** | Allow duplicate jersey numbers per team |
| **005** | `tournament_rosters` table |
| **006** | `team-assets` storage bucket + policies |

Apply via Supabase SQL editor or `npm run db:migrate:002` … `006`.

### Game document (JSONB in `games`)

Each game embeds:

- `game_stats[]` — per-player lines
- `team_stats` — home/away team aggregates
- `shots[]` — shot chart coordinates
- `events[]` — full play-by-play
- `lineup_stints[]` — on-court intervals
- Flags: `is_active`, `is_completed`, `track_both_teams`, starters, clock settings

### Persistence behavior

- **Cloud-first** with Supabase load/save (`src/api/supabaseData.ts`)
- **localStorage snapshot** for offline/cached fallback (`src/lib/appDataSnapshot.ts`)
- **Debounced cloud save queue** — sync status strip in header
- **Dark mode** stored in `app_preferences` and local snapshot

### Schema detection

App probes DB shape (`legacy` → `team_players` → `global_position`) and shows migration banners when upgrades are needed.

---

## Scripts & tooling

### Daily development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `build/` |

### Live entry & game logic tests

| Command | Purpose |
|---------|---------|
| `npm run test:live-entry-state-machine` | Live entry reducer |
| `npm run test:fiba-court-geometry` | Court click/zones |
| `npm run test:possession-engine` | Offense/possession replay |
| `npm run test:game-clock` | Period/OT clock |
| `npm run test:game-format` | 5v5 vs 3×3 helpers |
| `npm run test:basketball-3x3-scoring` | 3×3 point formula |

### Backup & restore

| Command | Purpose |
|---------|---------|
| `npm run backup:milestone` | Full checkpoint: JSON, optional pg_dump, team icons, MANIFEST |
| `npm run export:supabase` | Export tables to JSON |
| `npm run backup:supabase-raw` | Raw table backup |
| `npm run backup:team-assets` | Storage bucket backup |
| `npm run restore:supabase` | Restore from JSON export |
| `npm run restore:supabase-raw` | Restore raw backup |

Local backup output goes to `backups/` (gitignored).

### Import pipelines

| Command | Purpose |
|---------|---------|
| `npm run import:boxscore` | Structured JSON → Supabase (dry-run, stats-only options) |
| `npm run import:local` | Legacy localStorage → Supabase |
| `npm run build:adiv-2019` | A Division 2019 import builder |
| `npm run build:asg-2019` | ASG 2019 import builder |
| `npm run build:ausf-3x3` | AUSF 3×3 import builder |
| `npm run build:kx-div2` | KX Div2 import builder |
| … | See `package.json` for full `build:*` tournament list |

Staging photos and HTML for imports live in `Importingboxscores/` (gitignored).

### Maintenance

| Command | Purpose |
|---------|---------|
| `npm run backfill:tournament-rosters` | Rebuild tournament roster rows |
| `npm run backfill:team-coach` | Team/coach stat rows |
| `npm run rebuild:club-rosters` | Repair club roster junctions |
| `npm run migrate:icons-to-storage` | Move team icons to Supabase Storage |
| `npm run cleanup:orphan-players` | Remove unused player profiles |

Run `npm run` for the complete script list.

---

## Development

### Prerequisites

- Node.js 20+
- npm
- Supabase project (for cloud sync)

### Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and publishable key
npm run dev
```

Open `http://localhost:5173` (or the URL Vite prints).

### UI stack

- React 18, React Router 7, Vite 6
- Tailwind CSS + Radix UI / shadcn-style components
- Recharts for team/player shot charts and team stat visuals
- @dnd-kit for sortable roster/starter lists in game setup

### Theming

- Light/dark toggle in header (Sun/Moon)
- Live entry uses app semantic tokens (`--background`, `--card`, `--live-home`, `--live-away`) with a fixed wood-tone court palette
- Google Fonts in live entry: Barlow, Barlow Condensed, JetBrains Mono

### Production notes

- Env vars are **baked in at build time** for Vite — set `VITE_*` in your host (e.g. Vercel) and redeploy after changes
- Without Supabase config, the app runs in browser-only mode with a warning banner

---

## Project layout

```
src/
  App.tsx                 Core types (Player, Team, Game, GameStats, …) and app shell
  components/
    Dashboard.tsx         League home
    TournamentManager.tsx / TournamentPage.tsx
    TeamManager.tsx / TeamPage.tsx
    PlayerPage.tsx
    GameSetup.tsx         Pre-game configuration
    GameSummary.tsx       Post-game view
    BoxScore.tsx / TeamStats.tsx / MetricsCalculator.tsx
    gameSetup/            Sortable starter lists
    live/                 Live entry workspace, court, header, PBP, box score
  liveEntry/
    liveEntryStateMachine.ts
    useLiveGameSession.ts
    possessionEngine.ts
    liveEntryActions.ts
  lib/
    fibaCourtGeometry.ts  Court math and zones
    figmaHorizontalCourtSvg.tsx
    supabase.ts
    appDataSnapshot.ts
    cloudSaveQueue.ts
  routing/                Paths, slugs, tab query helpers
  utils/
    GameLogic.ts          Stat commits, event replay, undo
    gameFormat.ts         5v5 vs 3×3 scope
    gameClock.ts
    basketball3x3Scoring.ts
    tournamentRosters.ts / rosterPlayers.ts
    playerSeasonStats.ts
scripts/                  Imports, backups, migrations, tests
supabase/migrations/      SQL schema
design-reference/         Figma export reference for live entry UI
```

---

## Branches

| Branch | Description |
|--------|-------------|
| `main` | Stable production line |
| `Statsentrybuilding` | Live stats entry UI, layout, theme, scoreboard, README (merge via PR when ready) |

Previous commits remain in history after merge — you can always check out an earlier SHA or branch to restore prior state.

---

## License

Private project. All rights reserved.
