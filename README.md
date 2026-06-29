# RunItBack

RunItBack is a web app for running basketball leagues and tournaments: manage teams and rosters, schedule games, record box scores, and enter live in-game stats from a desktop court UI.

The UI started from a [Figma design](https://www.figma.com/design/HfGhAxS0n7PzOo2jSbKF7t/Basketball-Stats-Tracking-App) and is built as a React + Supabase application.

## Features

- **League dashboard** — search and browse tournaments, teams, players, and games
- **Tournament & team management** — rosters, enrollment, jerseys, coaches, 5v5 and 3x3 formats
- **Game setup** — starters, on-court assignments, sortable rosters
- **Live stats entry** — horizontal FIBA court, tap-to-log shots, fouls, turnovers, substitutions, play-by-play, and dual box-score tables (desktop)
- **Post-game views** — traditional and advanced box scores, shot charts, team and player pages
- **Cloud sync** — league data stored in Supabase with local backup/restore scripts

## Tech stack

- [React 18](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [Supabase](https://supabase.com/) (Postgres + Storage)
- [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) / shadcn-style components
- [Recharts](https://recharts.org/) for charts

## Getting started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (for cloud data)

### Install and run

```bash
npm install
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_DB_URL` | No | Postgres URI for migration scripts |

See `.env.example` for details. Never commit `.env.local`.

### Database migrations

SQL migrations live in `supabase/migrations/`. Apply them via the Supabase SQL editor or the helper scripts:

```bash
npm run db:migrate:002
npm run db:migrate:003
# … through 006 as needed
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build → `build/` |
| `npm run test:live-entry-state-machine` | Live entry state machine tests |
| `npm run test:fiba-court-geometry` | Court geometry tests |
| `npm run test:possession-engine` | Possession engine tests |
| `npm run backup:milestone` | Full milestone backup (JSON + assets) |
| `npm run export:supabase` | Export Supabase tables to JSON |

Run `npm run` for the full list of import, backfill, and test scripts.

## Project layout

```
src/
  components/       UI pages and shared components
  components/live/  Live game entry workspace
  liveEntry/        Live entry state machine and session hook
  lib/              Court geometry, SVG courts, Supabase helpers
  routing/          App routes
  utils/            Game logic, stats, roster helpers
scripts/            Imports, backups, migrations, tests
supabase/migrations SQL schema migrations
design-reference/   Figma export reference for live entry UI
```

## Live stats entry

Live entry is **desktop-only** and available from an active game at `/live/:gameId`.

Flow: select a player → tap the court to log a shot → choose make / miss / block → fouls, turnovers, and subs via the action bar. Play-by-play and box scores update in real time.

## Git branches

- `main` — stable app
- `Statsentrybuilding` — live stats entry UI and related work (merge when ready)

## License

Private project. All rights reserved.
