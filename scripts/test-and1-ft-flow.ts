/**
 * And-1 shot → foul → free throw flow tests.
 * Run: npm run test:and1-ft-flow
 */

import type { Game, GameEvent } from '../src/App';
import { GameLogic } from '../src/utils/GameLogic';
import { buildFreeThrowEvent, buildFoulEvent } from '../src/liveEntry/liveEntryActions';
import {
  initialLiveEntryContext,
  liveEntryReducer,
  type LiveEntryState,
} from '../src/liveEntry/liveEntryStateMachine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const courtZone = {
  zone: 'paint' as const,
  isPaint: true,
  shotValue: 2 as const,
  distanceFromHoopM: 2,
};

function baseState(): LiveEntryState {
  return {
    phase: { kind: 'idle' },
    ctx: initialLiveEntryContext('home', ['h1', 'h2'], ['a1']),
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
        { id: 'h1', name: 'Shooter', number: 1 },
        { id: 'h2', name: 'Assister', number: 2 },
      ],
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
      home: { teamId: 'home', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: ['h1', 'h2'],
    awayStarters: ['a1'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function testMakeAssistReachesFastbreak(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'COURT_CLICK',
    point: { xM: 7.5, yM: 2 },
    zone: courtZone,
  });
  state = liveEntryReducer(state, { type: 'SHOT_OUTCOME', outcome: 'make' });
  state = liveEntryReducer(state, { type: 'PICK_SHOOTER', playerId: 'h1' });
  state = liveEntryReducer(state, { type: 'PICK_ASSIST', playerId: 'h2' });

  assert(state.phase.kind === 'shot' && state.phase.step === 'fastbreak', 'assist → fastbreak');
  assert(state.ctx.pendingShot?.shooterId === 'h1', 'shooter retained');
  assert(state.ctx.pendingShot?.assistId === 'h2', 'assist retained');
}

function testAnd1FoulPhaseWithoutIdleReset(): void {
  let state: LiveEntryState = {
    phase: { kind: 'shot', step: 'fastbreak' },
    ctx: {
      ...initialLiveEntryContext('home', ['h1', 'h2'], ['a1']),
      pendingShot: {
        point: { xM: 7.5, yM: 2 },
        zone: 'paint',
        isPaint: true,
        isThree: false,
        shotValue: 2,
        outcome: 'make',
        shooterId: 'h1',
        assistId: 'h2',
      },
    },
  };

  state = liveEntryReducer(state, { type: 'START_FOUL' });
  assert(state.phase.kind === 'foul' && state.phase.step === 'entity', 'and-1 uses START_FOUL');

  state = liveEntryReducer(state, { type: 'FOUL_CATEGORY', category: 'personal' });
  assert(
    state.phase.kind === 'foul' && state.phase.step === 'committer',
    'FOUL_CATEGORY → committer without idle reset'
  );
}

function testAnd1FtPhase(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'START_FT',
    shootingTeamId: 'home',
    playerId: 'h1',
    ftTotal: 1,
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  assert(state.phase.kind === 'free_throw', 'START_FT → free_throw phase');
  assert(
    state.phase.kind === 'free_throw' && state.phase.ftIndex === 1 && state.phase.ftTotal === 1,
    'FT 1 of 1'
  );
}

function testAnd1FtMakeAddsPoint(): void {
  let game = baseGame();
  const foul = buildFoulEvent(game, {
    foulingTeamId: 'away',
    committerId: 'a1',
    recipientId: 'h1',
    foulCategory: 'personal',
    isTeamFoul: false,
    isCoachFoul: false,
    retainPossession: false,
    offendedTeamId: 'home',
  });
  game = GameLogic.recordEvent(game, foul);

  const ft = buildFreeThrowEvent(game, 'home', 'h1', true, 1, 1, {
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  game = GameLogic.recordEvent(game, ft);

  assert(game.teamStats.home.total_points === 1, 'FT make adds 1 point');
  assert(game.events.some((e) => e.type === 'free_throw'), 'FT event recorded');
}

function testCourtClickBlockedDuringFt(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'START_FT',
    shootingTeamId: 'home',
    playerId: 'h1',
    ftTotal: 1,
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  const before = state;
  state = liveEntryReducer(state, {
    type: 'COURT_CLICK',
    point: { xM: 1, yM: 1 },
    zone: { zone: 'three', isPaint: false, shotValue: 3, distanceFromHoopM: 9 },
  });
  assert(state === before, 'court click ignored during free_throw');
}

function testAdvanceFt(): void {
  let state = liveEntryReducer(baseState(), {
    type: 'START_FT',
    shootingTeamId: 'home',
    playerId: 'h1',
    ftTotal: 2,
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  assert(
    state.phase.kind === 'free_throw' && state.phase.ftIndex === 1,
    'FT starts at 1 of 2'
  );
  state = liveEntryReducer(state, { type: 'ADVANCE_FT' });
  assert(
    state.phase.kind === 'free_throw' && state.phase.ftIndex === 2,
    'ADVANCE_FT increments index'
  );
}

function testTwoFtMakeSequence(): void {
  let game = baseGame();
  const foul = buildFoulEvent(game, {
    foulingTeamId: 'away',
    committerId: 'a1',
    recipientId: 'h1',
    foulCategory: 'personal',
    isTeamFoul: false,
    isCoachFoul: false,
    retainPossession: false,
    offendedTeamId: 'home',
  });
  game = GameLogic.recordEvent(game, foul);

  const ft1 = buildFreeThrowEvent(game, 'home', 'h1', true, 1, 2, {
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  game = GameLogic.recordEvent(game, ft1);
  assert(game.teamStats.home.total_points === 1, 'first FT make adds 1');

  const ft2 = buildFreeThrowEvent(game, 'home', 'h1', true, 2, 2, {
    retainPossession: false,
    offendedTeamId: 'home',
    possessionTeamAfterFt: 'away',
  });
  game = GameLogic.recordEvent(game, ft2);
  assert(game.teamStats.home.total_points === 2, 'second FT make adds another');
  assert(game.events.filter((e) => e.type === 'free_throw').length === 2, 'two FT events');
}

function main(): void {
  testMakeAssistReachesFastbreak();
  testAnd1FoulPhaseWithoutIdleReset();
  testAnd1FtPhase();
  testAdvanceFt();
  testAnd1FtMakeAddsPoint();
  testTwoFtMakeSequence();
  testCourtClickBlockedDuringFt();
  console.log('All and-1 / FT flow tests passed.');
}

main();
