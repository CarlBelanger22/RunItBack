/**
 * Integrity checks for IUBIT 2026 schedule data (LE-66).
 */

import {
  ALL_TEAM_IDS,
  NEW_TEAM_IDS,
  PROTECTED_GAME_IDS,
  SCORE_ONLY_GAMES,
  TEAM_META,
} from './iubit-2026-schedule-data';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  assert(SCORE_ONLY_GAMES.length === 27, `expected 27 games, got ${SCORE_ONLY_GAMES.length}`);
  assert(NEW_TEAM_IDS.length === 9, `expected 9 new teams, got ${NEW_TEAM_IDS.length}`);
  assert(ALL_TEAM_IDS.length === 14, `expected 14 teams, got ${ALL_TEAM_IDS.length}`);

  const gameIds = new Set<string>();
  for (const game of SCORE_ONLY_GAMES) {
    assert(!gameIds.has(game.id), `duplicate game id ${game.id}`);
    gameIds.add(game.id);

    assert(
      !PROTECTED_GAME_IDS.includes(game.id as (typeof PROTECTED_GAME_IDS)[number]),
      `game ${game.id} collides with protected stat game`
    );

    const home = TEAM_META[game.homeTeamId];
    const away = TEAM_META[game.awayTeamId];
    assert(Boolean(home), `unknown home team ${game.homeTeamId}`);
    assert(Boolean(away), `unknown away team ${game.awayTeamId}`);
    assert(game.homeScore >= 0 && game.awayScore >= 0, `invalid score in ${game.id}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(game.date), `invalid date in ${game.id}`);
    assert(/^\d{2}:\d{2}$/.test(game.startTime), `invalid startTime in ${game.id}`);
  }

  const teamsInGames = new Set<string>();
  for (const game of SCORE_ONLY_GAMES) {
    teamsInGames.add(game.homeTeamId);
    teamsInGames.add(game.awayTeamId);
  }
  for (const teamId of NEW_TEAM_IDS) {
    assert(teamsInGames.has(teamId), `new team ${teamId} not referenced by any score-only game`);
  }

  const matchNos = SCORE_ONLY_GAMES.map((g) => g.matchNo).sort((a, b) => a - b);
  const expected = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31];
  assert(
    JSON.stringify(matchNos) === JSON.stringify(expected),
    `unexpected match numbers: ${matchNos.join(',')}`
  );

  console.log('test-iubit-2026-schedule: all checks passed');
  console.log(`  games: ${SCORE_ONLY_GAMES.length}`);
  console.log(`  new teams: ${NEW_TEAM_IDS.length}`);
  console.log(`  tournament teams: ${ALL_TEAM_IDS.length}`);
}

main();
