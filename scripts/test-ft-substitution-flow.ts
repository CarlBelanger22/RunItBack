/**
 * Free-throw substitution flow tests.
 * Run: npm run test:ft-substitution-flow
 */

import type { Game } from '../src/App';
import {
  applySubstitutionCheckpoint,
  initialMinutesState,
} from '../src/liveEntry/minutesEngine';
import {
  initialLiveEntryContext,
  liveEntryReducer,
} from '../src/liveEntry/liveEntryStateMachine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
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
        { id: 'h2', name: 'Bench', number: 2 },
        { id: 'h3', name: 'Starter3', number: 3 },
        { id: 'h4', name: 'Starter4', number: 4 },
        { id: 'h5', name: 'Starter5', number: 5 },
        { id: 'h6', name: 'Starter6', number: 6 },
      ],
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      players: [
        { id: 'a1', name: 'Defender', number: 10 },
        { id: 'a2', name: 'BenchAway', number: 11 },
        { id: 'a3', name: 'StarterA3', number: 12 },
        { id: 'a4', name: 'StarterA4', number: 13 },
        { id: 'a5', name: 'StarterA5', number: 14 },
        { id: 'a6', name: 'StarterA6', number: 15 },
      ],
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
    homeStarters: ['h1', 'h3', 'h4', 'h5', 'h6'],
    awayStarters: ['a1', 'a3', 'a4', 'a5', 'a6'],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function testFtPhaseSurvivesWithoutReset(): void {
  let state = liveEntryReducer(
    {
      phase: { kind: 'idle' },
      ctx: initialLiveEntryContext('home', ['h1', 'h3'], ['a1']),
    },
    {
      type: 'START_FT',
      playerId: 'h1',
      ftTotal: 2,
      retainPossession: false,
      offendedTeamId: 'home',
      possessionTeamAfterFt: 'away',
    }
  );
  assert(state.phase.kind === 'free_throw', 'START_FT → free_throw');

  state = liveEntryReducer(state, { type: 'ADVANCE_FT' });
  assert(
    state.phase.kind === 'free_throw' &&
      state.phase.ftIndex === 2 &&
      state.phase.ftTotal === 2,
    'still awaiting FT 2 of 2 without RESET'
  );
}

function testSubstitutionUpdatesOnCourtDuringFt(): void {
  const game = baseGame();
  const state = initialMinutesState(game);
  const scores = { home: 0, away: 0 };

  const result = applySubstitutionCheckpoint(
    game,
    state,
    {
      teamId: 'home',
      outIds: ['h3'],
      inIds: ['h2'],
      clockTime: '9:45',
      onCourtHome: state.onCourtHome,
      onCourtAway: state.onCourtAway,
    },
    scores
  );

  assert(result.state.onCourtHome.includes('h2'), 'subbed-in player on court');
  assert(!result.state.onCourtHome.includes('h3'), 'subbed-out player off court');
  assert(result.state.onCourtHome.includes('h1'), 'FT shooter still on court');
}

function testMissedFinalFtReboundRosterIncludesSub(): void {
  const game = baseGame();
  let minutes = initialMinutesState(game);
  const scores = { home: 0, away: 0 };

  const subbed = applySubstitutionCheckpoint(
    game,
    minutes,
    {
      teamId: 'home',
      outIds: ['h3'],
      inIds: ['h2'],
      clockTime: '9:45',
      onCourtHome: minutes.onCourtHome,
      onCourtAway: minutes.onCourtAway,
    },
    scores
  );
  minutes = subbed.state;

  const onCourtHome = new Set(minutes.onCourtHome);
  assert(onCourtHome.has('h2'), 'rebound picker roster includes subbed-in player');

  let entryState = liveEntryReducer(
    {
      phase: { kind: 'idle' },
      ctx: initialLiveEntryContext('home', [...minutes.onCourtHome], [...minutes.onCourtAway]),
    },
    {
      type: 'START_FT',
      playerId: 'h1',
      ftTotal: 2,
      retainPossession: false,
      offendedTeamId: 'home',
      possessionTeamAfterFt: 'away',
    }
  );
  entryState = liveEntryReducer(entryState, { type: 'ADVANCE_FT' });
  assert(
    entryState.phase.kind === 'free_throw' && entryState.phase.ftIndex === 2,
    'after sub, still at FT 2 awaiting outcome'
  );

  entryState = liveEntryReducer(entryState, {
    type: 'START_REBOUND',
    shootingTeamId: 'home',
    defendingTeamId: 'away',
  });
  assert(entryState.phase.kind === 'rebound', 'missed final FT can enter rebound flow');
}

function main(): void {
  testFtPhaseSurvivesWithoutReset();
  testSubstitutionUpdatesOnCourtDuringFt();
  testMissedFinalFtReboundRosterIncludesSub();
  console.log('All FT substitution flow tests passed.');
}

main();
