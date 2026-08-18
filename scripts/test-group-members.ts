/**
 * LE-147 — seed-based group membership.
 * Run: npm run test:group-members
 */
import type { TournamentStructure } from '../src/utils/tournamentStructure';
import { normalizeTournamentStructure } from '../src/utils/tournamentStructure';
import {
  availableSeedCodesForStage,
  groupSeedLabels,
  resolveGroupTeamIds,
  roundRobinStages,
  syncSeedGroupsFromSnapshot,
  resolveGroupStandingsTeams,
} from '../src/utils/groupMembers';
import { filterGamesForGroup } from '../src/utils/tournamentStandings';
import type { Game } from '../src/App';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sunigStructure(): TournamentStructure {
  return normalizeTournamentStructure({
    seedSnapshot: { A3: 'team-sit', B3: 'team-smu', B4: 'team-sutd' },
    stages: [
      {
        id: 'stage-rr',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups: [
          {
            id: 'g-a',
            name: 'Group A',
            teamIds: ['team-sit', 'team-sim', 'team-ntu'],
          },
          {
            id: 'g-b',
            name: 'Group B',
            teamIds: ['team-nus', 'team-smu', 'team-sutd', 'team-suss'],
          },
        ],
      },
      {
        id: 'stage-57',
        name: '5th–7th Placing',
        kind: 'round_robin',
        order: 2,
        groups: [
          {
            id: 'g-placing',
            name: 'Placing pool',
            teamIds: [],
            seedLabels: ['A3', 'B3', 'B4'],
            seedFromStageId: 'stage-rr',
          },
        ],
      },
    ],
  })!;
}

function testSeedLabelsNormalize(): void {
  const s = normalizeTournamentStructure({
    stages: [
      {
        id: 's1',
        name: 'Groups',
        kind: 'round_robin',
        order: 1,
        groups: [
          {
            id: 'g1',
            name: 'Pool',
            teamIds: [],
            seedLabels: ['a3', 'B3', 'invalid'],
          },
        ],
      },
    ],
  })!;
  assert(groupSeedLabels(s!.stages[0].groups![0]).join(',') === 'A3,B3', 'normalize seeds');
}

function testResolveFromSnapshot(): void {
  const s = sunigStructure();
  const pool = s.stages[1].groups![0];
  const ids = resolveGroupTeamIds(pool, s);
  assert(ids.length === 3, '3 resolved');
  assert(ids.includes('team-sit'), 'A3');
  assert(ids.includes('team-smu'), 'B3');
}

function testSyncWritesTeamIds(): void {
  const synced = syncSeedGroupsFromSnapshot(sunigStructure())!;
  const pool = synced.stages[1].groups![0];
  assert(pool.teamIds.length === 3, 'teamIds filled');
}

function testFilterGamesRespectsStage(): void {
  const s = sunigStructure();
  const pool = s.stages[1].groups![0];
  const synced = syncSeedGroupsFromSnapshot(s)!;
  const games: Game[] = [
    {
      id: 'g1',
      homeTeamId: 'team-sit',
      awayTeamId: 'team-sutd',
      homeTeam: { id: 'team-sit', name: 'SIT', abbreviation: 'SIT', players: [] },
      awayTeam: { id: 'team-sutd', name: 'SUTD', abbreviation: 'SUTD', players: [] },
      tournamentId: 't-sunig',
      date: '2026-09-28',
      stageId: 'stage-57',
      groupId: 'g-placing',
      gameStats: [],
      teamStats: {
        home: { teamId: 'team-sit', total_points: 0 } as Game['teamStats']['home'],
        away: { teamId: 'team-sutd', total_points: 0 } as Game['teamStats']['away'],
      },
      shots: [],
      events: [],
      lineupStints: [],
      currentPeriod: 1,
      currentGameTime: '12:00',
      homeStarters: [],
      awayStarters: [],
      trackBothTeams: true,
      isActive: false,
      isCompleted: false,
    },
    {
      id: 'g0',
      homeTeamId: 'team-sit',
      awayTeamId: 'team-sutd',
      homeTeam: { id: 'team-sit', name: 'SIT', abbreviation: 'SIT', players: [] },
      awayTeam: { id: 'team-sutd', name: 'SUTD', abbreviation: 'SUTD', players: [] },
      tournamentId: 't-sunig',
      date: '2026-09-07',
      stageId: 'stage-rr',
      groupId: 'g-a',
      gameStats: [],
      teamStats: {
        home: { teamId: 'team-sit', total_points: 0 } as Game['teamStats']['home'],
        away: { teamId: 'team-sutd', total_points: 0 } as Game['teamStats']['away'],
      },
      shots: [],
      events: [],
      lineupStints: [],
      currentPeriod: 1,
      currentGameTime: '12:00',
      homeStarters: [],
      awayStarters: [],
      trackBothTeams: true,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 70, away: 60 },
    },
  ];
  const poolGames = filterGamesForGroup(games, pool, synced, 'stage-57');
  assert(poolGames.length === 1 && poolGames[0].id === 'g1', 'stage-scoped pool games');
}

function testAvailableSeeds(): void {
  const s = sunigStructure();
  const codes = availableSeedCodesForStage(s.stages[0]);
  assert(codes.includes('A1') && codes.includes('B4'), 'A1 and B4 available');
  assert(roundRobinStages(s).length === 2, 'two RR stages');
}

function testStandingsPlaceholders(): void {
  const s = sunigStructure();
  const pool = s.stages[1].groups![0];
  const teams = resolveGroupStandingsTeams(pool, s, new Map());
  assert(teams.length === 3, '3 placeholder rows');
  assert(teams.every((t) => t.name === t.abbreviation), 'seed labels as names');
  assert(teams.map((t) => t.name).join(',') === 'A3,B3,B4', 'order preserved');
}

function main(): void {
  testSeedLabelsNormalize();
  testResolveFromSnapshot();
  testSyncWritesTeamIds();
  testFilterGamesRespectsStage();
  testAvailableSeeds();
  testStandingsPlaceholders();
  console.log('PASS: test-group-members');
}

main();
