/**
 * Foul-out detection tests (LE-36.1).
 * Run: npm run test:foul-out
 */

import type { Game, GameStats } from '../src/App';
import {
  FOUL_OUT_TOTAL,
  TECH_FOUL_OUT,
  UNSPORTSMANLIKE_FOUL_OUT,
  getFouledOutOnCourt,
  isFoulOutEnabled,
  isPlayerFouledOut,
} from '../src/utils/foulOut';
import { THREE_X_THREE_TOURNAMENT_IDS } from '../src/utils/gameFormat';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function fouls(partial: Partial<GameStats>): Pick<GameStats, 'fouls' | 'tech_fouls' | 'unsportsmanlike_fouls'> {
  return {
    fouls: partial.fouls ?? 0,
    tech_fouls: partial.tech_fouls ?? 0,
    unsportsmanlike_fouls: partial.unsportsmanlike_fouls ?? 0,
  };
}

function testThresholdConstants(): void {
  assert(FOUL_OUT_TOTAL === 5, 'FOUL_OUT_TOTAL is 5');
  assert(TECH_FOUL_OUT === 2, 'TECH_FOUL_OUT is 2');
  assert(UNSPORTSMANLIKE_FOUL_OUT === 2, 'UNSPORTSMANLIKE_FOUL_OUT is 2');
}

function testFourTriggers(): void {
  // (a) 5 total fouls
  assert(isPlayerFouledOut(fouls({ fouls: 5 })), 'trigger a: 5 total fouls');
  assert(isPlayerFouledOut(fouls({ fouls: 6 })), 'trigger a: 6 total fouls');
  // (b) 2 technical
  assert(isPlayerFouledOut(fouls({ fouls: 2, tech_fouls: 2 })), 'trigger b: 2 technical');
  // (c) 2 unsportsmanlike
  assert(
    isPlayerFouledOut(fouls({ fouls: 2, unsportsmanlike_fouls: 2 })),
    'trigger c: 2 unsportsmanlike'
  );
  // (d) 1 technical + 1 unsportsmanlike
  assert(
    isPlayerFouledOut(fouls({ fouls: 2, tech_fouls: 1, unsportsmanlike_fouls: 1 })),
    'trigger d: 1 technical + 1 unsportsmanlike'
  );
}

function testBelowThreshold(): void {
  assert(!isPlayerFouledOut(fouls({ fouls: 4 })), 'below: 4 total fouls not out');
  assert(!isPlayerFouledOut(fouls({ fouls: 1, tech_fouls: 1 })), 'below: 1 technical not out');
  assert(
    !isPlayerFouledOut(fouls({ fouls: 1, unsportsmanlike_fouls: 1 })),
    'below: 1 unsportsmanlike not out'
  );
  assert(!isPlayerFouledOut(null), 'below: null stats not out');
  assert(!isPlayerFouledOut(undefined), 'below: undefined stats not out');
}

function baseGame(tournamentId?: string): Game {
  return {
    id: 'g1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    tournamentId,
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'AWY', players: [] },
    date: '2026-01-01',
    gameStats: [],
    teamStats: { home: {} as never, away: {} as never },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function statLine(playerId: string, partial: Partial<GameStats>): GameStats {
  return {
    playerId,
    points: 0,
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
    fouls: partial.fouls ?? 0,
    tech_fouls: partial.tech_fouls ?? 0,
    unsportsmanlike_fouls: partial.unsportsmanlike_fouls ?? 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: 0,
  };
}

function test5v5Enabled(): void {
  assert(isFoulOutEnabled(baseGame('tournament-summer-2024')), '5v5 tournament enables foul-out');
  assert(isFoulOutEnabled(baseGame(undefined)), 'unknown tournament defaults to 5v5 enabled');
}

function test3x3Disabled(): void {
  const threeXThreeId = [...THREE_X_THREE_TOURNAMENT_IDS][0];
  assert(!isFoulOutEnabled(baseGame(threeXThreeId)), '3×3 tournament disables foul-out');
  const game = baseGame(threeXThreeId);
  game.gameStats = [statLine('h1', { fouls: 5 })];
  assert(
    getFouledOutOnCourt(game, ['h1'], []).length === 0,
    '3×3: fouled-out player not detected (disabled)'
  );
}

function testGetFouledOutOnCourt(): void {
  const game = baseGame('tournament-summer-2024');
  game.gameStats = [
    statLine('h1', { fouls: 5 }), // out, on court
    statLine('h2', { fouls: 4 }), // not out
    statLine('hbench', { fouls: 5 }), // out but NOT on court → ignored
    statLine('a1', { tech_fouls: 1, unsportsmanlike_fouls: 1 }), // out (combo), on court
  ];
  const result = getFouledOutOnCourt(game, ['h1', 'h2'], ['a1']);
  assert(result.length === 2, 'detects exactly the 2 on-court fouled-out players');
  const h1 = result.find((r) => r.playerId === 'h1');
  const a1 = result.find((r) => r.playerId === 'a1');
  assert(!!h1 && h1.teamId === 'home', 'h1 tagged to home team');
  assert(!!a1 && a1.teamId === 'away', 'a1 tagged to away team');
  assert(!result.some((r) => r.playerId === 'hbench'), 'off-court fouled-out player excluded');
}

function main(): void {
  testThresholdConstants();
  testFourTriggers();
  testBelowThreshold();
  test5v5Enabled();
  test3x3Disabled();
  testGetFouledOutOnCourt();
  console.log('All foul-out tests passed.');
}

main();
