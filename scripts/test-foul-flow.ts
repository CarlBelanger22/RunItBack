/**
 * Foul flow + post-FT possession tests.
 * Run: npm run test:foul-flow
 */

import type { Game, GameEvent } from '../src/App';
import { derivePossessionSnapshot } from '../src/liveEntry/possessionEngine';
import { ftCountOptionsForCategory } from '../src/liveEntry/foulFlow';
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
      players: [{ id: 'h1', name: 'H1', number: 1 }],
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      players: [{ id: 'a1', name: 'A1', number: 2 }],
    },
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { teamId: 'home', total_points: 2 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
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

function testFoulEntityStep(): void {
  let state = liveEntryReducer(
    { phase: { kind: 'idle' }, ctx: initialLiveEntryContext('home', ['h1'], ['a1']) },
    { type: 'START_FOUL' }
  );
  assert(state.phase.kind === 'foul' && state.phase.step === 'entity', 'START_FOUL → entity');

  state = liveEntryReducer(state, { type: 'FOUL_ENTITY', entity: 'player' });
  assert(state.phase.kind === 'foul' && state.phase.step === 'category', 'entity → category');
}

function testUnsportsmanlikeRetainFlag(): void {
  let state = liveEntryReducer(
    {
      phase: { kind: 'foul', step: 'category', foulEntity: 'player' },
      ctx: initialLiveEntryContext('home', ['h1'], ['a1']),
    },
    { type: 'FOUL_CATEGORY', category: 'unsportsmanlike' }
  );
  assert(
    state.phase.kind === 'foul' && state.phase.retainPossession === true,
    'unsportsmanlike sets retain'
  );
}

function testDoubleFoulFlow(): void {
  let state = liveEntryReducer(
    {
      phase: { kind: 'foul', step: 'category', foulEntity: 'player' },
      ctx: initialLiveEntryContext('home', ['h1'], ['a1']),
    },
    { type: 'FOUL_CATEGORY', category: 'double' }
  );
  assert(state.phase.kind === 'foul' && state.phase.step === 'double_committer_a', 'double → pick A');

  state = liveEntryReducer(state, { type: 'PICK_DOUBLE_COMMITTER_A', playerId: 'h1' });
  assert(state.phase.kind === 'foul' && state.phase.step === 'double_committer_b', 'pick A → pick B');

  state = liveEntryReducer(state, { type: 'PICK_DOUBLE_COMMITTER_B', playerId: 'a1' });
  assert(
    state.phase.kind === 'foul' && state.phase.step === 'ft_count' && state.phase.ftTotal === 0,
    'pick B → ft_count 0'
  );
}

function testRetainPossessionOnMadeFt(): void {
  const game = baseGame();
  const events: GameEvent[] = [
    {
      id: 'f1',
      type: 'foul',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'away',
      playerId: 'a1',
      details: {
        foulType: 'unsportsmanlike',
        foulCategory: 'unsportsmanlike',
        retainPossession: true,
        offendedTeamId: 'home',
      },
      homeScore: 2,
      awayScore: 0,
    },
    {
      id: 'ft1',
      type: 'free_throw',
      timestamp: 2,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: {
        made: true,
        ftIndex: 1,
        ftTotal: 1,
        isFinal: true,
        retainPossession: true,
        offendedTeamId: 'home',
        possessionTeamAfterFt: 'home',
      },
      homeScore: 3,
      awayScore: 0,
    },
  ];
  const snap = derivePossessionSnapshot(game, events);
  assert(snap.offenseTeamId === 'home', 'retain make keeps offense on offended team');
}

function testTechnicalFtRetainsPossessionTeam(): void {
  const game = baseGame();
  const events: GameEvent[] = [
    {
      id: 'f1',
      type: 'foul',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'away',
      playerId: 'a1',
      details: {
        foulType: 'technical',
        foulCategory: 'technical',
        retainPossession: true,
        offendedTeamId: 'home',
      },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'ft1',
      type: 'free_throw',
      timestamp: 2,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: {
        made: true,
        ftIndex: 1,
        ftTotal: 1,
        isFinal: true,
        retainPossession: true,
        offendedTeamId: 'home',
        possessionTeamAfterFt: 'home',
      },
      homeScore: 1,
      awayScore: 0,
    },
  ];
  const snap = derivePossessionSnapshot(game, events);
  assert(snap.offenseTeamId === 'home', 'technical FT keeps possession team that had the ball');
}

function testFtOptions(): void {
  assert(
    ftCountOptionsForCategory('unsportsmanlike').join(',') === '1,2,3',
    'unsportsmanlike FT options'
  );
  assert(ftCountOptionsForCategory('personal').includes(0), 'personal allows 0 FT');
}

function main(): void {
  testFoulEntityStep();
  testUnsportsmanlikeRetainFlag();
  testDoubleFoulFlow();
  testRetainPossessionOnMadeFt();
  testTechnicalFtRetainsPossessionTeam();
  testFtOptions();
  console.log('All foul-flow tests passed.');
}

main();
