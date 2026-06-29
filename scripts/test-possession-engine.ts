/**
 * Unit tests for possession engine + GameLogic advanced metrics.
 * Run: npm run test:possession-engine
 */

import type { Game, GameEvent } from '../src/App';
import { GameLogic } from '../src/utils/GameLogic';
import {
  derivePossessionSnapshot,
  possessionContextForScoringTeam,
} from '../src/liveEntry/possessionEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makeEvent(partial: Partial<GameEvent> & Pick<GameEvent, 'type'>): GameEvent {
  return {
    id: `ev-${Math.random()}`,
    timestamp: Date.now(),
    period: 1,
    gameTime: '10:00',
    teamId: 'home',
    details: {},
    homeScore: 0,
    awayScore: 0,
    ...partial,
  };
}

function emptyTeamStats(teamId: string) {
  return {
    teamId,
    q1_points: 0, q2_points: 0, q3_points: 0, q4_points: 0, ot_points: 0,
    total_points: 0, fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
    two_made: 0, two_attempted: 0, ft_made: 0, ft_attempted: 0,
    orb: 0, drb: 0, team_rebounds: 0, total_rebounds: 0,
    assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0,
    points_off_turnovers: null, points_in_paint: null, second_chance_points: null,
    fastbreak_points: null, bench_points: null, biggest_lead: null, biggest_scoring_run: null,
    team_coach: { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
  };
}

function emptyGame(): Game {
  return {
    id: 'g1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'AWY', players: [] },
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
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function testTurnoverSetsOffTurnoverFlag(): void {
  const game = emptyGame();
  const to = makeEvent({
    type: 'turnover',
    teamId: 'home',
    playerId: 'p1',
    details: {},
  });
  const snap = derivePossessionSnapshot(game, [to]);
  assert(snap.offTurnoverTeamId === 'away', 'away gets PtsOffTO after home TO');
  assert(snap.offenseTeamId === 'away', 'away has possession');
}

function testOrbSetsSecondChance(): void {
  const game = emptyGame();
  const orb = makeEvent({
    type: 'rebound',
    teamId: 'home',
    playerId: 'p1',
    details: { reboundType: 'offensive' },
  });
  const snap = derivePossessionSnapshot(game, [orb]);
  assert(snap.secondChanceTeamId === 'home', 'home gets 2nd chance after ORB');
}

function testDrbClearsSecondChance(): void {
  const game = emptyGame();
  const orb = makeEvent({
    type: 'rebound',
    teamId: 'home',
    details: { reboundType: 'offensive' },
  });
  const drb = makeEvent({
    type: 'rebound',
    teamId: 'away',
    details: { reboundType: 'defensive' },
  });
  const snap = derivePossessionSnapshot(game, [orb, drb]);
  assert(snap.secondChanceTeamId === null, 'DRB clears second chance');
}

function testScoringAppliesPtsOffTurnover(): void {
  let game = emptyGame();
  game = GameLogic.recordEvent(
    game,
    makeEvent({ type: 'turnover', teamId: 'home', playerId: 'p1', details: {} })
  );
  game = GameLogic.recordEvent(
    game,
    makeEvent({
      type: 'shot_attempt',
      teamId: 'away',
      playerId: 'p2',
      details: { made: true, isThree: false, inPaint: false },
    })
  );
  assert(
    game.teamStats.away.points_off_turnovers === 2,
    'away scores 2 PtsOffTO after steal/TO'
  );
}

function testScoringAppliesSecondChance(): void {
  let game = emptyGame();
  game = GameLogic.recordEvent(
    game,
    makeEvent({
      type: 'rebound',
      teamId: 'home',
      playerId: 'p1',
      details: { reboundType: 'offensive' },
    })
  );
  game = GameLogic.recordEvent(
    game,
    makeEvent({
      type: 'shot_attempt',
      teamId: 'home',
      playerId: 'p1',
      details: { made: true, isThree: true, inPaint: false },
    })
  );
  assert(
    game.teamStats.home.second_chance_points === 3,
    'home 3PT counts as second chance'
  );
}

function testPossessionContextForScoring(): void {
  const game = emptyGame();
  const events = [
    makeEvent({ type: 'turnover', teamId: 'home', details: {} }),
  ];
  const ctx = possessionContextForScoringTeam(game, events, 'away');
  assert(ctx.offTurnover === true, 'context offTurnover for recovering team');
}

function main(): void {
  testTurnoverSetsOffTurnoverFlag();
  testOrbSetsSecondChance();
  testDrbClearsSecondChance();
  testScoringAppliesPtsOffTurnover();
  testScoringAppliesSecondChance();
  testPossessionContextForScoring();
  console.log('All possession engine tests passed.');
}

main();
