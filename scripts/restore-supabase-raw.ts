/**
 * Full league restore from raw-tables.json (wipes league rows, then re-inserts).
 *
 * Usage:
 *   npm run restore:supabase-raw -- --file backups/milestone-.../raw-tables.json --dry-run
 *   npm run restore:supabase-raw -- --file backups/milestone-.../raw-tables.json --apply
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseCliClient } from './lib/supabaseCli';

interface RawBackupPayload {
  leagueId?: string;
  tables: {
    leagues: Record<string, unknown>[];
    teams: Record<string, unknown>[];
    players: Record<string, unknown>[];
    team_players: Record<string, unknown>[];
    tournaments: Record<string, unknown>[];
    tournament_teams: Record<string, unknown>[];
    tournament_rosters: Record<string, unknown>[];
    games: Record<string, unknown>[];
    app_preferences: Record<string, unknown>[];
    league_members: Record<string, unknown>[];
  };
}

function parseArgs(): { file: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let file = '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--apply') {
      dryRun = false;
    }
  }

  if (!file) {
    console.error(
      'Usage: npm run restore:supabase-raw -- --file backups/.../raw-tables.json [--dry-run|--apply]'
    );
    process.exit(1);
  }

  if (!args.includes('--dry-run') && !args.includes('--apply')) {
    console.error('Pass --dry-run or --apply');
    process.exit(1);
  }

  return { file, dryRun };
}

async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  dryRun: boolean
): Promise<void> {
  if (rows.length === 0) return;
  if (dryRun) {
    console.log(`  [dry-run] upsert ${rows.length} → ${table}`);
    return;
  }

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`${table} upsert: ${error.message}`);
    }
  }
  console.log(`  upserted ${rows.length} → ${table}`);
}

async function deleteLeagueData(
  supabase: SupabaseClient,
  leagueId: string,
  tournamentIds: string[],
  teamIds: string[],
  dryRun: boolean
): Promise<void> {
  const steps: Array<{ label: string; run: () => Promise<{ error: { message: string } | null }> }> =
    [
      {
        label: 'games',
        run: () => supabase.from('games').delete().eq('league_id', leagueId),
      },
      {
        label: 'tournament_rosters',
        run: () =>
          tournamentIds.length > 0
            ? supabase.from('tournament_rosters').delete().in('tournament_id', tournamentIds)
            : Promise.resolve({ error: null }),
      },
      {
        label: 'tournament_teams',
        run: () =>
          tournamentIds.length > 0
            ? supabase.from('tournament_teams').delete().in('tournament_id', tournamentIds)
            : Promise.resolve({ error: null }),
      },
      {
        label: 'team_players',
        run: () =>
          teamIds.length > 0
            ? supabase.from('team_players').delete().in('team_id', teamIds)
            : Promise.resolve({ error: null }),
      },
      {
        label: 'players',
        run: () => supabase.from('players').delete().eq('league_id', leagueId),
      },
      {
        label: 'tournaments',
        run: () => supabase.from('tournaments').delete().eq('league_id', leagueId),
      },
      {
        label: 'teams',
        run: () => supabase.from('teams').delete().eq('league_id', leagueId),
      },
      {
        label: 'app_preferences',
        run: () => supabase.from('app_preferences').delete().eq('league_id', leagueId),
      },
      {
        label: 'league_members',
        run: () => supabase.from('league_members').delete().eq('league_id', leagueId),
      },
    ];

  for (const step of steps) {
    if (dryRun) {
      console.log(`  [dry-run] delete ${step.label}`);
      continue;
    }
    const { error } = await step.run();
    if (error) {
      throw new Error(`delete ${step.label}: ${error.message}`);
    }
    console.log(`  deleted ${step.label}`);
  }
}

async function main(): Promise<void> {
  const { file, dryRun } = parseArgs();
  const payload = JSON.parse(readFileSync(file, 'utf8')) as RawBackupPayload;
  const leagueId = payload.leagueId ?? 'league-default';
  const supabase = requireSupabaseCliClient();

  console.log(`RunItBack — restore raw tables (${dryRun ? 'dry-run' : 'apply'})\n`);
  console.log(`  file: ${file}`);

  const tournamentIds = payload.tables.tournaments.map((row) => String(row.id));
  const teamIds = payload.tables.teams.map((row) => String(row.id));

  for (const [table, rows] of Object.entries(payload.tables)) {
    console.log(`  ${table}: ${rows.length}`);
  }

  console.log('\nWiping current league data…');
  await deleteLeagueData(supabase, leagueId, tournamentIds, teamIds, dryRun);

  console.log('\nInserting backup rows…');
  await upsertRows(supabase, 'leagues', payload.tables.leagues, 'id', dryRun);
  await upsertRows(supabase, 'teams', payload.tables.teams, 'id', dryRun);
  await upsertRows(supabase, 'players', payload.tables.players, 'id', dryRun);
  await upsertRows(
    supabase,
    'team_players',
    payload.tables.team_players,
    'team_id,player_id',
    dryRun
  );
  await upsertRows(supabase, 'tournaments', payload.tables.tournaments, 'id', dryRun);
  await upsertRows(
    supabase,
    'tournament_teams',
    payload.tables.tournament_teams,
    'tournament_id,team_id',
    dryRun
  );
  await upsertRows(
    supabase,
    'tournament_rosters',
    payload.tables.tournament_rosters,
    'tournament_id,team_id,player_id',
    dryRun
  );
  await upsertRows(supabase, 'games', payload.tables.games, 'id', dryRun);
  await upsertRows(
    supabase,
    'app_preferences',
    payload.tables.app_preferences,
    'league_id',
    dryRun
  );
  await upsertRows(supabase, 'league_members', payload.tables.league_members, 'id', dryRun);

  console.log(dryRun ? '\nDry run OK — no writes.' : '\nRestore complete.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
