/**
 * Rebound team derivation after missed/blocked shots.
 * Run: npm run test:live-entry-rebound
 */

import type { Game } from '../src/App';
import {
  deriveReboundTeamsForMissedShot,
  deriveReboundTeamsFromEvents,
  resolveReboundTeams,
} from '../src/liveEntry/reboundTeams';
import type { PendingShot } from '../src/liveEntry/liveEntryStateMachine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function emptyTeamStats(teamId: string) {
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
    team_coach: { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
  };
}

function bosLalGame(): Game {
  return {
    id: 'g1',
    homeTeamId: 'bos',
    awayTeamId: 'lal',
    homeTeam: {
      id: 'bos',
      name: 'Celtics',
      abbreviation: 'BOS',
      players: [
        { id: 'tatum', name: 'Jayson Tatum', number: 0 },
        { id: 'white', name: 'Derrick White', number: 9 },
      ],
    },
    awayTeam: {
      id: 'lal',
      name: 'Lakers',
      abbreviation: 'LAL',
      players: [
        { id: 'mcgee', name: 'Javale McGee', number: 7 },
        { id: 'lebron', name: 'LeBron James', number: 23 },
      ],
    },
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: emptyTeamStats('bos'),
      away: emptyTeamStats('lal'),
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: ['tatum', 'white'],
    awayStarters: ['mcgee', 'lebron'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function pendingBlock(): PendingShot {
  return {
    point: { xM: 7.5, yM: 2 },
    zone: 'paint',
    isPaint: true,
    isThree: false,
    shotValue: 2,
    outcome: 'block',
    shooterId: 'tatum',
    blockerId: 'mcgee',
  };
}

function testBlockDerivesLalDefenseEvenWithStaleOffense(): void {
  const game = bosLalGame();
  const teams = deriveReboundTeamsForMissedShot(game, pendingBlock(), 'lal');
  assert(teams.shootingTeamId === 'bos', 'BOS shoots');
  assert(teams.defendingTeamId === 'lal', 'LAL defends after McGee block');
}

function testDrbTeamFromCtxSnapshot(): void {
  const game = bosLalGame();
  const teams = resolveReboundTeams(game, 'bos', 'lal');
  assert(teams?.defendingTeamId === 'lal', 'DRB credits LAL from ctx');
}

function testDrbTeamFromEventsWhenCtxMissing(): void {
  const game = bosLalGame();
  game.events.push({
    id: 'ev1',
    type: 'shot_attempt',
    timestamp: 1,
    period: 1,
    gameTime: '10:00',
    teamId: 'lal',
    playerId: 'tatum',
    details: { made: false, blockedBy: 'mcgee', isThree: false },
    homeScore: 0,
    awayScore: 0,
  });
  const teams = resolveReboundTeams(game, null, null);
  assert(teams?.shootingTeamId === 'bos', 'event teamId ignored when blocker present');
  assert(teams?.defendingTeamId === 'lal', 'DRB from last blocked shot');
}

function testPlainMissUsesShooterTeam(): void {
  const game = bosLalGame();
  const pending: PendingShot = {
    ...pendingBlock(),
    outcome: 'miss',
    blockerId: undefined,
  };
  const teams = deriveReboundTeamsForMissedShot(game, pending, 'lal');
  assert(teams.shootingTeamId === 'bos', 'miss ORB team from shooter');
  assert(teams.defendingTeamId === 'lal', 'miss DRB team from shooter opponent');
}

function testDeriveFromEventsPlainMiss(): void {
  const game = bosLalGame();
  game.events.push({
    id: 'ev2',
    type: 'shot_attempt',
    timestamp: 1,
    period: 1,
    gameTime: '10:00',
    teamId: 'bos',
    playerId: 'white',
    details: { made: false, isThree: true },
    homeScore: 0,
    awayScore: 0,
  });
  const teams = deriveReboundTeamsFromEvents(game);
  assert(teams?.shootingTeamId === 'bos', 'last miss shooting team');
  assert(teams?.defendingTeamId === 'lal', 'last miss defending team');
}

function main(): void {
  testBlockDerivesLalDefenseEvenWithStaleOffense();
  testDrbTeamFromCtxSnapshot();
  testDrbTeamFromEventsWhenCtxMissing();
  testPlainMissUsesShooterTeam();
  testDeriveFromEventsPlainMiss();
  console.log('All live-entry-rebound tests passed.');
}

main();
