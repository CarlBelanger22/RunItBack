/**
 * Live PBP row builder + stat display tests.
 * Run: npm run test:live-pbp-rail
 */

import type { GameEvent, Team } from '../src/App';
import {
  buildFirstNameLabels,
  buildPbpRows,
  buildPbpStatSnapshots,
  formatPbpAction,
  pbpRowSourceEvent,
} from '../src/liveEntry/pbpDisplay';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const homeTeam: Team = {
  id: 'home',
  name: 'Boston',
  abbreviation: 'BOS',
  players: [
    { id: 'h1', name: 'Paul Pierce', number: 34 },
    { id: 'h2', name: 'Paul George', number: 13 },
  ],
};

const awayTeam: Team = {
  id: 'away',
  name: 'Los Angeles',
  abbreviation: 'LAL',
  players: [
    { id: 'a1', name: 'Lonzo Ball', number: 2 },
    { id: 'a2', name: 'Louis Williams', number: 23 },
  ],
};

const COLORS = {
  success: '#0f0',
  destructive: '#f00',
  muted: '#888',
  away: '#00f',
};

function testFirstNameDuplicateDisambiguation(): void {
  const labels = buildFirstNameLabels(homeTeam, awayTeam);
  assert(labels.get('h1') === 'Paul P.', 'duplicate Paul → Paul P.');
  assert(labels.get('h2') === 'Paul G.', 'duplicate Paul → Paul G.');
  assert(labels.get('a2') === 'Louis', 'unique first name unchanged');
}

function testMadeShotWithAssist(): void {
  const events: GameEvent[] = [
    {
      id: 's1',
      type: 'shot_attempt',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: { made: true, isThree: false, assistedBy: 'a2' },
      homeScore: 2,
      awayScore: 0,
    },
  ];

  const snaps = buildPbpStatSnapshots(homeTeam, awayTeam, events);
  const rows = buildPbpRows(events, homeTeam, awayTeam);
  const action = formatPbpAction(rows[0], snaps.get('s1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);

  assert(action.playerLine === 'Paul P. (2 pts)', 'made shot shows points');
  assert(action.label === '2PT MAKE', 'made 2pt label');
  assert(action.detail === 'AST Louis (1 ast)', 'assist with ast total');
}

function testMissedThree(): void {
  const events: GameEvent[] = [
    {
      id: 's1',
      type: 'shot_attempt',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: { made: false, isThree: true },
      homeScore: 0,
      awayScore: 0,
    },
  ];

  const snaps = buildPbpStatSnapshots(homeTeam, awayTeam, events);
  const rows = buildPbpRows(events, homeTeam, awayTeam);
  const action = formatPbpAction(rows[0], snaps.get('s1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);

  assert(action.playerLine === 'Paul P. (0/1 3P)', 'missed 3 shows 3P count');
  assert(action.label === '3PT MISS', '3pt miss label');
}

function testReboundDisplay(): void {
  const events: GameEvent[] = [
    {
      id: 'r1',
      type: 'rebound',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: { reboundType: 'defensive' },
      homeScore: 0,
      awayScore: 0,
    },
  ];

  const snaps = buildPbpStatSnapshots(homeTeam, awayTeam, events);
  const rows = buildPbpRows(events, homeTeam, awayTeam);
  const action = formatPbpAction(rows[0], snaps.get('r1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);

  assert(action.playerLine === 'Paul P. (1 reb)', 'rebound total on player line');
  assert(action.label === 'drb (1)', 'drb count on action');
}

function testOffensiveFoulStats(): void {
  const events: GameEvent[] = [
    {
      id: 'f1',
      type: 'foul',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: { foulCategory: 'offensive', foulType: 'offensive' },
      homeScore: 0,
      awayScore: 0,
    },
  ];

  const snaps = buildPbpStatSnapshots(homeTeam, awayTeam, events);
  const rows = buildPbpRows(events, homeTeam, awayTeam);
  const action = formatPbpAction(rows[0], snaps.get('f1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);

  assert(action.playerLine === 'Paul P. (1 pf, 1 to)', 'offensive foul pf + to');
  assert(action.label === 'OFF FOUL', 'off foul label');
}

function testTurnoverWithSteal(): void {
  const events: GameEvent[] = [
    {
      id: 't1',
      type: 'turnover',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'h1',
      details: { stolenBy: 'a1' },
      homeScore: 0,
      awayScore: 0,
    },
  ];

  const snaps = buildPbpStatSnapshots(homeTeam, awayTeam, events);
  const rows = buildPbpRows(events, homeTeam, awayTeam);
  const action = formatPbpAction(rows[0], snaps.get('t1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);

  assert(action.playerLine === 'Paul P. (1 to)', 'turnover count');
  assert(action.detail === 'STL Lonzo (1 stl)', 'steal detail');
}

function testDoubleFoulAddsPartnerRow(): void {
  const foul: GameEvent = {
    id: 'f1',
    type: 'foul',
    timestamp: 1,
    period: 1,
    gameTime: '10:00',
    teamId: 'home',
    playerId: 'h1',
    details: {
      foulCategory: 'double',
      foulType: 'double',
      doublePartnerPlayerId: 'a1',
      doublePartnerTeamId: 'away',
    },
    homeScore: 0,
    awayScore: 0,
  };

  const rows = buildPbpRows([foul], homeTeam, awayTeam);
  assert(rows.length === 2, 'double foul → primary + partner rows');
  assert(rows[0].kind === 'event', 'first row is event');
  assert(rows[1].kind === 'double_foul_partner', 'second row is partner');

  if (rows[1].kind === 'double_foul_partner') {
    assert(rows[1].partnerId === 'a1', 'partner id');
    assert(rows[1].partnerTeamId === 'away', 'partner team');
    assert(pbpRowSourceEvent(rows[1]).id === 'f1', 'partner row edits parent foul');
  }
}

function testBlockedShotRows(): void {
  const shot: GameEvent = {
    id: 's1',
    type: 'shot_attempt',
    timestamp: 1,
    period: 1,
    gameTime: '10:00',
    teamId: 'home',
    playerId: 'h1',
    details: { made: false, isThree: false, blockedBy: 'a1' },
    homeScore: 0,
    awayScore: 0,
  };

  const snaps = buildPbpStatSnapshots(homeTeam, awayTeam, [shot]);
  const rows = buildPbpRows([shot], homeTeam, awayTeam);
  assert(rows.length === 2, 'blocked shot adds block row');

  const shotAction = formatPbpAction(rows[0], snaps.get('s1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);
  assert(shotAction.label === 'BLOCKED', 'shot row blocked label');
  assert(shotAction.detail?.includes('BLK Lonzo (1 blk)'), 'shot row blocker detail');

  const blockAction = formatPbpAction(rows[1], snaps.get('s1'), homeTeam, awayTeam, buildFirstNameLabels(homeTeam, awayTeam), COLORS);
  assert(blockAction.playerLine === 'Lonzo (1 blk)', 'block row player blk total');
  assert(blockAction.label === 'BLOCK', 'block row label');
}

function main(): void {
  testFirstNameDuplicateDisambiguation();
  testMadeShotWithAssist();
  testMissedThree();
  testReboundDisplay();
  testOffensiveFoulStats();
  testTurnoverWithSteal();
  testDoubleFoulAddsPartnerRow();
  testBlockedShotRows();
  console.log('All live-pbp-rail tests passed.');
}

main();
