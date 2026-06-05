/**
 * Remove player profiles not on any team roster (orphans).
 * Skips any orphan referenced in completed game stats or tournament_rosters.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-players.ts --dry-run
 *   npx tsx scripts/cleanup-orphan-players.ts
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';

loadEnvLocalIntoProcess();

function orphanIdsInGames(
  orphanIds: Set<string>,
  games: import('../src/App').Game[]
): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const game of games) {
    for (const stat of game.gameStats ?? []) {
      if (!stat.playerId || !orphanIds.has(stat.playerId)) continue;
      const list = refs.get(stat.playerId) ?? [];
      list.push(game.id);
      refs.set(stat.playerId, list);
    }
  }
  return refs;
}

function orphanIdsInTournamentRosters(
  orphanIds: Set<string>,
  rosters: import('../src/utils/tournamentRosters').TournamentRosterEntry[]
): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const row of rosters) {
    if (!orphanIds.has(row.playerId)) continue;
    const key = `${row.tournamentId}:${row.teamId}`;
    const list = refs.get(row.playerId) ?? [];
    list.push(key);
    refs.set(row.playerId, list);
  }
  return refs;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const { loadAppDataFromSupabase, deletePlayersFromSupabase } = await import(
    '../src/api/supabaseData'
  );

  console.log('RunItBack — cleanup orphan players\n');
  if (dryRun) console.log('DRY RUN — no deletes\n');

  const data = await loadAppDataFromSupabase();
  const onRoster = new Set(
    data.teams.flatMap((t) => (t.players ?? []).map((p) => p.id))
  );
  const orphans = data.orphanPlayers.filter((p) => !onRoster.has(p.id));
  const orphanIdSet = new Set(orphans.map((p) => p.id));

  const gameRefs = orphanIdsInGames(orphanIdSet, data.games);
  const rosterRefs = orphanIdsInTournamentRosters(
    orphanIdSet,
    data.tournamentRosters
  );

  const safeToDelete = orphans.filter(
    (p) => !gameRefs.has(p.id) && !rosterRefs.has(p.id)
  );
  const blocked = orphans.filter(
    (p) => gameRefs.has(p.id) || rosterRefs.has(p.id)
  );

  console.log(`Orphan profiles: ${orphans.length}`);
  console.log(`Safe to delete: ${safeToDelete.length}`);
  console.log(`Blocked (game/tournament refs): ${blocked.length}`);

  if (blocked.length > 0) {
    console.log('\nBlocked (kept):');
    for (const p of blocked) {
      const games = gameRefs.get(p.id);
      const rosters = rosterRefs.get(p.id);
      const parts: string[] = [];
      if (games?.length) parts.push(`games: ${games.join(', ')}`);
      if (rosters?.length) parts.push(`rosters: ${rosters.join(', ')}`);
      console.log(`  ${p.name} (${p.id}) — ${parts.join('; ')}`);
    }
  }

  if (safeToDelete.length > 0) {
    console.log('\nWill delete:');
    for (const p of safeToDelete) {
      console.log(`  ${p.name} (${p.id})`);
    }
  }

  if (dryRun || safeToDelete.length === 0) {
    console.log(dryRun ? '\nDry run complete.' : '\nNothing to delete.');
    return;
  }

  await deletePlayersFromSupabase(safeToDelete.map((p) => p.id));
  console.log(`\nDeleted ${safeToDelete.length} orphan player(s) from Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
