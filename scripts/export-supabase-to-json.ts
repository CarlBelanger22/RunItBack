/**
 * Export league app data from Supabase → JSON (LoadedAppData shape).
 *
 * Usage:
 *   npm run export:supabase
 *   npm run export:supabase -- --out backups/milestone-2026-06-02-pre-next-phase/runitback-league.json
 */

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';

const DEFAULT_LEAGUE_ID = 'league-default';

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
    out = resolve(ensureMilestoneDir(process.cwd(), slug), 'runitback-league.json');
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
  loadEnvLocalIntoProcess();
  const { out, leagueId } = parseArgs();

  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase(leagueId);

  const payload = {
    backupVersion: 1,
    kind: 'runitback-league',
    exportedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    leagueId,
    teams: data.teams,
    tournaments: data.tournaments,
    games: data.games,
    darkMode: data.darkMode,
    orphanPlayers: data.orphanPlayers,
    tournamentRosters: data.tournamentRosters,
  };

  writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');

  console.log('RunItBack — export league JSON\n');
  console.log(`  file: ${out}`);
  console.log(`  teams: ${data.teams.length}`);
  console.log(`  tournaments: ${data.tournaments.length}`);
  console.log(`  games: ${data.games.length}`);
  console.log(`  tournamentRosters: ${data.tournamentRosters.length}`);
  console.log(`  orphanPlayers: ${data.orphanPlayers.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
