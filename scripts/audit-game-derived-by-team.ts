import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { resolvePlayerTeamSideInGame, buildClubRosterByTeam } from '../src/utils/tournamentRosters';

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const club = buildClubRosterByTeam(data.teams);
  const byTeam = new Map<string, Set<string>>();

  for (const g of data.games) {
    if (!g.isCompleted) continue;
    const ids = new Set((g.gameStats ?? []).map((s) => s.playerId));
    for (const pid of ids) {
      const tid = resolvePlayerTeamSideInGame(pid, g, club);
      if (!tid) continue;
      const set = byTeam.get(tid) ?? new Set();
      set.add(pid);
      byTeam.set(tid, set);
    }
  }

  console.log('If rebuild = game_stats_only (current side resolver):\n');
  for (const t of [...data.teams].sort(
    (a, b) => (byTeam.get(b.id)?.size ?? 0) - (byTeam.get(a.id)?.size ?? 0)
  )) {
    const n = byTeam.get(t.id)?.size ?? 0;
    if (n === 0) continue;
    const roster = t.players?.length ?? 0;
    console.log(`  ${t.name}: ${n} game players, ${roster} club roster now`);
  }

  const zero = data.teams.filter((t) => (byTeam.get(t.id)?.size ?? 0) === 0);
  console.log(`\nZero game-derived players (${zero.length}): ${zero.map((t) => t.name).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
