/**
 * Backfill tournament_rosters from completed game stats (game-stats-only rule).
 * Usage:
 *   npm run backfill:tournament-rosters -- --dry-run
 *   npm run backfill:tournament-rosters
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  buildTournamentRostersFromGames,
  dedupeTournamentRostersForDb,
  countRosterEntriesForTeamInTournament,
  findTournamentByNameHint,
  isPlayerOnTournamentRoster,
  RAM_SUNDA_PUTRA_PLAYER_ID,
} from '../src/utils/tournamentRosters';

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const { DEFAULT_LEAGUE_ID, loadAppDataFromSupabase, saveAppDataToSupabase } =
    await import('../src/api/supabaseData');

  console.log('RunItBack — backfill tournament_rosters from game stats\n');
  if (dryRun) console.log('DRY RUN — no writes\n');

  const data = await loadAppDataFromSupabase();
  const { entries, ambiguous, conflicts } = buildTournamentRostersFromGames(
    data.games,
    data.teams
  );

  const byTournament = new Map<string, number>();
  for (const entry of entries) {
    byTournament.set(
      entry.tournamentId,
      (byTournament.get(entry.tournamentId) ?? 0) + 1
    );
  }

  console.log(`Completed games: ${data.games.filter((g) => g.isCompleted).length}`);
  console.log(`Tournament roster rows (derived): ${entries.length}`);
  console.log('Rows per tournament:');
  for (const tournament of data.tournaments) {
    const count = byTournament.get(tournament.id) ?? 0;
    if (count > 0) {
      console.log(`  ${tournament.name} (${tournament.month} ${tournament.year}): ${count}`);
    }
  }

  if (ambiguous.length > 0) {
    console.log(`\nAmbiguous side (${ambiguous.length}):`);
    for (const row of ambiguous.slice(0, 10)) {
      console.log(`  game=${row.gameId} player=${row.playerId} tournament=${row.tournamentId}`);
    }
    if (ambiguous.length > 10) {
      console.log(`  ... and ${ambiguous.length - 10} more`);
    }
  }

  if (conflicts.length > 0) {
    console.log(
      `\nDATA CONFLICTS — same player on multiple teams in one tournament (${conflicts.length}):`
    );
    for (const row of conflicts) {
      const tName =
        data.tournaments.find((t) => t.id === row.tournamentId)?.name ?? row.tournamentId;
      console.log(`  ${row.playerId} in ${tName}: teams ${row.teamIds.join(', ')}`);
    }
  }

  const kaiXuan = data.teams.find(
    (t) =>
      t.name.toLowerCase().includes('kai xuan') ||
      t.abbreviation.toLowerCase() === 'kx'
  );
  const nbl2024 = findTournamentByNameHint(data.tournaments, 'nbl div 2 2024');
  const gemilangU21 = findTournamentByNameHint(data.tournaments, 'gemilang cup u21');

  if (kaiXuan && nbl2024) {
    const onNbl = isPlayerOnTournamentRoster(
      RAM_SUNDA_PUTRA_PLAYER_ID,
      nbl2024.id,
      kaiXuan.id,
      entries
    );
    console.log(`\nRam on ${nbl2024.name} / ${kaiXuan.name}: ${onNbl ? 'yes' : 'no'}`);
  }
  if (kaiXuan && gemilangU21) {
    const onU21 = isPlayerOnTournamentRoster(
      RAM_SUNDA_PUTRA_PLAYER_ID,
      gemilangU21.id,
      kaiXuan.id,
      entries
    );
    console.log(
      `Ram on ${gemilangU21.name} / ${kaiXuan.name}: ${onU21 ? 'yes (unexpected)' : 'no (expected)'}`
    );
  }

  if (dryRun) {
    console.log('\nDry run complete.');
    return;
  }

  const rosterEntries = dedupeTournamentRostersForDb(
    entries,
    data.games,
    data.teams
  );
  if (rosterEntries.length < entries.length) {
    console.log(
      `\nDeduped ${entries.length - rosterEntries.length} conflicting roster row(s) before save.`
    );
  }

  await saveAppDataToSupabase(
    data.teams,
    data.tournaments,
    data.games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    rosterEntries
  );

  console.log('\nSaved tournament_rosters to Supabase.');
  if (kaiXuan && nbl2024) {
    console.log(
      `KX NBL 2024 roster size: ${countRosterEntriesForTeamInTournament(nbl2024.id, kaiXuan.id, entries)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
