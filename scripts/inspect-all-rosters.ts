import { loadEnvLocalIntoProcess } from './loadEnvLocal';

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  console.log('=== Club rosters (team_players) ===\n');
  const sorted = [...data.teams].sort(
    (a, b) => (b.players?.length ?? 0) - (a.players?.length ?? 0)
  );
  for (const team of sorted) {
    const n = team.players?.length ?? 0;
    if (n === 0) {
      console.log(`${team.name} (${team.id}): 0 players`);
      continue;
    }
    console.log(`${team.name} (${team.id}): ${n} players`);
  }

  console.log('\n=== Teams with 0 club roster but game stats ===\n');
  for (const team of data.teams) {
    if ((team.players?.length ?? 0) > 0) continue;
    const gamePlayerIds = new Set<string>();
    for (const g of data.games) {
      if (g.homeTeamId !== team.id && g.awayTeamId !== team.id) continue;
      for (const s of g.gameStats ?? []) gamePlayerIds.add(s.playerId);
    }
    if (gamePlayerIds.size === 0) continue;
    console.log(`${team.name} (${team.id}): ${gamePlayerIds.size} unique game players, 0 on club roster`);
    const names = [...gamePlayerIds].map((id) => {
      const p =
        data.orphanPlayers.find((o) => o.id === id) ??
        data.teams.flatMap((t) => t.players ?? []).find((p) => p.id === id);
      return p?.name ?? id;
    });
    console.log(`  ${names.slice(0, 8).join(', ')}${names.length > 8 ? '...' : ''}`);
  }

  console.log('\n=== Players on wrong team (game says A, roster says B) — sample ===\n');
  let mismatches = 0;
  for (const g of data.games) {
    if (!g.isCompleted) continue;
    for (const stat of g.gameStats ?? []) {
      const home = g.homeTeamId === teamForPlayer(stat.playerId, data);
      const away = g.awayTeamId === teamForPlayer(stat.playerId, data);
      const rosterTeam = teamForPlayer(stat.playerId, data);
      const playedFor =
        g.homeTeamId === rosterTeam || g.awayTeamId === rosterTeam
          ? rosterTeam
          : null;
      if (!playedFor && rosterTeam) {
        const playedTeamId = (g.gameStats ?? []).some((s) => s.playerId === stat.playerId)
          ? g.homeTeamId === rosterTeam || g.awayTeamId === rosterTeam
          : false;
      }
      const gameTeamId = findPlayerTeamInGame(stat.playerId, g, data);
      const clubTeamId = rosterTeam;
      if (gameTeamId && clubTeamId && gameTeamId !== clubTeamId) {
        mismatches++;
        if (mismatches <= 15) {
          const name = playerName(stat.playerId, data);
          const gameTeam = data.teams.find((t) => t.id === gameTeamId)?.name;
          const clubTeam = data.teams.find((t) => t.id === clubTeamId)?.name;
          console.log(`  ${name}: played ${gameTeam} in ${g.id}, club roster on ${clubTeam}`);
        }
      }
    }
  }
  console.log(`Total cross-team mismatches (club vs game): ${mismatches}`);
}

function teamForPlayer(
  playerId: string,
  data: Awaited<ReturnType<typeof import('../src/api/supabaseData').loadAppDataFromSupabase>>
): string | null {
  for (const t of data.teams) {
    if ((t.players ?? []).some((p) => p.id === playerId)) return t.id;
  }
  return null;
}

function findPlayerTeamInGame(
  playerId: string,
  game: import('../src/App').Game,
  data: Awaited<ReturnType<typeof import('../src/api/supabaseData').loadAppDataFromSupabase>>
): string | null {
  const homeIds = new Set(
    (game.homeTeam?.players ?? data.teams.find((t) => t.id === game.homeTeamId)?.players ?? []).map(
      (p) => p.id
    )
  );
  if (homeIds.has(playerId)) return game.homeTeamId;
  const awayIds = new Set(
    (game.awayTeam?.players ?? data.teams.find((t) => t.id === game.awayTeamId)?.players ?? []).map(
      (p) => p.id
    )
  );
  if (awayIds.has(playerId)) return game.awayTeamId;
  // Infer from game stats + team side in stat context — use home/away if stat exists only once
  const hasStat = (game.gameStats ?? []).some((s) => s.playerId === playerId);
  if (!hasStat) return null;
  // Heuristic: check tournament roster
  const tr = data.tournamentRosters.find(
    (r) =>
      r.playerId === playerId &&
      r.tournamentId === game.tournamentId &&
      (r.teamId === game.homeTeamId || r.teamId === game.awayTeamId)
  );
  return tr?.teamId ?? null;
}

function playerName(
  playerId: string,
  data: Awaited<ReturnType<typeof import('../src/api/supabaseData').loadAppDataFromSupabase>>
): string {
  return (
    data.teams.flatMap((t) => t.players ?? []).find((p) => p.id === playerId)?.name ??
    data.orphanPlayers.find((p) => p.id === playerId)?.name ??
    playerId
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
