import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { resolvePlayerTeamSideInGame } from '../src/utils/tournamentRosters';

loadEnvLocalIntoProcess();

/** Game-derived rosters with NO club-roster bias (starters + home default only). */
async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const emptyClub = new Map<string, Set<string>>();
  const byTeam = new Map<string, Set<string>>();

  for (const g of data.games) {
    if (!g.isCompleted) continue;
    const ids = new Set((g.gameStats ?? []).map((s) => s.playerId));
    for (const pid of ids) {
      const tid = resolvePlayerTeamSideInGame(pid, g, emptyClub);
      if (!tid) continue;
      const set = byTeam.get(tid) ?? new Set();
      set.add(pid);
      byTeam.set(tid, set);
    }
  }

  console.log('Game-derived rosters (NO club roster bias):\n');
  for (const t of [...data.teams].sort(
    (a, b) => (byTeam.get(b.id)?.size ?? 0) - (byTeam.get(a.id)?.size ?? 0)
  )) {
    const n = byTeam.get(t.id)?.size ?? 0;
    if (n === 0) continue;
    console.log(`  ${t.name}: ${n} players`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
