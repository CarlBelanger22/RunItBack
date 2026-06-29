/**
 * Read-only roster count comparison for club vs tournament vs backup.
 * Does NOT write to Supabase or mutate data.
 *
 * Usage: npm run diagnose:roster-counts
 *        npm run diagnose:roster-counts -- --team "Kai Xuan"
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';

const DEFAULT_LEAGUE_ID = 'league-default';

interface TeamRow {
  id: string;
  name: string;
  players?: { id: string; name: string }[];
}

interface BackupPayload {
  teams?: TeamRow[];
  tournamentRosters?: { tournamentId: string; teamId: string; playerId: string }[];
}

function parseArgs(): { leagueId: string; teamFilter: string; backupPath: string } {
  const args = process.argv.slice(2);
  let leagueId = DEFAULT_LEAGUE_ID;
  let teamFilter = '';
  let backupPath = resolve(
    ensureMilestoneDir(process.cwd(), DEFAULT_MILESTONE_SLUG),
    'runitback-league.json'
  );

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--league-id' && args[i + 1]) leagueId = args[++i];
    else if (args[i] === '--team' && args[i + 1]) teamFilter = args[++i].toLowerCase();
    else if (args[i] === '--backup' && args[i + 1]) backupPath = resolve(process.cwd(), args[++i]);
  }

  return { leagueId, teamFilter, backupPath };
}

function loadBackup(path: string): BackupPayload | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BackupPayload;
  } catch {
    return null;
  }
}

function countTournamentRosters(
  teamId: string,
  rows: { tournamentId: string; teamId: string }[]
): Map<string, number> {
  const byTournament = new Map<string, number>();
  for (const row of rows) {
    if (row.teamId !== teamId) continue;
    byTournament.set(row.tournamentId, (byTournament.get(row.tournamentId) ?? 0) + 1);
  }
  return byTournament;
}

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const { leagueId, teamFilter, backupPath } = parseArgs();
  const backup = loadBackup(backupPath);

  console.log('RunItBack — roster diagnose (read-only)\n');

  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase(leagueId);

  let teams = data.teams;
  if (teamFilter) {
    teams = teams.filter((t) => t.name.toLowerCase().includes(teamFilter));
  }

  if (teams.length === 0) {
    console.log('No teams matched filter.');
    process.exit(0);
  }

  console.log(`Supabase league: ${leagueId}`);
  console.log(`Backup file: ${backup ? backupPath : '(not found)'}\n`);

  for (const team of teams.sort((a, b) => a.name.localeCompare(b.name))) {
    const clubCount = team.players?.length ?? 0;
    const backupTeam = backup?.teams?.find((t) => t.id === team.id);
    const backupClubCount = backupTeam?.players?.length ?? null;
    const tourneyByT = countTournamentRosters(
      team.id,
      data.tournamentRosters ?? []
    );
    const tourneyTotal = [...tourneyByT.values()].reduce((a, b) => a + b, 0);

    console.log(`── ${team.name} (${team.id})`);
    console.log(`   club roster (team_players via load): ${clubCount}`);
    if (backupClubCount != null) {
      const delta = backupClubCount - clubCount;
      console.log(
        `   backup club roster:                  ${backupClubCount}${delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta} vs live)` : ''}`
      );
    }
    console.log(`   tournament_rosters rows (all):       ${tourneyTotal}`);
    if (tourneyByT.size > 0) {
      for (const [tid, n] of [...tourneyByT.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`     • ${tid}: ${n}`);
      }
    }
    if (clubCount <= 5 && backupClubCount != null && backupClubCount > 5) {
      console.log('   ⚠ club roster may be truncated vs backup');
    }
    console.log('');
  }

  console.log('Done. No database writes were performed.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
