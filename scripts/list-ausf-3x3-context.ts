import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  const tours = data.tournaments.filter((t) => /ausf|3x3/i.test(t.name));
  console.log('AUSF / 3x3 tournaments:');
  for (const t of tours) {
    console.log(`  ${t.id} | ${t.name} | ${t.year} ${t.month} | teams: ${(t.teams ?? []).length}`);
    for (const tid of t.teams ?? []) {
      const team = data.teams.find((x) => x.id === tid);
      console.log(`    ${team?.abbreviation ?? '?'} | ${team?.name ?? tid} | ${tid}`);
    }
    const games = data.games.filter((g) => g.tournamentId === t.id);
    console.log(`    games: ${games.length}`);
  }

  const ntu = data.teams.find((t) => t.id === 'team-sunig-ntu');
  console.log('\nNTU roster:');
  for (const p of ntu?.players ?? []) {
    console.log(`  #${p.number} ${p.name} (${p.id})`);
  }
  for (const q of ['Louis', 'Reuben', 'Kovan']) {
    const hits = data.teams.flatMap((t) =>
      (t.players ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).map((p) => ({ p, t }))
    );
    console.log(`\n${q}:`, hits.map(({ p, t }) => `#${p.number} ${p.name} @ ${t.name}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
