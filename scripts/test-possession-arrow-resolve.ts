/**
 * Possession arrow derive / resolve on load.
 * Run: npm run test:possession-arrow-resolve
 */

import type { Game, GameEvent } from '../src/App';
import {
  applyResolvedPossessionArrow,
  derivePossessionArrowTeamId,
  resolvePossessionArrowTeamId,
} from '../src/liveEntry/possessionArrow';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseGame(events: GameEvent[] = []): Game {
  return {
    id: 'g1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'AWY', players: [] },
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { teamId: 'home', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events,
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

function testOpeningTipDerivesLoser(): void {
  const events: GameEvent[] = [
    {
      id: 'jb1',
      type: 'jump_ball',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: {
        kind: 'opening',
        winnerTeamId: 'home',
        arrowAfterTeamId: 'away',
      },
      homeScore: 0,
      awayScore: 0,
    },
  ];
  assert(
    derivePossessionArrowTeamId(events) === 'away',
    'opening tip → arrow at loser'
  );
}

function testHeldBallFlipsArrow(): void {
  const events: GameEvent[] = [
    {
      id: 'jb1',
      type: 'jump_ball',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { kind: 'opening', arrowAfterTeamId: 'away' },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'jb2',
      type: 'jump_ball',
      timestamp: 2,
      period: 1,
      gameTime: '8:00',
      teamId: 'home',
      details: { kind: 'held_ball', arrowAfterTeamId: 'home' },
      homeScore: 10,
      awayScore: 8,
    },
  ];
  assert(
    derivePossessionArrowTeamId(events) === 'home',
    'held ball flips arrow to home'
  );
}

function testPeriodStartArrow(): void {
  const events: GameEvent[] = [
    {
      id: 'jb1',
      type: 'jump_ball',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { kind: 'opening', arrowAfterTeamId: 'away' },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'ps2',
      type: 'period_start',
      timestamp: 2,
      period: 2,
      gameTime: '10:00',
      teamId: 'away',
      details: {
        period: 2,
        possessionTeamId: 'away',
        arrowAfterTeamId: 'home',
      },
      homeScore: 20,
      awayScore: 18,
    },
  ];
  assert(
    derivePossessionArrowTeamId(events) === 'home',
    'period_start arrowAfter updates arrow'
  );
}

function testResolvePrefersEventsOverStaleStored(): void {
  const events: GameEvent[] = [
    {
      id: 'jb1',
      type: 'jump_ball',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { kind: 'opening', arrowAfterTeamId: 'away' },
      homeScore: 0,
      awayScore: 0,
    },
  ];
  assert(
    resolvePossessionArrowTeamId(
      { possessionArrowTeamId: 'home' },
      events
    ) === 'away',
    'events override stale stored arrow'
  );
}

function testResolveUsesStoredWhenNoEvents(): void {
  assert(
    resolvePossessionArrowTeamId({ possessionArrowTeamId: 'home' }, []) ===
      'home',
    'stored arrow when events have no arrow'
  );
}

function testApplyDoesNotMutateEvents(): void {
  const events: GameEvent[] = [
    {
      id: 'jb1',
      type: 'jump_ball',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { kind: 'opening', arrowAfterTeamId: 'away' },
      homeScore: 0,
      awayScore: 0,
    },
  ];
  const before = baseGame(events);
  const after = applyResolvedPossessionArrow(before);
  assert(after.possessionArrowTeamId === 'away', 'apply sets arrow');
  assert(after.events === before.events, 'events array unchanged');
  assert(after.events.length === 1, 'event count unchanged');
  assert(
    after.gameStats === before.gameStats,
    'gameStats reference unchanged'
  );
}

function main(): void {
  testOpeningTipDerivesLoser();
  testHeldBallFlipsArrow();
  testPeriodStartArrow();
  testResolvePrefersEventsOverStaleStored();
  testResolveUsesStoredWhenNoEvents();
  testApplyDoesNotMutateEvents();
  console.log('All possession arrow resolve tests passed.');
}

main();
