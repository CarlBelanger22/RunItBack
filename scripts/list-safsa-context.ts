import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const safsa = data.teams.filter((t) => /safsa|arion/i.test(t.name));
  console.log('SAFSA-related teams:');
  for (const t of safsa) {
    const icon = t.icon
      ? t.icon.startsWith('data:')
        ? `data-url(${t.icon.length} chars)`
        : t.icon
      : '(none)';
    console.log(`  ${t.id} | ${t.name} | icon=${icon} | ${(t.players ?? []).length} players`);
    for (const p of t.players ?? []) {
      console.log(`    #${p.number} ${p.name} (${p.id})`);
    }
  }
  console.log('\nDiv2/NBL tournaments:');
  for (const t of data.tournaments.filter((x) => /div|nbl/i.test(x.name))) {
    const icon = t.icon
      ? t.icon.startsWith('data:')
        ? `data-url(${t.icon.length} chars)`
        : t.icon
      : '(none)';
    console.log(`  ${t.id} | ${t.name} | ${t.year} ${t.month} | icon=${icon} | ${(t.teams ?? []).length} teams`);
  }

  const tid = 'tournament-1780425044074';
  const nbl2023 = data.tournaments.find((t) => t.id === tid);
  if (nbl2023) {
    console.log(`\nNBL Div 2 2023 enrolled teams (${(nbl2023.teams ?? []).length}):`);
    for (const teamId of nbl2023.teams ?? []) {
      const team = data.teams.find((t) => t.id === teamId);
      console.log(`  ${teamId} | ${team?.name ?? '?'}`);
    }
  }
  const safsaId = 'team-kx-div2-safsa';
  const games = data.games.filter((g) => g.tournamentId === tid);
  const safsaGames = games.filter(
    (g) => g.homeTeamId === safsaId || g.awayTeamId === safsaId
  );
  console.log(`\nNBL Div 2 2023: ${games.length} games total, ${safsaGames.length} SAFSA`);
  for (const g of safsaGames) {
    console.log(
      `  ${g.date} | ${g.homeTeam?.name} ${g.finalScore?.home} - ${g.finalScore?.away} ${g.awayTeam?.name} | ${g.id}`
    );
  }
}

main();
