/**
 * Run: npm run test:game-sort
 */

import type { Game } from '../src/App';
import { sortGamesByDateDesc } from '../src/utils/gameDisplay';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makeGame(
  id: string,
  date: string,
  startTime?: string
): Game {
  return {
    id,
    date,
    startTime,
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'AWY', players: [] },
    gameStats: [],
    teamStats: {} as Game['teamStats'],
    isCompleted: true,
  } as Game;
}

function testDateDesc(): void {
  const games = [
    makeGame('older', '2026-07-01', '12:00'),
    makeGame('newer', '2026-07-05', '09:00'),
  ];
  const sorted = sortGamesByDateDesc(games);
  assert(sorted[0]?.id === 'newer', 'newer date sorts first');
  assert(sorted[1]?.id === 'older', 'older date sorts second');
}

function testTimeDescWithinSameDate(): void {
  const games = [
    makeGame('early', '2026-07-05', '09:00'),
    makeGame('late', '2026-07-05', '17:00'),
    makeGame('mid', '2026-07-05', '15:00'),
    makeGame('noon', '2026-07-05', '13:00'),
  ];
  const sorted = sortGamesByDateDesc(games);
  assert(
    sorted.map((g) => g.id).join(',') === 'late,mid,noon,early',
    `same-day time desc: got ${sorted.map((g) => g.id).join(',')}`
  );
}

function testMissingStartTimeSortsLastWithinDay(): void {
  const games = [
    makeGame('untimed', '2026-07-05'),
    makeGame('timed', '2026-07-05', '11:00'),
  ];
  const sorted = sortGamesByDateDesc(games);
  assert(sorted[0]?.id === 'timed', 'timed game before untimed on same day');
  assert(sorted[1]?.id === 'untimed', 'untimed game last on same day');
}

function testSameDateAndTimeUsesIdTiebreaker(): void {
  const games = [
    makeGame('game-a', '2026-07-01', '14:00'),
    makeGame('game-z', '2026-07-01', '14:00'),
    makeGame('game-m', '2026-07-01', '14:00'),
  ];
  const sorted = sortGamesByDateDesc(games);
  assert(
    sorted.map((g) => g.id).join(',') === 'game-z,game-m,game-a',
    `id tiebreaker desc: got ${sorted.map((g) => g.id).join(',')}`
  );
}

function testDoesNotMutateInput(): void {
  const games = [
    makeGame('b', '2026-07-02', '11:00'),
    makeGame('a', '2026-07-01', '12:00'),
  ];
  const copy = [...games];
  sortGamesByDateDesc(games);
  assert(games[0]?.id === copy[0]?.id, 'input array order unchanged');
}

function main(): void {
  testDateDesc();
  testTimeDescWithinSameDate();
  testMissingStartTimeSortsLastWithinDay();
  testSameDateAndTimeUsesIdTiebreaker();
  testDoesNotMutateInput();
  console.log('test-game-sort: all checks passed');
}

main();
