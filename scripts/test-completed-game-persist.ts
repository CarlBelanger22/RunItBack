/**
 * Completed-game persist guards.
 * Run: npm run test:completed-game-persist
 */

import {
  buildCompletedGamePayload,
  finalScoreFromPlayerPoints,
  mergeGamesPreferCompleted,
} from '../src/lib/completedGamePersist';
import type { Game, Player, Team } from '../src/App';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function player(id: string, ptsOnStats = false): Player {
  return {
    id,
    name: id,
    number: 1,
    position: 'G',
    height: '',
    weight: '',
    age: 0,
  };
}

function team(id: string, players: Player[]): Team {
  return { id, name: id, abbreviation: id.slice(0, 3).toUpperCase(), players };
}

function baseGame(overrides: Partial<Game> = {}): Game {
  const home = team('home', [player('h1')]);
  const away = team('away', [player('a1')]);
  return {
    id: 'g1',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: 'home',
    awayTeamId: 'away',
    date: '2026-09-07',
    gameStats: [
      {
        playerId: 'h1',
        points: 66,
        fg_made: 0,
        fg_attempted: 0,
        three_made: 0,
        three_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
        orb: 0,
        drb: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        tech_fouls: 0,
        unsportsmanlike_fouls: 0,
        fouls_drawn: 0,
        blocks_received: 0,
        plus_minus: 0,
        minutes_played: 0,
      },
      {
        playerId: 'a1',
        points: 64,
        fg_made: 0,
        fg_attempted: 0,
        three_made: 0,
        three_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
        orb: 0,
        drb: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        tech_fouls: 0,
        unsportsmanlike_fouls: 0,
        fouls_drawn: 0,
        blocks_received: 0,
        plus_minus: 0,
        minutes_played: 0,
      },
    ],
    teamStats: { home: {} as never, away: {} as never },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '0:38',
    homeStarters: ['h1'],
    awayStarters: ['a1'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
    ...overrides,
  };
}

function main(): void {
  const active = baseGame({ isActive: true, isCompleted: false });
  const completed = buildCompletedGamePayload(active, { home: 66, away: 64 });
  assert(completed.isCompleted && !completed.isActive, 'completed payload flags');
  assert(completed.finalScore?.home === 66, 'final home');

  const completedWinsOverActive = mergeGamesPreferCompleted([completed], [active]);
  assert(completedWinsOverActive.length === 1, 'one game a');
  assert(
    completedWinsOverActive[0].isCompleted === true,
    'completed wins when listed before active'
  );

  const activeThenCompleted = mergeGamesPreferCompleted([active], [completed]);
  assert(
    activeThenCompleted[0].isCompleted === true,
    'completed wins when listed after active'
  );

  const twoCompleted = mergeGamesPreferCompleted(
    [buildCompletedGamePayload(active, { home: 60, away: 50 })],
    [completed]
  );
  assert(
    twoCompleted[0].finalScore?.home === 66,
    'later completed replaces earlier completed'
  );

  const score = finalScoreFromPlayerPoints(active);
  assert(score.home === 66 && score.away === 64, 'score from player points');

  console.log('PASS: test-completed-game-persist');
}

main();
