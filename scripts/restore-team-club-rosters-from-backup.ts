/**
 * Restore club rosters (team_players + player profiles) for specific teams from a league JSON backup.
 * Does NOT touch games, tournaments, or other teams.
 *
 * Usage:
 *   npm run restore:team-club-rosters -- --dry-run
 *   npm run restore:team-club-rosters -- --apply
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Player, Team } from '../src/App';
import type { PlayerStorageSchema } from '../src/api/supabaseData';
import { dedupeTeamPlayers } from '../src/utils/rosterPlayers';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';

const TARGET_TEAM_IDS = ['team-1780252086140', 'team-sunig-ntu'] as const;
const DEFAULT_LEAGUE_ID = 'league-default';

interface LeagueBackupPayload {
  leagueId?: string;
  teams: Team[];
}

function parseArgs(): {
  file: string;
  dryRun: boolean;
  teamIds: string[];
} {
  const args = process.argv.slice(2);
  let file = resolve(
    ensureMilestoneDir(process.cwd(), DEFAULT_MILESTONE_SLUG),
    'runitback-league.json'
  );
  let dryRun = true;
  const teamIds: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--apply') {
      dryRun = false;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--team-id' && args[i + 1]) {
      teamIds.push(args[++i]);
    }
  }

  if (!args.includes('--dry-run') && !args.includes('--apply')) {
    console.error('Pass --dry-run or --apply');
    process.exit(1);
  }

  return {
    file,
    dryRun,
    teamIds: teamIds.length > 0 ? teamIds : [...TARGET_TEAM_IDS],
  };
}

function playerProfileRow(
  player: Player,
  leagueId: string,
  schema: PlayerStorageSchema
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: player.id,
    league_id: leagueId,
    name: player.name,
    picture: player.picture ?? null,
    height: player.height ?? '',
    weight: player.weight ?? '',
    age: player.age ?? 0,
    date_of_birth: player.dateOfBirth ?? null,
  };
  if (schema === 'global_position') {
    base.position = player.position || 'PG';
    base.secondary_position = player.secondaryPosition ?? null;
  }
  return base;
}

function teamPlayerRow(
  player: Player,
  teamId: string,
  schema: PlayerStorageSchema
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    team_id: teamId,
    player_id: player.id,
    number: player.number,
  };
  if (schema === 'team_players') {
    row.position = player.position || 'PG';
    row.secondary_position = player.secondaryPosition ?? null;
  }
  return row;
}

async function countTeamPlayers(
  client: SupabaseClient,
  teamId: string
): Promise<number> {
  const { count, error } = await client
    .from('team_players')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);
  if (error) throw new Error(`count team_players: ${error.message}`);
  return count ?? 0;
}

async function upsertChunk(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client
      .from(table)
      .upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`${table} upsert: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const client = createClient(url, key);
  const { detectPlayerStorageSchema } = await import('../src/api/supabaseData');

  const { file, dryRun, teamIds } = parseArgs();
  if (!existsSync(file)) {
    console.error(`Backup file not found: ${file}`);
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(file, 'utf8')) as LeagueBackupPayload;
  const leagueId = payload.leagueId ?? DEFAULT_LEAGUE_ID;
  const schema = await detectPlayerStorageSchema();

  console.log(
    `RunItBack — restore club rosters (${dryRun ? 'dry-run' : 'APPLY'})\n`
  );
  console.log(`  backup: ${file}`);
  console.log(`  schema: ${schema}`);
  console.log(`  teams: ${teamIds.join(', ')}\n`);

  const backupTeams = teamIds.map((id) => {
    const team = payload.teams.find((t) => t.id === id);
    if (!team) {
      throw new Error(`Team ${id} not found in backup`);
    }
    return {
      ...team,
      players: dedupeTeamPlayers(team.players ?? []),
    };
  });

  for (const team of backupTeams) {
    const current = await countTeamPlayers(client, team.id);
    console.log(
      `── ${team.name} (${team.id})\n   current team_players: ${current}\n   backup roster:      ${team.players.length}`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no writes. Re-run with --apply to restore.');
    return;
  }

  console.log('\nApplying restore…');

  for (const team of backupTeams) {
    const { error: deleteError } = await client
      .from('team_players')
      .delete()
      .eq('team_id', team.id);
    if (deleteError) {
      throw new Error(`delete team_players ${team.id}: ${deleteError.message}`);
    }

    const playerRows = team.players.map((p) =>
      playerProfileRow(p, leagueId, schema)
    );
    const linkRows = team.players.map((p) => teamPlayerRow(p, team.id, schema));

    if (schema === 'legacy') {
      console.warn('Legacy schema not supported by this script.');
      process.exit(1);
    }

    await upsertChunk(client, 'players', playerRows, 'id');
    await upsertChunk(client, 'team_players', linkRows, 'team_id,player_id');

    const after = await countTeamPlayers(client, team.id);
    console.log(`✓ ${team.name}: restored ${after} team_players links`);
  }

  console.log('\nDone. Hard-refresh RunItBack and run diagnose:roster-counts to verify.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
