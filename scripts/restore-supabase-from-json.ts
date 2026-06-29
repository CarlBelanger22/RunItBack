/**
 * Restore league JSON export via saveAppDataToSupabase.
 * Prefer restore:supabase-raw or pg_restore for full DB rollback.
 *
 * Usage:
 *   npm run restore:supabase -- --file backups/milestone-.../runitback-league.json --dry-run
 *   npm run restore:supabase -- --file backups/milestone-.../runitback-league.json --apply
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Game, Player, Team, Tournament } from '../src/App';
import type { TournamentRosterEntry } from '../src/utils/tournamentRosters';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

interface LeagueBackupPayload {
  backupVersion?: number;
  leagueId?: string;
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode?: boolean;
  orphanPlayers?: Player[];
  tournamentRosters?: TournamentRosterEntry[];
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
      'Usage: npm run restore:supabase -- --file backups/.../runitback-league.json [--dry-run|--apply]'
    );
    process.exit(1);
  }

  if (!args.includes('--dry-run') && !args.includes('--apply')) {
    console.error('Pass --dry-run or --apply');
    process.exit(1);
  }

  return { file, dryRun };
}

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const { file, dryRun } = parseArgs();
  const payload = JSON.parse(readFileSync(file, 'utf8')) as LeagueBackupPayload;
  const leagueId = payload.leagueId ?? 'league-default';

  console.log(`RunItBack — restore league JSON (${dryRun ? 'dry-run' : 'apply'})\n`);
  console.log(`  file: ${file}`);
  console.log(`  teams: ${payload.teams.length}`);
  console.log(`  tournaments: ${payload.tournaments.length}`);
  console.log(`  games: ${payload.games.length}`);
  console.log(`  tournamentRosters: ${payload.tournamentRosters?.length ?? 0}`);

  if (dryRun) {
    console.log('\nDry run OK — no writes.');
    return;
  }

  const { saveAppDataToSupabase } = await import('../src/api/supabaseData');
  await saveAppDataToSupabase(
    payload.teams,
    payload.tournaments,
    payload.games,
    payload.darkMode ?? false,
    leagueId,
    payload.tournamentRosters ?? []
  );

  console.log('\nRestore complete.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
