import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { resolvePlayerTeamSideInGame, buildClubRosterByTeam } from '../src/utils/tournamentRosters';

loadEnvLocalIntoProcess();

const KX_ID = 'team-1780252086140';

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const kx = data.teams.find((t) => t.id === KX_ID);
  if (!kx) {
    console.error('Kai Xuan team not found');
    process.exit(1);
  }

  const clubRoster = kx.players ?? [];
  const clubByTeam = buildClubRosterByTeam(data.teams);

  const kxGames = data.games.filter(
    (g) => g.isCompleted && (g.homeTeamId === KX_ID || g.awayTeamId === KX_ID)
  );

  const playedForKx = new Set<string>();
  for (const game of kxGames) {
    for (const stat of game.gameStats ?? []) {
      const side = resolvePlayerTeamSideInGame(stat.playerId, game, clubByTeam);
      if (side === KX_ID) playedForKx.add(stat.playerId);
    }
  }

  console.log(`Kai Xuan club roster: ${clubRoster.length} players`);
  console.log(`Kai Xuan completed games: ${kxGames.length}`);
  console.log(`Unique players with KX-side game stats: ${playedForKx.size}\n`);

  const onRosterNotInGames: typeof clubRoster = [];
  for (const p of clubRoster) {
    if (!playedForKx.has(p.id)) onRosterNotInGames.push(p);
  }

  const inGamesNotOnRoster: string[] = [];
  for (const id of playedForKx) {
    if (!clubRoster.some((p) => p.id === id)) inGamesNotOnRoster.push(id);
  }

  if (onRosterNotInGames.length > 0) {
    console.log(`On KX club roster but NO KX-side game stat (${onRosterNotInGames.length}):`);
    for (const p of onRosterNotInGames) {
      console.log(`  #${p.number} ${p.name} (${p.id})`);
    }
  } else {
    console.log('All club roster players have KX-side game stats.');
  }

  if (inGamesNotOnRoster.length > 0) {
    console.log(`\nKX-side game stats but NOT on club roster (${inGamesNotOnRoster.length}):`);
    for (const id of inGamesNotOnRoster) {
      const name =
        data.teams.flatMap((t) => t.players ?? []).find((p) => p.id === id)?.name ??
        data.orphanPlayers.find((p) => p.id === id)?.name ??
        id;
      console.log(`  ${name} (${id})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
