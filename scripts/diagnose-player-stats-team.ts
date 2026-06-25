import { loadEnvLocalIntoProcess } from './loadEnvLocal';

loadEnvLocalIntoProcess();

async function main() {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const { resolvePlayerTeamInGame, resolvePlayerTeamIdForGames } = await import(
    '../src/utils/rosterPlayers'
  );
  const { resolvePlayerTeamSideInGame, buildClubRosterByTeam } = await import(
    '../src/utils/tournamentRosters'
  );

  const data = await loadAppDataFromSupabase();
  const carl = 'player-sunig-ntu-22';
  const onRoster = data.teams.filter((t) =>
    (t.players ?? []).some((p) => p.id === carl)
  );
  console.log(
    'Carl club rosters:',
    onRoster.map((t) => `${t.abbreviation} | ${t.name} | ${t.id}`)
  );

  const games = data.games.filter(
    (g) =>
      g.isCompleted && (g.gameStats ?? []).some((s) => s.playerId === carl)
  );
  const byT = new Map<string, typeof games>();
  for (const g of games) {
    const tid = g.tournamentId ?? 'none';
    const list = byT.get(tid) ?? [];
    list.push(g);
    byT.set(tid, list);
  }

  const leagueTeams = onRoster;
  const club = buildClubRosterByTeam(data.teams);

  const tst = data.teams.filter((t) => t.abbreviation === 'TST');
  console.log(`\nTeams with abbreviation TST: ${tst.length} / ${data.teams.length}`);

  for (const [tid, gs] of byT) {
    const tname = data.tournaments.find((t) => t.id === tid)?.name ?? tid;
    const oldId = resolvePlayerTeamIdForGames(carl, gs, leagueTeams);
    const sideIds = [...new Set(gs.map((g) => resolvePlayerTeamSideInGame(carl, g, club)))];
    const oldAbbr = data.teams.find((t) => t.id === oldId)?.abbreviation;
    const oldName = data.teams.find((t) => t.id === oldId)?.name;
    const sideAbbrs = sideIds.map((id) => {
      const t = data.teams.find((x) => x.id === id);
      return t ? `${t.abbreviation}/${t.name}` : id;
    });
    const home = data.teams.find((t) => t.id === gs[0].homeTeamId);
    console.log(
      `${tname} | resolved: ${oldAbbr} (${oldName}) | side: ${sideAbbrs.join(', ')} | home: ${home?.abbreviation} ${home?.name} | n=${gs.length}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
