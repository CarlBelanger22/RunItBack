import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  const tours = data.tournaments.filter((t) =>
    /b.?div|b division/i.test(t.name)
  );
  console.log('B Division tournaments:');
  for (const t of tours) {
    console.log(
      `  ${t.id} | ${t.name} | ${t.year} ${t.month} | ${(t.teams ?? []).length} teams`
    );
    for (const teamId of t.teams ?? []) {
      const team = data.teams.find((x) => x.id === teamId);
      console.log(`    ${teamId} | ${team?.name ?? '?'} | ${team?.abbreviation ?? '?'}`);
    }
  }

  const fairfield = data.teams.filter((t) => /fairfield/i.test(t.name));
  console.log('\nFairfield teams:');
  for (const t of fairfield) {
    const carl = (t.players ?? []).find(
      (p) => p.id === 'player-sunig-ntu-22' || /carl/i.test(p.name)
    );
    console.log(
      `  ${t.id} | ${t.name} | ${t.abbreviation} | players: ${t.players?.length ?? 0}${carl ? ` | Carl #${carl.number}` : ''}`
    );
  }

  const tid = tours.find((t) => /2018/.test(String(t.year)))?.id ?? tours[0]?.id;
  if (tid) {
    const games = data.games.filter((g) => g.tournamentId === tid);
    console.log(`\nExisting games in ${tid}: ${games.length}`);
    const tr = data.tournamentRosters.filter((r) => r.tournamentId === tid);
    console.log(`Tournament roster rows: ${tr.length}`);
    for (const r of tr) {
      const team = data.teams.find((t) => t.id === r.teamId);
      const player = data.teams
        .flatMap((t) => t.players ?? [])
        .find((p) => p.id === r.playerId);
      console.log(`  ${team?.name ?? r.teamId} | #${r.number} ${player?.name ?? r.playerId}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
