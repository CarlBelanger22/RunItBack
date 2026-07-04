/**
 * Live PBP row builder tests (double foul partner card).
 * Run: npm run test:live-pbp-rail
 */

import type { GameEvent, Team } from '../src/App';
import { buildPbpRows, pbpRowSourceEvent } from '../src/components/live/LivePlayByPlayRail';

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
  players: [{ id: 'h1', name: 'Paul Pierce', number: 34 }],
};

const awayTeam: Team = {
  id: 'away',
  name: 'Los Angeles',
  abbreviation: 'LAL',
  players: [{ id: 'a1', name: 'Lonzo Ball', number: 2 }],
};

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

function testPersonalFoulSingleRow(): void {
  const foul: GameEvent = {
    id: 'f2',
    type: 'foul',
    timestamp: 1,
    period: 1,
    gameTime: '10:00',
    teamId: 'away',
    playerId: 'a1',
    details: { foulCategory: 'personal' },
    homeScore: 0,
    awayScore: 0,
  };

  const rows = buildPbpRows([foul], homeTeam, awayTeam);
  assert(rows.length === 1, 'personal foul → one row');
}

function main(): void {
  testDoubleFoulAddsPartnerRow();
  testPersonalFoulSingleRow();
  console.log('All live-pbp-rail tests passed.');
}

main();
