/**
 * Minutes engine acceptance test — user quarter walkthrough.
 * Run: npm run test:minutes-engine
 */

import type { Game } from '../src/App';
import {
  applySubstitutionCheckpoint,
  flushStintToClock,
  initialMinutesState,
  minutesToDisplay,
  replayMinutesOntoGame,
  startPeriodLineups,
} from '../src/liveEntry/minutesEngine';
import { buildPeriodEndEvent, buildSubstitutionEvent } from '../src/liveEntry/liveEntryActions';
import { GameLogic } from '../src/utils/GameLogic';

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

function makeGame(): Game {
  const homeIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const awayIds = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  return {
    id: 'g-minutes',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: {
      id: 'home',
      name: 'Home',
      abbreviation: 'HOM',
      players: homeIds.map((id) => ({ id, name: `Player ${id}`, number: 0 })),
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      players: awayIds.map((id) => ({ id, name: `Player ${id}`, number: 0 })),
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
    homeStarters: ['A', 'B', 'C', 'D', 'E'],
    awayStarters: ['P1', 'P2', 'P3', 'P4', 'P5'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
    clockSettings: {
      regulationPeriods: 4,
      regulationPeriodMinutes: 10,
      overtimePeriodMinutes: 5,
    },
  };
}

function minFor(game: Game, playerId: string): string {
  const stats = game.gameStats.find((s) => s.playerId === playerId);
  return minutesToDisplay(stats?.minutes_played ?? 0);
}

function scores(game: Game) {
  return {
    home: game.teamStats.home.total_points,
    away: game.teamStats.away.total_points,
  };
}

function testUserQuarterWalkthrough(): void {
  let game = makeGame();
  let state = initialMinutesState(game);
  const s = scores(game);

  // Sub at 4:55 — A,B out for F,G
  let r = applySubstitutionCheckpoint(game, state, {
    teamId: 'home',
    outIds: ['A', 'B'],
    inIds: ['F', 'G'],
    clockTime: '4:55',
    onCourtHome: state.onCourtHome,
    onCourtAway: state.onCourtAway,
  }, s);
  game = r.game;
  state = r.state;

  assert(minFor(game, 'A') === '5:05', `A after first sub: ${minFor(game, 'A')}`);
  assert(minFor(game, 'C') === '5:05', `C after first sub: ${minFor(game, 'C')}`);
  assert(minFor(game, 'P2') === '5:05', `P2 after first sub: ${minFor(game, 'P2')}`);
  assert(minFor(game, 'F') === '0:00', `F just in: ${minFor(game, 'F')}`);
  assert(game.currentGameTime === '4:55', 'clock after first sub');

  // Sub at 2:15 — C,D out for H,A
  r = applySubstitutionCheckpoint(game, state, {
    teamId: 'home',
    outIds: ['C', 'D'],
    inIds: ['H', 'A'],
    clockTime: '2:15',
    onCourtHome: state.onCourtHome,
    onCourtAway: state.onCourtAway,
  }, s);
  game = r.game;
  state = r.state;

  assert(minFor(game, 'A') === '5:05', `A re-entry stint not credited yet: ${minFor(game, 'A')}`);
  assert(minFor(game, 'C') === '7:45', `C after second sub: ${minFor(game, 'C')}`);
  assert(minFor(game, 'E') === '7:45', `E after second sub: ${minFor(game, 'E')}`);
  assert(minFor(game, 'F') === '2:40', `F after second sub: ${minFor(game, 'F')}`);

  // Opponent sub at 0:30 — P1 out for P6
  r = applySubstitutionCheckpoint(game, state, {
    teamId: 'away',
    outIds: ['P1'],
    inIds: ['P6'],
    clockTime: '0:30',
    onCourtHome: state.onCourtHome,
    onCourtAway: state.onCourtAway,
  }, s);
  game = r.game;
  state = r.state;

  assert(minFor(game, 'A') === '6:50', `A after opp sub: ${minFor(game, 'A')}`);
  assert(minFor(game, 'E') === '9:30', `E after opp sub: ${minFor(game, 'E')}`);
  assert(minFor(game, 'P1') === '9:30', `P1 after opp sub: ${minFor(game, 'P1')}`);
  assert(minFor(game, 'P6') === '0:00', `P6 just in: ${minFor(game, 'P6')}`);

  // End quarter — flush to 0:00
  r = flushStintToClock(game, state, '0:00', s);
  game = r.game;
  state = r.state;

  assert(minFor(game, 'A') === '7:20', `A end Q: ${minFor(game, 'A')}`);
  assert(minFor(game, 'B') === '5:05', `B end Q: ${minFor(game, 'B')}`);
  assert(minFor(game, 'C') === '7:45', `C end Q: ${minFor(game, 'C')}`);
  assert(minFor(game, 'D') === '7:45', `D end Q: ${minFor(game, 'D')}`);
  assert(minFor(game, 'E') === '10:00', `E end Q: ${minFor(game, 'E')}`);
  assert(minFor(game, 'F') === '4:55', `F end Q: ${minFor(game, 'F')}`);
  assert(minFor(game, 'G') === '4:55', `G end Q: ${minFor(game, 'G')}`);
  assert(minFor(game, 'H') === '2:15', `H end Q: ${minFor(game, 'H')}`);
  assert(minFor(game, 'P1') === '9:30', `P1 end Q: ${minFor(game, 'P1')}`);
  assert(minFor(game, 'P2') === '10:00', `P2 end Q: ${minFor(game, 'P2')}`);
  assert(minFor(game, 'P6') === '0:30', `P6 end Q: ${minFor(game, 'P6')}`);
}

function testReplayFromEvents(): void {
  let game = makeGame();
  const s = scores(game);

  const sub1 = buildSubstitutionEvent(game, 'home', ['A', 'B'], ['F', 'G'], '4:55', '10:00');
  game = GameLogic.recordEvent(game, sub1);

  const sub2 = buildSubstitutionEvent(game, 'home', ['C', 'D'], ['H', 'A'], '2:15', '4:55');
  game = GameLogic.recordEvent(game, sub2);

  const sub3 = buildSubstitutionEvent(game, 'away', ['P1'], ['P6'], '0:30', '2:15');
  game = GameLogic.recordEvent(game, sub3);

  const end = buildPeriodEndEvent(game, 1);
  game = GameLogic.recordEvent(game, end);

  const replayed = replayMinutesOntoGame(game).game;
  assert(minFor(replayed, 'E') === '10:00', `replay E: ${minFor(replayed, 'E')}`);
  assert(minFor(replayed, 'A') === '7:20', `replay A: ${minFor(replayed, 'A')}`);
  assert(minFor(replayed, 'P2') === '10:00', `replay P2: ${minFor(replayed, 'P2')}`);
}

function testPeriodStartResetsClock(): void {
  let game = makeGame();
  let state = initialMinutesState(game);
  const flushed = flushStintToClock(game, state, '0:00', scores(game));
  const started = startPeriodLineups(flushed.game, 2, ['A', 'B', 'C', 'D', 'E'], ['P1', 'P2', 'P3', 'P4', 'P5']);
  assert(started.game.currentPeriod === 2, 'period 2');
  assert(started.game.currentGameTime === '10:00', 'Q2 clock reset');
  assert(started.state.onCourtHome.join(',') === 'A,B,C,D,E', 'home lineup');
}

function testReplayPlusMinusAfterScoringThenSub(): void {
  let game = makeGame();

  const recordMake = (playerId: string, teamId: string, isThree: boolean) => {
    game = GameLogic.recordEvent(game, {
      id: `ev-${Math.random()}`,
      type: 'shot_attempt',
      timestamp: Date.now(),
      period: 1,
      gameTime: '10:00',
      teamId,
      playerId,
      details: { made: true, isThree, inPaint: false },
      homeScore: 0,
      awayScore: 0,
    });
  };

  recordMake('A', 'home', false);
  recordMake('A', 'home', true);

  const sub = buildSubstitutionEvent(game, 'home', ['A', 'B'], ['F', 'G'], '4:55', '10:00');
  game = GameLogic.recordEvent(game, sub);

  const replayed = replayMinutesOntoGame(game).game;
  const homePm = replayed.gameStats.find((s) => s.playerId === 'A')?.plus_minus ?? 0;
  const awayPm = replayed.gameStats.find((s) => s.playerId === 'P1')?.plus_minus ?? 0;
  assert(homePm === 5, `home starter +/- after 5-0 stint: ${homePm}`);
  assert(awayPm === -5, `away starter +/- after 5-0 stint: ${awayPm}`);
}

function testPlusMinusOnScoringStint(): void {
  let game = makeGame();
  let state = initialMinutesState(game);
  game.teamStats.home.total_points = 10;
  game.teamStats.away.total_points = 6;
  const scores = { home: 10, away: 6 };

  const flushed = flushStintToClock(game, state, '5:00', scores);
  game = flushed.game;

  const homePm = game.gameStats.find((s) => s.playerId === 'A')?.plus_minus ?? 0;
  const awayPm = game.gameStats.find((s) => s.playerId === 'P1')?.plus_minus ?? 0;
  assert(homePm === 4, `home +/- stint: ${homePm}`);
  assert(awayPm === -4, `away +/- stint: ${awayPm}`);
}

function main(): void {
  testUserQuarterWalkthrough();
  testReplayFromEvents();
  testPeriodStartResetsClock();
  testPlusMinusOnScoringStint();
  testReplayPlusMinusAfterScoringThenSub();
  console.log('All minutes-engine tests passed.');
}

main();
