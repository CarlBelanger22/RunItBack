/**
 * Foul flow + post-FT possession tests.
 * Run: npm run test:foul-flow
 */

import type { Game, GameEvent } from '../src/App';
import { derivePossessionSnapshot } from '../src/liveEntry/possessionEngine';
import { ftCountOptionsForCategory } from '../src/liveEntry/foulFlow';
import { buildFoulEvent } from '../src/liveEntry/liveEntryActions';
import { GameLogic } from '../src/utils/GameLogic';
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

function testUnsportsmanlikeByOffenseFlipsPossession(): void {
  const game = baseGame();
  // LE-85: home is on offense and commits the unsportsmanlike foul →
  // away (defense/offended) shoots the FTs and receives the ball.
  const events: GameEvent[] = [
    {
      id: 'ps',
      type: 'period_start',
      timestamp: 0,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { period: 1, possessionTeamId: 'home' },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'f1',
      type: 'foul',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: {
        foulType: 'unsportsmanlike',
        foulCategory: 'unsportsmanlike',
        retainPossession: true,
        offendedTeamId: 'away',
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
      teamId: 'away',
      playerId: 'a1',
      details: {
        made: false,
        ftIndex: 1,
        ftTotal: 2,
        isFinal: false,
        retainPossession: true,
        offendedTeamId: 'away',
        possessionTeamAfterFt: 'away',
      },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'ft2',
      type: 'free_throw',
      timestamp: 3,
      period: 1,
      gameTime: '10:00',
      teamId: 'away',
      playerId: 'a1',
      details: {
        made: true,
        ftIndex: 2,
        ftTotal: 2,
        isFinal: true,
        retainPossession: true,
        offendedTeamId: 'away',
        possessionTeamAfterFt: 'away',
      },
      homeScore: 0,
      awayScore: 1,
    },
  ];
  const snap = derivePossessionSnapshot(game, events);
  assert(
    snap.offenseTeamId === 'away',
    'offense-committed unsportsmanlike gives FTs + ball to the offended defense'
  );
}

function testFtOptions(): void {
  assert(
    ftCountOptionsForCategory('unsportsmanlike').join(',') === '1,2,3',
    'unsportsmanlike FT options'
  );
  assert(ftCountOptionsForCategory('personal').includes(0), 'personal allows 0 FT');
  assert(
    ftCountOptionsForCategory('offensive').join(',') === '0',
    'offensive allows 0 FT only'
  );
}

function testOffensiveFoulStateFlow(): void {
  const state = liveEntryReducer(
    {
      phase: { kind: 'foul', step: 'category', foulEntity: 'player' },
      ctx: initialLiveEntryContext('home', ['h1'], ['a1']),
    },
    { type: 'FOUL_CATEGORY', category: 'offensive' }
  );
  assert(
    state.phase.kind === 'foul' &&
      state.phase.step === 'committer' &&
      state.phase.foulCategory === 'offensive',
    'offensive category → committer on offense roster (commit on player pick, no confirm step)'
  );
}

function testOffensiveFoulPossessionFlip(): void {
  const game = baseGame();
  const events: GameEvent[] = [
    {
      id: 'ps1',
      type: 'period_start',
      timestamp: 0,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { period: 1, possessionTeamId: 'home' },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'of1',
      type: 'foul',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: {
        foulType: 'offensive',
        foulCategory: 'offensive',
        isOffensiveFoul: true,
        retainPossession: false,
      },
      homeScore: 0,
      awayScore: 0,
    },
  ];
  const snap = derivePossessionSnapshot(game, events);
  assert(snap.offenseTeamId === 'away', 'offensive foul flips possession to defense');
  assert(snap.offTurnoverTeamId === 'away', 'offensive foul sets off-turnover credit team');
}

function testOffensiveFoulStats(): void {
  const game = baseGame();
  const event = buildFoulEvent(game, {
    foulingTeamId: 'home',
    committerId: 'h1',
    foulCategory: 'offensive',
  });
  const updated = GameLogic.recordEvent(game, event);
  const player = updated.gameStats.find((s) => s.playerId === 'h1');
  assert(player?.fouls === 1, 'offensive foul credits player PF');
  assert(player?.turnovers === 1, 'offensive foul credits player TO');
  assert(updated.teamStats.home.fouls === 1, 'offensive foul credits team fouls');
  assert(updated.teamStats.home.turnovers === 1, 'offensive foul credits team TO');
  assert(
    event.details.isOffensiveFoul === true && event.details.drawnBy === undefined,
    'offensive foul event has no drawnBy'
  );
}

function main(): void {
  testFoulEntityStep();
  testUnsportsmanlikeRetainFlag();
  testDoubleFoulFlow();
  testRetainPossessionOnMadeFt();
  testUnsportsmanlikeByOffenseFlipsPossession();
  testTechnicalFtRetainsPossessionTeam();
  testFtOptions();
  testOffensiveFoulStateFlow();
  testOffensiveFoulPossessionFlip();
  testOffensiveFoulStats();
  console.log('All foul-flow tests passed.');
}

main();
