/**
 * Export all Postgres league tables via Supabase API → raw-tables.json.
 * Use when pg_dump is unavailable; restore with npm run restore:supabase-raw.
 *
 * Usage:
 *   npm run backup:supabase-raw
 *   npm run backup:supabase-raw -- --out backups/milestone-.../raw-tables.json
 */

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';
import { requireSupabaseCliClient } from './lib/supabaseCli';

const DEFAULT_LEAGUE_ID = 'league-default';

const PAGE_SIZE = 1000;

async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  applyFilter?: (query: ReturnType<SupabaseClient['from']>) => ReturnType<SupabaseClient['from']>
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select('*');
    if (applyFilter) {
      query = applyFilter(query);
    }
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${table} fetch: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function parseArgs(): { out: string; leagueId: string; slug: string } {
  const args = process.argv.slice(2);
  let out = '';
  let leagueId = DEFAULT_LEAGUE_ID;
  let slug = DEFAULT_MILESTONE_SLUG;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      out = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--league-id' && args[i + 1]) {
      leagueId = args[++i];
    } else if (args[i] === '--slug' && args[i + 1]) {
      slug = args[++i];
    }
  }

  if (!out) {
    out = resolve(ensureMilestoneDir(process.cwd(), slug), 'raw-tables.json');
  }

  return { out, leagueId, slug };
}

function gitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { out, leagueId } = parseArgs();
  const supabase = requireSupabaseCliClient();

  const leagues = await fetchAllRows(supabase, 'leagues', (q) =>
    q.eq('id', leagueId)
  );
  const teams = await fetchAllRows(supabase, 'teams', (q) => q.eq('league_id', leagueId));
  const teamIds = teams.map((row) => String(row.id));
  const players = await fetchAllRows(supabase, 'players', (q) => q.eq('league_id', leagueId));
  const tournaments = await fetchAllRows(supabase, 'tournaments', (q) =>
    q.eq('league_id', leagueId)
  );
  const tournamentIds = tournaments.map((row) => String(row.id));

  const teamPlayers =
    teamIds.length > 0
      ? await fetchAllRows(supabase, 'team_players', (q) => q.in('team_id', teamIds))
      : [];

  const allJunction = await fetchAllRows(supabase, 'tournament_teams');
  const tournamentTeams = allJunction.filter((row) =>
    tournamentIds.includes(String(row.tournament_id))
  );

  const allRosters = await fetchAllRows(supabase, 'tournament_rosters');
  const tournamentRosters = allRosters.filter((row) =>
    tournamentIds.includes(String(row.tournament_id))
  );

  const games = await fetchAllRows(supabase, 'games', (q) => q.eq('league_id', leagueId));

  const prefsRows = await fetchAllRows(supabase, 'app_preferences', (q) =>
    q.eq('league_id', leagueId)
  );

  const allMembers = await fetchAllRows(supabase, 'league_members');
  const leagueMembers = allMembers.filter((row) => String(row.league_id) === leagueId);

  const payload = {
    backupVersion: 1,
    kind: 'supabase-raw-tables',
    exportedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    leagueId,
    tables: {
      leagues,
      teams,
      players,
      team_players: teamPlayers,
      tournaments,
      tournament_teams: tournamentTeams,
      tournament_rosters: tournamentRosters,
      games,
      app_preferences: prefsRows,
      league_members: leagueMembers,
    },
  };

  writeFileSync(out, JSON.stringify(payload), 'utf8');

  console.log('RunItBack — raw table backup\n');
  console.log(`  file: ${out}`);
  for (const [table, rows] of Object.entries(payload.tables)) {
    console.log(`  ${table}: ${(rows as unknown[]).length}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
