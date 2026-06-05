import { loadEnvLocalIntoProcess } from './loadEnvLocal';

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const ntu = data.teams.find((t) => t.id === 'team-sunig-ntu');
  console.log('NTU players on team:', ntu?.players?.length ?? 0);
  for (const p of ntu?.players ?? []) {
    console.log(`  #${p.number} ${p.name} (${p.id})`);
  }

  const ntuGamePlayers = new Set<string>();
  for (const g of data.games) {
    if (g.homeTeamId !== 'team-sunig-ntu' && g.awayTeamId !== 'team-sunig-ntu') continue;
    for (const s of g.gameStats ?? []) ntuGamePlayers.add(s.playerId);
  }
  const rosterIds = new Set((ntu?.players ?? []).map((p) => p.id));
  const missing = [...ntuGamePlayers].filter((id) => !rosterIds.has(id));
  console.log('\nUnique players in NTU game stats:', ntuGamePlayers.size);
  console.log('Missing from club roster:', missing.length);
  for (const id of missing.sort()) {
    const fromTeam = data.teams
      .flatMap((t) => t.players ?? [])
      .find((p) => p.id === id);
    const fromOrphan = data.orphanPlayers.find((p) => p.id === id);
    console.log(`  ${fromTeam?.name ?? fromOrphan?.name ?? id}`);
  }

  const tr = data.tournamentRosters.filter((r) => r.teamId === 'team-sunig-ntu');
  console.log('\ntournament_rosters for NTU:', tr.length);

  console.log('\nWhere missing NTU game players live:');
  for (const id of missing.sort()) {
    const orphan = data.orphanPlayers.find((p) => p.id === id);
    const otherTeams = data.teams.filter((t) =>
      (t.players ?? []).some((p) => p.id === id)
    );
    if (otherTeams.length > 0) {
      console.log(
        `  ${orphan?.name ?? id} — on ${otherTeams.map((t) => t.name).join(', ')}`
      );
    } else if (orphan) {
      console.log(`  ${orphan.name} — orphan profile`);
    } else {
      console.log(`  ${id} — not found`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
