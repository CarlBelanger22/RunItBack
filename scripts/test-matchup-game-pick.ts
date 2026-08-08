/**
 * LE-116 — Matchup date prefer (earliest RR / latest KO).
 * Run: npm run test:matchup-game-pick
 */
import type { Game } from '../src/App';
import {
  pickGameForMatchup,
  matchupGamesSorted,
} from '../src/utils/matchupGamePick';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function g(
  id: string,
  date: string,
  home: string,
  away: string
): Game {
  return {
    id,
    date,
    homeTeamId: home,
    awayTeamId: away,
    tournamentId: 't1',
  } as Game;
}

function main(): void {
  const games = [
    g('oct1', '2025-10-01', 'sit', 'sutd'),
    g('sep26', '2025-09-26', 'sit', 'sutd'),
    g('other', '2025-09-20', 'ntu', 'nus'),
  ];

  const earliest = pickGameForMatchup(games, 'sit', 'sutd', 'earliest');
  assert(earliest?.id === 'sep26', `earliest=${earliest?.id}`);

  const latest = pickGameForMatchup(games, 'sit', 'sutd', 'latest');
  assert(latest?.id === 'oct1', `latest=${latest?.id}`);

  const latestExcl = pickGameForMatchup(
    games,
    'sutd',
    'sit',
    'latest',
    new Set(['oct1'])
  );
  assert(latestExcl?.id === 'sep26', 'exclude latest');

  const sorted = matchupGamesSorted(games, 'sutd', 'sit');
  assert(sorted[0].id === 'sep26' && sorted[1].id === 'oct1', 'sorted');

  console.log('PASS: test-matchup-game-pick');
}

main();
