import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const sg = data.tournaments.filter((t) =>
    /sheng|gong|2019/i.test(`${t.name} ${t.year}`)
  );
  console.log('Shenggong / 2019 tournaments:');
  for (const t of sg) {
    console.log(`  ${t.id} | ${t.name} | ${t.year} ${t.month} | ${(t.teams ?? []).length} teams`);
    for (const teamId of t.teams ?? []) {
      const team = data.teams.find((x) => x.id === teamId);
      console.log(`    ${teamId} | ${team?.name ?? '?'} | ${team?.abbreviation ?? '?'}`);
    }
  }
  const search = ['novu', 'dt', 'sba', 'safsa', 'kai xuan', 'warrior'];
  console.log('\nMatching teams in league:');
  for (const t of data.teams) {
    const n = t.name.toLowerCase();
    if (search.some((s) => n.includes(s))) {
      console.log(`  ${t.id} | ${t.name} | ${t.abbreviation}`);
    }
  }

  const tid = 'tournament-1780771500232';
  const games = data.games.filter((g) => g.tournamentId === tid);
  console.log(`\nExisting games in ${tid}: ${games.length}`);
  for (const g of games) {
    console.log(
      `  ${g.id} | ${g.date} | ${g.homeTeam?.name} ${g.finalScore?.home}-${g.finalScore?.away} ${g.awayTeam?.name}`
    );
  }

  const kx = data.teams.find((t) => t.id === 'team-1780252086140');
  const carl = (kx?.players ?? []).find((p) => p.id === 'player-sunig-ntu-22');
  console.log(
    `\nCarl on Kai Xuan roster: ${carl ? `#${carl.number} ${carl.name}` : 'NOT ON ROSTER'}`
  );

  const tr = data.tournamentRosters.filter((r) => r.tournamentId === tid);
  console.log(`\nTournament roster rows (${tr.length}):`);
  for (const r of tr) {
    const team = data.teams.find((t) => t.id === r.teamId);
    const player = data.teams.flatMap((t) => t.players ?? []).find((p) => p.id === r.playerId);
    console.log(`  ${team?.name ?? r.teamId} | #${r.number} ${player?.name ?? r.playerId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
