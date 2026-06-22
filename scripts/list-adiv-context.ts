import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const tours = data.tournaments.filter((t) =>
    /a.?div|acjc|division.*2019/i.test(`${t.name} ${t.year}`)
  );
  console.log('Matching tournaments:');
  for (const t of tours) {
    console.log(
      `  ${t.id} | ${t.name} | ${t.year} ${t.month} | ${(t.teams ?? []).length} teams`
    );
    for (const teamId of t.teams ?? []) {
      const team = data.teams.find((x) => x.id === teamId);
      console.log(`    ${teamId} | ${team?.name ?? '?'} | ${team?.abbreviation ?? '?'}`);
    }
  }
  const acjc = data.teams.filter((t) =>
    /acjc|anglo/i.test(`${t.name} ${t.abbreviation ?? ''}`)
  );
  console.log('\nACJC teams:');
  for (const t of acjc) {
    const carl = (t.players ?? []).find((p) => p.id === 'player-sunig-ntu-22');
    console.log(
      `  ${t.id} | ${t.name} | ${t.abbreviation} | players: ${t.players?.length ?? 0}${carl ? ` | Carl #${carl.number}` : ''}`
    );
  }
  const opps = ['NJC', 'YIJC', 'NYJC', 'SJI', 'ASRJC', 'TMJC', 'RJC'];
  console.log('\nOpponent abbreviations:');
  for (const abbr of opps) {
    const found = data.teams.filter(
      (t) => (t.abbreviation ?? '').toUpperCase() === abbr
    );
    if (found.length) {
      for (const t of found) console.log(`  ${abbr} -> ${t.id} | ${t.name}`);
    } else {
      console.log(`  ${abbr} -> NOT FOUND`);
    }
  }

  const tid = tours[0]?.id;
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
