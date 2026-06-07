import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  const asg = data.tournaments.filter((t) => /asg|asean|2019/i.test(`${t.name} ${t.year}`));
  console.log('ASG / 2019 tournaments:');
  for (const t of asg) {
    console.log(`  ${t.id} | ${t.name} | ${t.year} ${t.month} | teams=${(t.teams ?? []).length}`);
    for (const tid of t.teams ?? []) {
      const team = data.teams.find((x) => x.id === tid);
      console.log(`    ${tid} | ${team?.name} | ${(team?.players ?? []).length} players`);
    }
    const games = data.games.filter((g) => g.tournamentId === t.id);
    console.log(`    games: ${games.length}`);
    for (const g of games) {
      console.log(
        `      ${g.date} | ${g.homeTeam?.name} ${g.finalScore?.home}-${g.finalScore?.away} ${g.awayTeam?.name}`
      );
    }
  }

  const sgTeams = data.teams.filter((t) => /singapore/i.test(t.name));
  console.log('\nSingapore-named teams:');
  for (const t of sgTeams) {
    console.log(`  ${t.id} | ${t.name} | ${(t.players ?? []).length} players`);
    for (const p of t.players ?? []) {
      console.log(`    #${p.number} ${p.name} (${p.id})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
