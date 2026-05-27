# RunItBack: localStorage → Supabase migration

## Prerequisites

1. Supabase tables created (run `supabase/migrations/001_initial_schema.sql` in SQL Editor).
2. `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. JSON backup exported from the browser (`runitback-data` key).

### Export backup (browser console)

```javascript
copy(localStorage.getItem('runitback-data') || '{}')
```

Save to `backups/runitback-data-YYYY-MM-DD.json`.

## Import

```bash
# Preview counts (no writes)
npm run import:local -- --file backups/runitback-data-2026-05-26.json --dry-run

# Import for real
npm run import:local -- --file backups/runitback-data-2026-05-26.json
```

## What gets imported

| Source | Supabase |
|--------|----------|
| `teams[]` + nested `players` | `teams`, `players` |
| `tournaments[]` | `tournaments`, `tournament_teams` |
| `games[]` (full nested stats) | `games` (`game_stats`, `team_stats`, `shots`, `events`, etc.) |
| `preferences.darkMode` | `app_preferences` |

Player/team season stats are computed from `games.game_stats` in the app.

## Verify in Supabase

In **Table Editor**, check row counts match your backup. Open a `games` row and confirm `game_stats` and `shots` JSON are populated.

## After import (Phase B — app wired to Supabase)

When `.env.local` has valid Supabase credentials, the app:

1. **Loads** teams, tournaments, and games from Supabase on startup.
2. **Saves** changes to Supabase (debounced ~500ms) instead of localStorage.
3. Falls back to localStorage if the cloud load fails.
4. Shows a loading screen briefly while fetching.

localStorage is no longer the primary store when Supabase is configured. You can keep your JSON backup file as an archive.

Re-running `npm run import:local` is safe (upsert by `id`) if you need to re-seed from a backup.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing env vars | Check `.env.local` |
| FK errors on games | Ensure teams exist; re-run import (script upserts teams from games too) |
| RLS denied | Dev policies in migration SQL must be applied |
