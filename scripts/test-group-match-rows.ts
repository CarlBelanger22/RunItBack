/**
 * LE-147 — Group match rows (real games + seed placeholders).
 */
import assert from 'node:assert/strict';
import { buildGroupMatchRows, defaultPlacingPoolSeedMatchups, buildSeedFixtureRows } from '../src/utils/groupMatchRows';
import type { Game, Team } from '../src/App';
import type { TournamentGroup, TournamentStructure } from '../src/utils/tournamentStructure';

function team(id: string, abbr: string): Team {
  return { id, name: abbr, abbreviation: abbr, players: [] };
}

function game(
  id: string,
  homeId: string,
  awayId: string,
  date: string,
  startTime?: string
): Game {
  return {
    id,
    homeTeamId: homeId,
    awayTeamId: awayId,
    date,
    startTime,
    currentPeriod: 1,
    currentGameTime: '12:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: false,
    homeStarters: [],
    awayStarters: [],
    gameStats: [],
    teamStats: { home: { teamId: homeId, total_points: 0 }, away: { teamId: awayId, total_points: 0 } },
    shots: [],
    events: [],
    lineupStints: [],
  };
}

const placingGroup: TournamentGroup = {
  id: 'group-placing',
  name: 'Placing pool',
  teamIds: [],
  seedLabels: ['A3', 'B3', 'B4'],
  seedFromStageId: 'stage-group',
  seedMatchups: defaultPlacingPoolSeedMatchups(['A3', 'B3', 'B4']),
};

const structure: TournamentStructure = {
  stages: [
    {
      id: 'stage-group',
      name: 'Group',
      kind: 'round_robin',
      order: 1,
      groups: [
        { id: 'ga', name: 'Group A', teamIds: ['t1', 't2', 't3', 't4'] },
        { id: 'gb', name: 'Group B', teamIds: ['t5', 't6', 't7', 't8'] },
      ],
    },
    {
      id: 'stage-placing',
      name: '5th–7th Placing',
      kind: 'round_robin',
      order: 2,
      groups: [placingGroup],
    },
  ],
};

const teamById = new Map([
  ['t1', team('t1', 'INA')],
  ['t2', team('t2', 'SGP')],
]);

// --- no games: three placeholder rows ---
{
  const rows = buildGroupMatchRows(
    placingGroup,
    structure,
    [],
    teamById,
    'stage-placing'
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].homeLabel, 'A3');
  assert.equal(rows[0].awayLabel, 'B4');
  assert.equal(rows[0].isPlaceholder, true);
  assert.equal(rows[0].date, '2026-09-28');
  assert.equal(rows[2].homeLabel, 'B4');
  assert.equal(rows[2].awayLabel, 'B3');
  console.log('ok: placeholder match rows when no games');
}

// --- with resolved snapshot + real game ---
{
  const snapStructure: TournamentStructure = {
    ...structure,
    seedSnapshot: { A3: 't1', B3: 't2', B4: 't5' },
  };
  const g = game('g1', 't1', 't5', '2026-09-28', '20:40');
  const rows = buildGroupMatchRows(
    placingGroup,
    snapStructure,
    [g],
    teamById,
    'stage-placing'
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].game?.id, 'g1');
  assert.equal(rows[0].isPlaceholder, false);
  assert.equal(rows[1].game, undefined);
  assert.equal(rows[1].isPlaceholder, false);
  assert.equal(rows[2].isPlaceholder, false);
  console.log('ok: merges real game with remaining placeholders');
}

// --- derive matchups when seedMatchups omitted ---
{
  const groupNoMatchups: TournamentGroup = {
    ...placingGroup,
    seedMatchups: undefined,
  };
  const rows = buildGroupMatchRows(
    groupNoMatchups,
    structure,
    [],
    teamById,
    'stage-placing'
  );
  assert.equal(rows.length, 3);
  console.log('ok: default RR pairings from seed labels');
}

{
  const fixtures = buildSeedFixtureRows(structure, [], teamById);
  assert.equal(fixtures.length, 3);
  assert.equal(fixtures[0].stageId, 'stage-placing');
  assert.equal(fixtures[0].groupId, 'group-placing');
  assert.equal(fixtures[0].homeLabel, 'A3');
  console.log('ok: games tab seed fixtures without game rows');
}

console.log('All groupMatchRows tests passed.');
