import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const tid = 'tournament-1780425044074';
  const kxId = 'team-1780252086140';
  const t = data.tournaments.find((x) => x.id === tid);
  console.log('NBL Div 2 2023 enrolled:', (t?.teams ?? []).length, 'teams');
  console.log('Kai Xuan in tournament.teams:', t?.teams?.includes(kxId));
  const kxGames = data.games.filter(
    (g) =>
      g.tournamentId === tid &&
      (g.homeTeamId === kxId || g.awayTeamId === kxId)
  );
  console.log('Kai Xuan games in NBL 2023:', kxGames.length);
  for (const g of kxGames) {
    console.log(`  ${g.date} | ${g.homeTeam?.name} vs ${g.awayTeam?.name} | ${g.id}`);
  }
  console.log('\nEnrolled team names:');
  for (const id of t?.teams ?? []) {
    const team = data.teams.find((x) => x.id === id);
    console.log(`  ${team?.name ?? id}`);
  }
  const tGames = data.games.filter((g) => g.tournamentId === tid);
  console.log(`\nTotal games with tournamentId: ${tGames.length}`);
  console.log(`tournament.games array length: ${t?.games?.length ?? 0}`);
  const gameTeamIds = new Set<string>();
  for (const g of tGames) {
    if (g.homeTeamId) gameTeamIds.add(g.homeTeamId);
    if (g.awayTeamId) gameTeamIds.add(g.awayTeamId);
  }
  console.log('Unique teams in games:', [...gameTeamIds].map(id => data.teams.find(t => t.id === id)?.name ?? id).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
