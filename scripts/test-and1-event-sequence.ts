/**
 * And-1 must persist shot_attempt before foul + FT (no stale-game overwrite).
 * Run: npm run test:and1-event-sequence
 */

import type { Game } from '../src/App';
import { GameLogic } from '../src/utils/GameLogic';
import {
  buildFreeThrowEvent,
  buildFoulEvent,
  buildShotEvent,
} from '../src/liveEntry/liveEntryActions';
import type { PendingShot } from '../src/liveEntry/liveEntryStateMachine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function emptyTeamStats(teamId: string): Game['teamStats']['home'] {
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    two_made: 0,
    two_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    team_rebounds: 0,
    total_rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    points_off_turnovers: null,
    points_in_paint: null,
    second_chance_points: null,
    fastbreak_points: null,
    bench_points: null,
    biggest_lead: null,
    biggest_scoring_run: null,
  };
}

function baseGame(): Game {
  return {
    id: 'g1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: {
      id: 'home',
      name: 'Home',
      abbreviation: 'HOM',
      players: [{ id: 'h1', name: 'Shooter', number: 1 }],
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      players: [{ id: 'a1', name: 'Fouler', number: 3 }],
    },
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: emptyTeamStats('home'),
      away: emptyTeamStats('away'),
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: ['h1'],
    awayStarters: ['a1'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

const pendingThree: PendingShot = {
  point: { xM: 6.75, yM: 0 },
  zone: 'three',
  isPaint: false,
  isThree: true,
  shotValue: 3,
  outcome: 'make',
  shooterId: 'h1',
  assistId: null,
};

/** Simulates commitFoul reading stale pre-shot game (the live bug). */
function recordAnd1WithStaleFoulBase(staleBase: Game, afterShot: Game): Game {
  const foul = buildFoulEvent(staleBase, {
    foulingTeamId: 'away',
    committerId: 'a1',
    recipientId: 'h1',
    foulCategory: 'personal',
    retainPossession: false,
    offendedTeamId: 'home',
  });
  return GameLogic.recordEvent(staleBase, foul);
}

/** Simulates fixed pipeline: foul appended to game that already has the shot. */
function recordAnd1WithFreshBase(afterShot: Game): Game {
  const foul = buildFoulEvent(afterShot, {
    foulingTeamId: 'away',
    committerId: 'a1',
    recipientId: 'h1',
    foulCategory: 'personal',
    retainPossession: false,
    offendedTeamId: 'home',
  });
  let g = GameLogic.recordEvent(afterShot, foul);
  const ft = buildFreeThrowEvent(g, 'home', 'h1', true, 1, 1, {
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  g = GameLogic.recordEvent(g, ft);
  return g;
}

function testStaleBaseDropsShotEvent(): void {
  const staleBase = baseGame();
  const built = buildShotEvent(staleBase, 'home', pendingThree)!;
  const afterShot = GameLogic.recordEvent(
    { ...staleBase, shots: [built.shot] },
    built.event
  );

  const buggy = recordAnd1WithStaleFoulBase(staleBase, afterShot);
  assert(buggy.events.length === 1, 'stale foul overwrites — only foul event');
  assert(buggy.events[0]?.type === 'foul', 'stale foul overwrites — foul only');
  assert(
    !buggy.events.some((e) => e.type === 'shot_attempt'),
    'stale foul overwrites — shot_attempt missing'
  );
}

function testFreshBaseKeepsFullAnd1Sequence(): void {
  const staleBase = baseGame();
  const built = buildShotEvent(staleBase, 'home', pendingThree)!;
  const afterShot = GameLogic.recordEvent(
    { ...staleBase, shots: [built.shot] },
    built.event
  );

  const fixed = recordAnd1WithFreshBase(afterShot);
  assert(fixed.events.length === 3, 'fixed pipeline — three events');
  assert(fixed.events[0]?.type === 'shot_attempt', 'event 1 shot');
  assert(fixed.events[1]?.type === 'foul', 'event 2 foul');
  assert(fixed.events[2]?.type === 'free_throw', 'event 3 FT');

  const shooterStats = fixed.gameStats.find((s) => s.playerId === 'h1');
  assert(shooterStats?.points === 4, '3PT + FT → 4 pts');
  assert(shooterStats?.three_made === 1, '3PT made');
  assert(shooterStats?.ft_made === 1, 'FT made');
  assert(fixed.teamStats.home.total_points === 4, 'home score 4');

  const foul = fixed.events[1];
  assert(foul?.details.drawnBy === 'h1', 'foul drawnBy shooter');
}

function main(): void {
  testStaleBaseDropsShotEvent();
  testFreshBaseKeepsFullAnd1Sequence();
  console.log('All and-1 event sequence tests passed.');
}

main();
