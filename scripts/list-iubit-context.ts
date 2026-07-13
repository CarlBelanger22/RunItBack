import { loadEnvLocalIntoProcess } from './loadEnvLocal';
loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  for (const t of data.tournaments) {
    if (
      t.year === 2026 ||
      /july/i.test(t.month || '') ||
      /iubit|ivp/i.test(t.name)
    ) {
      const games = data.games.filter((g) => g.tournamentId === t.id);
      console.log('===', t.name, t.id, `| ${t.year} ${t.month}`, '===');
      console.log('Teams enrolled:', t.teams.length);
      for (const g of games.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime || '').localeCompare(b.startTime || '')
      )) {
        const home = data.teams.find((x) => x.id === g.homeTeamId);
        const away = data.teams.find((x) => x.id === g.awayTeamId);
        const hs = g.finalScore?.home ?? g.teamStats?.home?.total_points;
        const as = g.finalScore?.away ?? g.teamStats?.away?.total_points;
        const hasStats = (g.gameStats?.length ?? 0) > 0;
        console.log(
          [
            g.date,
            g.startTime || '',
            home?.abbreviation,
            hs,
            '-',
            as,
            away?.abbreviation,
            'stats:' + hasStats,
            g.id,
          ].join(' ')
        );
      }
      const teamNames = t.teams.map((tid) => {
        const team = data.teams.find((x) => x.id === tid);
        return team ? `${team.abbreviation}:${team.name}` : tid;
      });
      console.log('Teams:', teamNames.join(' | '));
      if (/iubit/i.test(t.name)) {
        for (const tid of t.teams) {
          const team = data.teams.find((x) => x.id === tid);
          if (team) console.log('  ID', team.abbreviation, team.id);
        }
      }
    }
  }

  const needles = [
    'Chulalongkorn',
    'Fudan',
    'Harbin',
    'Nanjing',
    'Peking',
    'Sydney',
    'Cambridge',
    'Science and Technology of China',
    'Jiaotong',
  ];
  console.log('\n=== Existing club teams (schedule names) ===');
  for (const n of needles) {
    const hits = data.teams.filter((t) =>
      t.name.toLowerCase().includes(n.toLowerCase())
    );
    if (hits.length) {
      console.log(
        n + ':',
        hits.map((t) => `${t.id} | ${t.abbreviation} | ${t.name}`).join(' ; ')
      );
    } else {
      console.log(n + ': (none)');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
