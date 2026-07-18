/**
 * PBP edit helpers + replay correctness (LE-37).
 * Run: npm run test:pbp-edit
 */

import type { Game, GameEvent } from '../src/App';
import { GameLogic } from '../src/utils/GameLogic';
import {
  canEditShotFields,
  stripPossessionContext,
} from '../src/liveEntry/eventEditGuards';
import {
  getLineupStateBeforeEvent,
  replayMinutesOntoGame,
} from '../src/liveEntry/minutesEngine';

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
      players: [
        { id: 'h1', name: 'H1', number: 1 },
        { id: 'h2', name: 'H2', number: 2 },
        { id: 'h3', name: 'H3', number: 3 },
        { id: 'h4', name: 'H4', number: 4 },
        { id: 'h5', name: 'H5', number: 5 },
        { id: 'h6', name: 'H6', number: 6 },
      ],
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      players: [
        { id: 'a1', name: 'A1', number: 1 },
        { id: 'a2', name: 'A2', number: 2 },
        { id: 'a3', name: 'A3', number: 3 },
        { id: 'a4', name: 'A4', number: 4 },
        { id: 'a5', name: 'A5', number: 5 },
      ],
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
    homeStarters: ['h1', 'h2', 'h3', 'h4', 'h5'],
    awayStarters: ['a1', 'a2', 'a3', 'a4', 'a5'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function replay(game: Game, events: GameEvent[]): Game {
  const cleaned = stripPossessionContext(events);
  const base = GameLogic.replayFromEvents(game, cleaned);
  return replayMinutesOntoGame(base).game;
}

function testShotRelocate3to2(): void {
  const game = baseGame();
  const shot: GameEvent = {
    id: 's1',
    type: 'shot_attempt',
    timestamp: 1,
    period: 1,
    gameTime: '9:00',
    teamId: 'home',
    playerId: 'h1',
    details: {
      made: true,
      isThree: true,
      inPaint: false,
      x: 10,
      y: 80,
    },
    homeScore: 0,
    awayScore: 0,
  };
  let g = replay(game, [shot]);
  assert(g.gameStats.find((s) => s.playerId === 'h1')?.points === 3, '3PT credits 3');
  assert(g.gameStats.find((s) => s.playerId === 'h1')?.three_made === 1, '3PT made');

  const relocated = {
    ...shot,
    details: { ...shot.details, isThree: false, inPaint: false, x: 40, y: 40 },
  };
  g = replay(game, [relocated]);
  assert(g.gameStats.find((s) => s.playerId === 'h1')?.points === 2, 'relocated 2PT credits 2');
  assert(g.gameStats.find((s) => s.playerId === 'h1')?.three_made === 0, 'no 3PT after relocate');
  assert(g.gameStats.find((s) => s.playerId === 'h1')?.fg_made === 1, 'FG made after relocate');
  assert(g.teamStats.home.two_made === 1, 'team 2PT made after relocate');
  assert(g.teamStats.home.three_made === 0, 'team no 3PT after relocate');
}

function testShotPlayerSwap(): void {
  const game = baseGame();
  const shot: GameEvent = {
    id: 's1',
    type: 'shot_attempt',
    timestamp: 1,
    period: 1,
    gameTime: '9:00',
    teamId: 'home',
    playerId: 'h1',
    details: { made: true, isThree: false, inPaint: true, x: 50, y: 20 },
    homeScore: 0,
    awayScore: 0,
  };
  const swapped = { ...shot, playerId: 'h2' };
  const g = replay(game, [swapped]);
  assert((g.gameStats.find((s) => s.playerId === 'h1')?.points ?? 0) === 0, 'old shooter uncredited');
  assert(g.gameStats.find((s) => s.playerId === 'h2')?.points === 2, 'new shooter credited');
}

function testFoulDrawnBySwap(): void {
  const game = baseGame();
  const foul: GameEvent = {
    id: 'f1',
    type: 'foul',
    timestamp: 1,
    period: 1,
    gameTime: '9:00',
    teamId: 'away',
    playerId: 'a1',
    details: {
      foulType: 'normal',
      foulCategory: 'personal',
      drawnBy: 'h1',
    },
    homeScore: 0,
    awayScore: 0,
  };
  let g = replay(game, [foul]);
  assert(g.gameStats.find((s) => s.playerId === 'h1')?.fouls_drawn === 1, 'h1 FD');

  const swapped = {
    ...foul,
    details: { ...foul.details, drawnBy: 'h2' },
  };
  g = replay(game, [swapped]);
  assert((g.gameStats.find((s) => s.playerId === 'h1')?.fouls_drawn ?? 0) === 0, 'h1 FD cleared');
  assert(g.gameStats.find((s) => s.playerId === 'h2')?.fouls_drawn === 1, 'h2 FD');
}

function testTurnoverStealerSwap(): void {
  const game = baseGame();
  const to: GameEvent = {
    id: 't1',
    type: 'turnover',
    timestamp: 1,
    period: 1,
    gameTime: '9:00',
    teamId: 'home',
    playerId: 'h1',
    details: { isTeamTurnover: false, stolenBy: 'a1' },
    homeScore: 0,
    awayScore: 0,
  };
  let g = replay(game, [to]);
  assert(g.gameStats.find((s) => s.playerId === 'a1')?.steals === 1, 'a1 steal');

  const swapped = {
    ...to,
    details: { ...to.details, stolenBy: 'a2' },
  };
  g = replay(game, [swapped]);
  assert((g.gameStats.find((s) => s.playerId === 'a1')?.steals ?? 0) === 0, 'a1 steal cleared');
  assert(g.gameStats.find((s) => s.playerId === 'a2')?.steals === 1, 'a2 steal');
}

function testSubEditLineupBefore(): void {
  const game = baseGame();
  const events: GameEvent[] = [
    {
      id: 'ps1',
      type: 'period_start',
      timestamp: 0,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: {
        period: 1,
        clockTime: '10:00',
        homeLineup: ['h1', 'h2', 'h3', 'h4', 'h5'],
        awayLineup: ['a1', 'a2', 'a3', 'a4', 'a5'],
      },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'sub1',
      type: 'substitution',
      timestamp: 1,
      period: 1,
      gameTime: '8:00',
      teamId: 'home',
      details: {
        playersOut: ['h5'],
        playersIn: ['h6'],
        clockTime: '8:00',
        checkpointFrom: '10:00',
      },
      homeScore: 0,
      awayScore: 0,
    },
  ];
  const gameWithEvents = { ...game, events };
  const before = getLineupStateBeforeEvent(gameWithEvents, 'sub1');
  assert(!!before, 'lineup before sub exists');
  assert(before!.onCourtHome.includes('h5'), 'h5 on court before sub');
  assert(!before!.onCourtHome.includes('h6'), 'h6 not on court before sub');

  // Edit: swap in h6→ still h6, change out to h4
  const edited = {
    ...events[1],
    details: {
      ...events[1].details,
      playersOut: ['h4'],
      playersIn: ['h6'],
    },
  };
  const g = replay(game, [events[0], edited]);
  // After replay, minutes engine should have h6 on court and h4 off
  // (end state from last sub)
  const mins = replayMinutesOntoGame({ ...g, events: [events[0], edited] });
  assert(mins.state.onCourtHome.includes('h6'), 'h6 on court after edited sub');
  assert(!mins.state.onCourtHome.includes('h4'), 'h4 off court after edited sub');
  assert(mins.state.onCourtHome.includes('h5'), 'h5 still on court (was not subbed)');
}

function testPossessionContextStrip(): void {
  const game = baseGame();
  const events: GameEvent[] = [
    {
      id: 'to1',
      type: 'turnover',
      timestamp: 1,
      period: 1,
      gameTime: '9:00',
      teamId: 'away',
      playerId: 'a1',
      details: { isTeamTurnover: false, stolenBy: null },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 's1',
      type: 'shot_attempt',
      timestamp: 2,
      period: 1,
      gameTime: '8:50',
      teamId: 'home',
      playerId: 'h1',
      details: {
        made: true,
        isThree: false,
        inPaint: false,
        x: 50,
        y: 40,
        // Stale context claiming NOT off-turnover (wrong after we keep the TO)
        possessionContext: { offTurnover: false, secondChance: false },
      },
      homeScore: 0,
      awayScore: 0,
    },
  ];

  // Without strip, stale context would skip re-annotation
  const stale = GameLogic.replayFromEvents(game, events.map((e) => ({ ...e, details: { ...e.details } })));
  // With strip (edit path), context is re-derived
  const cleaned = stripPossessionContext(events.map((e) => ({ ...e, details: { ...e.details } })));
  assert(
    cleaned[1].details.possessionContext === undefined,
    'strip removes possessionContext'
  );
  const fresh = GameLogic.replayFromEvents(game, cleaned);
  assert(
    fresh.teamStats.home.points_off_turnovers === 2,
    'after strip, made shot after TO counts as points off turnovers'
  );
  // Stale path may keep wrong POT depending on guard — document that strip is required
  void stale;
}

function testAnd1Guard(): void {
  const shot: GameEvent = {
    id: 's1',
    type: 'shot_attempt',
    timestamp: 1,
    period: 1,
    gameTime: '9:00',
    teamId: 'home',
    playerId: 'h1',
    details: { made: true, isThree: false },
    homeScore: 0,
    awayScore: 0,
  };
  const foul: GameEvent = {
    id: 'f1',
    type: 'foul',
    timestamp: 2,
    period: 1,
    gameTime: '9:00',
    teamId: 'away',
    playerId: 'a1',
    details: { foulType: 'normal', foulCategory: 'personal', drawnBy: 'h1' },
    homeScore: 0,
    awayScore: 0,
  };
  const events = [shot, foul];

  const miss = {
    ...shot,
    details: { ...shot.details, made: false },
  };
  const blockMiss = canEditShotFields(shot, miss, events);
  assert(!blockMiss.ok, 'and-1 blocks make→miss');

  const swapShooter = { ...shot, playerId: 'h2' };
  const blockShooter = canEditShotFields(shot, swapShooter, events);
  assert(!blockShooter.ok, 'and-1 blocks shooter change');

  const keep = {
    ...shot,
    details: { ...shot.details, isTransition: true },
  };
  const okKeep = canEditShotFields(shot, keep, events);
  assert(okKeep.ok, 'and-1 allows non-breaking field edits');
}

function main(): void {
  testShotRelocate3to2();
  testShotPlayerSwap();
  testFoulDrawnBySwap();
  testTurnoverStealerSwap();
  testSubEditLineupBefore();
  testPossessionContextStrip();
  testAnd1Guard();
  console.log('All pbp-edit tests passed.');
}

main();
