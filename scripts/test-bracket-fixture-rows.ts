/**
 * LE-146 — Bracket slot fixtures for Games tab.
 */
import assert from 'node:assert/strict';
import { buildFourTeamBracket } from '../src/utils/fourTeamBracket';
import { buildBracketFixtureRows } from '../src/utils/bracketFixtureRows';
import type { Game, Team } from '../src/App';

function team(id: string, abbr: string): Team {
  return { id, name: abbr, abbreviation: abbr, players: [] };
}

const stageId = 'stage-finals';
const { rounds } = buildFourTeamBracket(stageId);
const structure = {
  stages: [
    {
      id: stageId,
      name: 'Finals',
      kind: 'classification' as const,
      order: 2,
      bracket: { rounds },
    },
  ],
};

const teamById = new Map([
  ['t1', team('t1', 'SIT')],
  ['t2', team('t2', 'NUS')],
]);

{
  const fixtures = buildBracketFixtureRows(structure, [], teamById);
  assert.equal(fixtures.length, 4, 'SF1, SF2, Final, 3rd');
  assert.equal(fixtures[0].homeLabel, 'A1');
  assert.equal(fixtures[0].awayLabel, 'B2');
  assert.equal(fixtures[0].slotLabel, 'SF1');
  const finalRow = fixtures.find((f) => f.slotLabel === 'Final');
  assert.equal(finalRow?.homeLabel, 'Winner · SF1');
  console.log('ok: four bracket placeholders without games');
}

{
  const fixtures = buildBracketFixtureRows(structure, [], teamById);
  const sf1 = fixtures.find((f) => f.slotLabel === 'SF1');
  assert.equal(sf1?.date, '2026-10-01');
  assert.equal(sf1?.startTime, '19:15');
  const final = fixtures.find((f) => f.slotLabel === 'Final');
  assert.equal(final?.date, '2026-10-08');
  assert.equal(final?.startTime, '20:40');
  console.log('ok: PDF schedule on fixtures without structure dates');
}

{
  const withDates = {
    stages: [
      {
        ...structure.stages[0],
        bracket: {
          rounds: rounds.map((round) => ({
            ...round,
            slots: round.slots.map((slot) =>
              slot.label === 'SF1'
                ? { ...slot, date: '2026-10-01', startTime: '19:15' }
                : slot
            ),
          })),
        },
      },
    ],
  };
  const fixtures = buildBracketFixtureRows(withDates, [], teamById);
  const sf1 = fixtures.find((f) => f.slotLabel === 'SF1');
  assert.equal(sf1?.date, '2026-10-01');
  assert.equal(sf1?.startTime, '19:15');
  console.log('ok: bracket slot date/time on fixture row');
}

{
  const sf1 = rounds[0].slots[0];
  const linkedGame: Game = {
    id: 'g-sf1',
    homeTeamId: 't1',
    awayTeamId: 't2',
    date: '2026-10-01',
    bracketSlotId: sf1.id,
    currentPeriod: 1,
    currentGameTime: '12:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: false,
    homeStarters: [],
    awayStarters: [],
    gameStats: [],
    teamStats: {
      home: { teamId: 't1', total_points: 0 },
      away: { teamId: 't2', total_points: 0 },
    },
    shots: [],
    events: [],
    lineupStints: [],
  };
  const fixtures = buildBracketFixtureRows(structure, [linkedGame], teamById);
  assert.equal(fixtures.length, 3, 'SF1 hidden when game linked');
  assert.ok(!fixtures.some((f) => f.slotLabel === 'SF1'));
  console.log('ok: skips bracket slot when game row exists');
}

console.log('All bracketFixtureRows tests passed.');
