/**
 * Single-team Opp unit engine tests (LE-91.1).
 * Run: npm run test:single-team-entry
 */

import type { Game } from '../src/App';
import {
  buildFreeThrowEvent,
  buildHeldBallJumpBallEvent,
  buildReboundEvent,
  buildShotEvent,
  buildTurnoverEvent,
  buildFoulEvent,
} from '../src/liveEntry/liveEntryActions';
import { OPPONENT_UNIT_SHOT_PLAYER_ID } from '../src/liveEntry/opponentUnit';
import { buildOppTeamTotalsStrip } from '../src/liveEntry/oppTeamTotals';
import {
  canOpenLiveEventEdit,
  isSingleTeamOppUnitEvent,
} from '../src/liveEntry/eventEditGuards';
import { deriveReboundTeamsForMissedShot } from '../src/liveEntry/reboundTeams';
import {
  initialLiveEntryContext,
  liveEntryReducer,
  type PendingShot,
} from '../src/liveEntry/liveEntryStateMachine';
import { GameLogic } from '../src/utils/GameLogic';

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

function singleTeamGame(): Game {
  return {
    id: 'g-st',
    homeTeamId: 'home',
    awayTeamId: 'opponent-1',
    homeTeam: {
      id: 'home',
      name: 'Home',
      abbreviation: 'HOM',
      players: [
        { id: 'h1', name: 'H1', number: 1 },
        { id: 'h2', name: 'H2', number: 2 },
      ],
    },
    awayTeam: {
      id: 'opponent-1',
      name: 'Opponent',
      abbreviation: 'OPP',
      players: [],
    },
    date: '2026-07-24',
    gameStats: [],
    teamStats: {
      home: emptyTeamStats('home'),
      away: emptyTeamStats('opponent-1'),
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: ['h1', 'h2'],
    awayStarters: [],
    trackBothTeams: false,
    isActive: true,
    isCompleted: false,
  };
}

function oppPending(partial: Partial<PendingShot> & Pick<PendingShot, 'outcome'>): PendingShot {
  return {
    point: { xM: 1.5, yM: 3 },
    zone: 'two',
    isPaint: false,
    isThree: false,
    shotValue: 2,
    teamOnly: true,
    ...partial,
  };
}

function testOppMakeUpdatesTeamOnly(): void {
  const game = singleTeamGame();
  const built = buildShotEvent(game, game.awayTeamId, oppPending({ outcome: 'make' }));
  assert(!!built, 'Opp make builds');
  assert(!built!.event.playerId, 'Opp make event has no playerId');
  assert(built!.event.teamId === game.awayTeamId, 'Opp make teamId=away');
  assert(built!.shot.playerId === OPPONENT_UNIT_SHOT_PLAYER_ID, 'Opp make shot uses sentinel');
  assert(built!.event.details.teamOnly === true, 'teamOnly flag on event');

  let g = { ...game, shots: [...game.shots, built!.shot] };
  g = GameLogic.recordEvent(g, built!.event);

  assert(g.teamStats.away.total_points === 2, 'Opp make → 2 pts');
  assert(g.teamStats.away.fg_made === 1 && g.teamStats.away.fg_attempted === 1, 'Opp FG 1-1');
  assert(g.teamStats.away.two_made === 1, 'Opp 2PT made');
  assert(g.gameStats.length === 0, 'no gameStats row for Opp make');
  assert(g.teamStats.home.total_points === 0, 'home score untouched');
  console.log('OK testOppMakeUpdatesTeamOnly');
}

function testOppMissThenHomeDrb(): void {
  let game = singleTeamGame();
  const miss = buildShotEvent(game, game.awayTeamId, oppPending({ outcome: 'miss' }));
  assert(!!miss, 'Opp miss builds');
  game = { ...game, shots: [...game.shots, miss!.shot] };
  game = GameLogic.recordEvent(game, miss!.event);

  const teams = deriveReboundTeamsForMissedShot(
    game,
    oppPending({ outcome: 'miss' }),
    game.awayTeamId
  );
  assert(teams.shootingTeamId === game.awayTeamId, 'shooting=Opp');
  assert(teams.defendingTeamId === game.homeTeamId, 'defending=home');

  const reb = buildReboundEvent(game, game.homeTeamId, 'h1', 'defensive');
  game = GameLogic.recordEvent(game, reb);

  const h1 = game.gameStats.find((s) => s.playerId === 'h1');
  assert(!!h1 && h1.drb === 1, 'home player DRB');
  assert(game.teamStats.home.drb === 1, 'home team DRB');
  assert(
    game.gameStats.every((s) => s.playerId !== OPPONENT_UNIT_SHOT_PLAYER_ID),
    'no sentinel stats'
  );
  console.log('OK testOppMissThenHomeDrb');
}

function testOppBlockCreditsHomeBlocker(): void {
  let game = singleTeamGame();
  const blocked = buildShotEvent(
    game,
    game.awayTeamId,
    oppPending({ outcome: 'block', blockerId: 'h2' })
  );
  assert(!!blocked, 'Opp block builds');
  assert(blocked!.event.details.blockedBy === 'h2', 'blocker on event');
  game = { ...game, shots: [...game.shots, blocked!.shot] };
  game = GameLogic.recordEvent(game, blocked!.event);

  const h2 = game.gameStats.find((s) => s.playerId === 'h2');
  assert(!!h2 && h2.blocks === 1, 'home blocker BLK');
  assert(game.teamStats.home.blocks === 1, 'home team BLK (not Opp)');
  assert(game.teamStats.away.blocks === 0, 'Opp team BLK stays 0 when blocked');
  assert(
    game.teamStats.away.fg_attempted === 1 && game.teamStats.away.fg_made === 0,
    'Opp miss FGA'
  );
  assert(game.gameStats.length === 1, 'only home blocker in gameStats');
  console.log('OK testOppBlockCreditsHomeBlocker');
}

function testOppFtTeamOnly(): void {
  let game = singleTeamGame();
  const ft1 = buildFreeThrowEvent(game, game.awayTeamId, undefined, true, 1, 2);
  game = GameLogic.recordEvent(game, ft1);
  const ft2 = buildFreeThrowEvent(game, game.awayTeamId, undefined, false, 2, 2);
  game = GameLogic.recordEvent(game, ft2);

  assert(game.teamStats.away.total_points === 1, 'Opp FT 1 pt');
  assert(
    game.teamStats.away.ft_made === 1 && game.teamStats.away.ft_attempted === 2,
    'Opp FT 1-2'
  );
  assert(game.gameStats.length === 0, 'no player stats for Opp FTs');
  console.log('OK testOppFtTeamOnly');
}

function testOppToPlusStealCreditsHome(): void {
  let game = singleTeamGame();
  const to = buildTurnoverEvent(game, game.awayTeamId, undefined, true, 'h1');
  game = GameLogic.recordEvent(game, to);

  assert(game.teamStats.away.turnovers === 1, 'Opp TO');
  const h1 = game.gameStats.find((s) => s.playerId === 'h1');
  assert(!!h1 && h1.steals === 1, 'home STL');
  assert(game.teamStats.home.steals === 1, 'home team STL');
  console.log('OK testOppToPlusStealCreditsHome');
}

function testOppFoulHomeFoulsDrawn(): void {
  let game = singleTeamGame();
  const foul = buildFoulEvent(game, {
    foulingTeamId: game.awayTeamId,
    foulCategory: 'personal',
    isTeamFoul: true,
    recipientId: 'h1',
    offendedTeamId: game.homeTeamId,
  });
  game = GameLogic.recordEvent(game, foul);

  assert(game.teamStats.away.fouls >= 1, 'Opp team foul counted');
  const h1 = game.gameStats.find((s) => s.playerId === 'h1');
  // Team foul may not credit drawnBy — personal with recipient should
  // Re-test with non-team personal (no committer = still teamId away)
  game = singleTeamGame();
  const personal = buildFoulEvent(game, {
    foulingTeamId: game.awayTeamId,
    foulCategory: 'personal',
    isTeamFoul: false,
    recipientId: 'h1',
    offendedTeamId: game.homeTeamId,
  });
  game = GameLogic.recordEvent(game, personal);
  const h1b = game.gameStats.find((s) => s.playerId === 'h1');
  assert(!!h1b && h1b.fouls_drawn === 1, 'home FD from Opp personal');
  assert(game.teamStats.away.fouls === 1, 'Opp PF');
  console.log('OK testOppFoulHomeFoulsDrawn');
}

function testBothTeamShotStillRequiresShooter(): void {
  const game = singleTeamGame();
  const built = buildShotEvent(game, game.homeTeamId, {
    point: { xM: 1, yM: 2 },
    zone: 'two',
    isPaint: false,
    isThree: false,
    shotValue: 2,
    outcome: 'make',
  });
  assert(built === null, 'non-teamOnly without shooterId → null');
  console.log('OK testBothTeamShotStillRequiresShooter');
}

function testReplayIncludesOppTeamShots(): void {
  const game0 = singleTeamGame();
  const three = buildShotEvent(game0, game0.awayTeamId, {
    ...oppPending({ outcome: 'make' }),
    isThree: true,
    shotValue: 3,
  })!;
  const game = GameLogic.recordEvent({ ...game0, shots: [three.shot] }, three.event);
  assert(game.teamStats.away.total_points === 3, 'Opp 3PT pts');

  const rebuilt = GameLogic.replayFromEvents(singleTeamGame(), game.events);
  assert(
    rebuilt.shots.some((s) => s.playerId === OPPONENT_UNIT_SHOT_PLAYER_ID),
    'replay restores Opp sentinel shot'
  );
  assert(rebuilt.teamStats.away.total_points === 3, 'replay Opp score');
  assert(rebuilt.gameStats.length === 0, 'replay no Opp player stats');
  console.log('OK testReplayIncludesOppTeamShots');
}

function testShotOutcomeTeamOnlyBranches(): void {
  let state = {
    phase: { kind: 'idle' as const },
    ctx: {
      ...initialLiveEntryContext('home', ['h1'], []),
      offenseTeamId: 'opponent-1',
      pendingShot: {
        point: { xM: 1, yM: 2 },
        zone: 'two' as const,
        isPaint: false,
        isThree: false,
        shotValue: 2 as const,
      },
    },
  };
  state = liveEntryReducer(state, {
    type: 'SHOT_OUTCOME',
    outcome: 'make',
    teamOnly: true,
  });
  assert(
    state.phase.kind === 'shot' &&
      state.phase.step === 'fastbreak' &&
      state.ctx.pendingShot?.teamOnly === true,
    'Opp make → fastbreak teamOnly'
  );

  state = {
    phase: { kind: 'idle' },
    ctx: {
      ...initialLiveEntryContext('home', ['h1'], []),
      offenseTeamId: 'opponent-1',
      pendingShot: {
        point: { xM: 1, yM: 2 },
        zone: 'two',
        isPaint: false,
        isThree: false,
        shotValue: 2,
      },
    },
  };
  state = liveEntryReducer(state, {
    type: 'SHOT_OUTCOME',
    outcome: 'block',
    teamOnly: true,
  });
  assert(
    state.phase.kind === 'shot' && state.phase.step === 'pick_blocker',
    'Opp block → pick_blocker'
  );

  state = {
    phase: { kind: 'idle' },
    ctx: {
      ...initialLiveEntryContext('home', ['h1'], []),
      pendingShot: {
        point: { xM: 1, yM: 2 },
        zone: 'two',
        isPaint: false,
        isThree: false,
        shotValue: 2,
      },
    },
  };
  state = liveEntryReducer(state, {
    type: 'SHOT_OUTCOME',
    outcome: 'block',
    skipBlockerPick: true,
  });
  assert(
    state.phase.kind === 'shot' && state.phase.step === 'pick_shooter',
    'home blocked by Opp → pick_shooter'
  );
  console.log('OK testShotOutcomeTeamOnlyBranches');
}

function testStartFtWithoutPlayer(): void {
  const state = liveEntryReducer(
    {
      phase: { kind: 'idle' },
      ctx: initialLiveEntryContext('home', ['h1'], []),
    },
    {
      type: 'START_FT',
      shootingTeamId: 'opponent-1',
      ftTotal: 2,
      retainPossession: false,
      offendedTeamId: 'opponent-1',
      possessionTeamAfterFt: 'home',
    }
  );
  assert(state.phase.kind === 'free_throw', 'START_FT team-only');
  assert(
    state.phase.kind === 'free_throw' &&
      state.phase.playerId === undefined &&
      state.phase.shootingTeamId === 'opponent-1',
    'Opp FT phase has shootingTeamId, no player'
  );
  console.log('OK testStartFtWithoutPlayer');
}

function testSkipRecipientOnHomeFoul(): void {
  let state = liveEntryReducer(
    {
      phase: { kind: 'idle' },
      ctx: initialLiveEntryContext('home', ['h1'], []),
    },
    { type: 'START_FOUL' }
  );
  state = liveEntryReducer(state, { type: 'FOUL_ENTITY', entity: 'player' });
  state = liveEntryReducer(state, { type: 'FOUL_CATEGORY', category: 'personal' });
  state = liveEntryReducer(state, {
    type: 'PICK_FOUL_COMMITTER',
    playerId: 'h1',
    teamId: 'home',
    skipRecipient: true,
  });
  assert(
    state.phase.kind === 'foul' && state.phase.step === 'ft_count',
    'home foul skipRecipient → ft_count'
  );
  console.log('OK testSkipRecipientOnHomeFoul');
}

function testHomeMissOppTeamDrb(): void {
  let game = singleTeamGame();
  const miss = buildShotEvent(game, game.homeTeamId, {
    point: { xM: 2, yM: 3 },
    zone: 'two',
    isPaint: false,
    isThree: false,
    shotValue: 2,
    outcome: 'miss',
    shooterId: 'h1',
  });
  assert(!!miss, 'home miss builds');
  game = { ...game, shots: [miss!.shot] };
  game = GameLogic.recordEvent(game, miss!.event);

  const reb = buildReboundEvent(game, game.awayTeamId, undefined, 'team_defensive');
  game = GameLogic.recordEvent(game, reb);
  assert(game.teamStats.away.drb === 1 || game.teamStats.away.team_rebounds >= 1, 'Opp team DRB');
  assert(game.gameStats.every((s) => s.playerId !== 'opponent-1'), 'no Opp player row');
  console.log('OK testHomeMissOppTeamDrb');
}

function testJumpBallOppTeamTurnover(): void {
  let game = singleTeamGame();
  game = {
    ...game,
    possessionArrowTeamId: game.homeTeamId,
  };
  const event = buildHeldBallJumpBallEvent(game, {
    losingTeamId: game.awayTeamId,
    arrowBeforeTeamId: game.homeTeamId,
    arrowAfterTeamId: game.awayTeamId,
    awardedTeamId: game.homeTeamId,
    possessionChanged: true,
    // Opp unit TO — no turnover player; home stealer
    stealPlayerId: 'h1',
  });
  game = GameLogic.recordEvent(game, event);
  assert(game.teamStats.away.turnovers === 1, 'Opp team TO from jump ball');
  const h1 = game.gameStats.find((s) => s.playerId === 'h1');
  assert(!!h1 && h1.steals === 1, 'home STL from jump ball');
  console.log('OK testJumpBallOppTeamTurnover');
}

function testJumpBallPickToWithoutPlayer(): void {
  let state = liveEntryReducer(
    {
      phase: { kind: 'idle' },
      ctx: initialLiveEntryContext('home', ['h1'], []),
    },
    { type: 'START_JUMPBALL' }
  );
  assert(state.phase.kind === 'jumpball' && state.phase.step === 'pick_to', 'pick_to');
  state = liveEntryReducer(state, { type: 'JUMPBALL_PICK_TO' });
  assert(
    state.phase.kind === 'jumpball' &&
      state.phase.step === 'pick_steal' &&
      state.phase.turnoverPlayerId === undefined,
    'Opp unit TO → pick_steal without playerId'
  );
  console.log('OK testJumpBallPickToWithoutPlayer');
}

function testOppTeamTotalsStrip(): void {
  let game = singleTeamGame();
  const make = buildShotEvent(game, game.awayTeamId, {
    ...oppPending({ outcome: 'make' }),
    isThree: true,
    shotValue: 3,
  })!;
  game = GameLogic.recordEvent({ ...game, shots: [make.shot] }, make.event);
  const ft = buildFreeThrowEvent(game, game.awayTeamId, undefined, true, 1, 1);
  game = GameLogic.recordEvent(game, ft);
  const to = buildTurnoverEvent(game, game.awayTeamId, undefined, true);
  game = GameLogic.recordEvent(game, to);

  const strip = buildOppTeamTotalsStrip(game.teamStats.away);
  assert(strip.points === 4, 'strip PTS = 3+1');
  assert(strip.fgMade === 1 && strip.fgAttempted === 1, 'strip FG 1-1');
  assert(strip.threeMade === 1, 'strip 3PT');
  assert(strip.ftMade === 1 && strip.ftAttempted === 1, 'strip FT');
  assert(strip.turnovers === 1, 'strip TO');
  assert(strip.fgPctLabel === '100%', 'FG% from FG only');
  assert(strip.ftPctLabel === '100%', 'FT% separate');
  assert(game.gameStats.length === 0, 'still no Opp player rows');
  console.log('OK testOppTeamTotalsStrip');
}

function testOppPbpReadOnlyGuards(): void {
  const game = singleTeamGame();
  const oppShot = buildShotEvent(game, game.awayTeamId, oppPending({ outcome: 'make' }))!;
  assert(isSingleTeamOppUnitEvent(game, oppShot.event), 'Opp shot is unit event');
  assert(!canOpenLiveEventEdit(game, oppShot.event).ok, 'Opp shot not editable');

  const homeShot = buildShotEvent(game, game.homeTeamId, {
    point: { xM: 1, yM: 2 },
    zone: 'two',
    isPaint: false,
    isThree: false,
    shotValue: 2,
    outcome: 'make',
    shooterId: 'h1',
  })!;
  assert(!isSingleTeamOppUnitEvent(game, homeShot.event), 'home shot not Opp unit');
  assert(canOpenLiveEventEdit(game, homeShot.event).ok, 'home shot editable');

  const both = { ...game, trackBothTeams: true };
  assert(!isSingleTeamOppUnitEvent(both, oppShot.event), 'both-team: no Opp unit lock');
  console.log('OK testOppPbpReadOnlyGuards');
}

testOppMakeUpdatesTeamOnly();
testOppMissThenHomeDrb();
testOppBlockCreditsHomeBlocker();
testOppFtTeamOnly();
testOppToPlusStealCreditsHome();
testOppFoulHomeFoulsDrawn();
testBothTeamShotStillRequiresShooter();
testReplayIncludesOppTeamShots();
testShotOutcomeTeamOnlyBranches();
testStartFtWithoutPlayer();
testSkipRecipientOnHomeFoul();
testHomeMissOppTeamDrb();
testJumpBallOppTeamTurnover();
testJumpBallPickToWithoutPlayer();
testOppTeamTotalsStrip();
testOppPbpReadOnlyGuards();

console.log('All single-team entry engine tests passed.');
