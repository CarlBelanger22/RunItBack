/**
 * LE-95.3 — retag games from structure.
 * Run: npm run test:retag-tournament-games
 */
import type { Game } from '../src/App';
import { buildIubit2026Structure } from '../src/utils/iubit2026Structure';
import {
  computeGroupFinishPlaces,
  describeGameStageTag,
  retagTournamentGames,
} from '../src/utils/retagTournamentGames';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function baseGame(partial: Partial<Game> & Pick<Game, 'id' | 'homeTeamId' | 'awayTeamId'>): Game {
  const homeTeamId = partial.homeTeamId;
  const awayTeamId = partial.awayTeamId;
  return {
    id: partial.id,
    homeTeamId,
    awayTeamId,
    homeTeam: { id: homeTeamId, name: homeTeamId, abbreviation: homeTeamId, players: [] },
    awayTeam: { id: awayTeamId, name: awayTeamId, abbreviation: awayTeamId, players: [] },
    tournamentId: 't-iubit',
    date: '2026-07-01',
    gameStats: [],
    teamStats: {
      home: { teamId: homeTeamId, total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: awayTeamId, total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: partial.finalScore ?? { home: 70, away: 60 },
    ...partial,
  };
}

function testGroupAndClassificationTagging(): void {
  const teams = [
    { id: 'um', abbreviation: 'UM' },
    { id: 'ntu', abbreviation: 'NTU' },
    { id: 'sjtu', abbreviation: 'SJTU' },
    { id: 'usyd', abbreviation: 'USYD' },
    { id: 'thu', abbreviation: 'THU' },
    { id: 'xjtu', abbreviation: 'XJTU' },
    { id: 'chula', abbreviation: 'CHULA' },
    { id: 'cam', abbreviation: 'CAM' },
    { id: 'pku', abbreviation: 'PKU' },
    { id: 'ustc', abbreviation: 'USTC' },
    { id: 'snu', abbreviation: 'SNU' },
    { id: 'fdu', abbreviation: 'FDU' },
    { id: 'hit', abbreviation: 'HIT' },
    { id: 'nju', abbreviation: 'NJU' },
  ];
  const structure = buildIubit2026Structure(teams)!;

  // Group A RR: UM beats both → 1st; NTU beats SJTU → 2nd; SJTU 3rd
  const games: Game[] = [
    baseGame({ id: 'ga1', homeTeamId: 'um', awayTeamId: 'ntu', finalScore: { home: 80, away: 70 } }),
    baseGame({ id: 'ga2', homeTeamId: 'um', awayTeamId: 'sjtu', finalScore: { home: 75, away: 60 } }),
    baseGame({ id: 'ga3', homeTeamId: 'ntu', awayTeamId: 'sjtu', finalScore: { home: 65, away: 60 } }),
    // Group D: SNU 1st, FDU 2nd, HIT 3rd, NJU 4th (simplified)
    baseGame({ id: 'gd1', homeTeamId: 'snu', awayTeamId: 'fdu', finalScore: { home: 90, away: 50 } }),
    baseGame({ id: 'gd2', homeTeamId: 'snu', awayTeamId: 'hit', finalScore: { home: 88, away: 50 } }),
    baseGame({ id: 'gd3', homeTeamId: 'snu', awayTeamId: 'nju', finalScore: { home: 85, away: 50 } }),
    baseGame({ id: 'gd4', homeTeamId: 'fdu', awayTeamId: 'hit', finalScore: { home: 70, away: 60 } }),
    baseGame({ id: 'gd5', homeTeamId: 'fdu', awayTeamId: 'nju', finalScore: { home: 72, away: 60 } }),
    baseGame({ id: 'gd6', homeTeamId: 'hit', awayTeamId: 'nju', finalScore: { home: 68, away: 60 } }),
    // Classification: A1 UM vs D1 SNU → 1–4
    baseGame({ id: 'sf14', homeTeamId: 'um', awayTeamId: 'snu', finalScore: { home: 70, away: 68 } }),
    // 13/14: C4 vs D4 — need C standings too; USTC last in C, NJU last in D
    baseGame({ id: 'gc1', homeTeamId: 'chula', awayTeamId: 'cam', finalScore: { home: 80, away: 50 } }),
    baseGame({ id: 'gc2', homeTeamId: 'chula', awayTeamId: 'pku', finalScore: { home: 80, away: 50 } }),
    baseGame({ id: 'gc3', homeTeamId: 'chula', awayTeamId: 'ustc', finalScore: { home: 80, away: 50 } }),
    baseGame({ id: 'gc4', homeTeamId: 'cam', awayTeamId: 'pku', finalScore: { home: 70, away: 60 } }),
    baseGame({ id: 'gc5', homeTeamId: 'cam', awayTeamId: 'ustc', finalScore: { home: 70, away: 55 } }),
    baseGame({ id: 'gc6', homeTeamId: 'pku', awayTeamId: 'ustc', finalScore: { home: 65, away: 50 } }),
    baseGame({ id: 'p1314', homeTeamId: 'ustc', awayTeamId: 'nju', finalScore: { home: 55, away: 50 } }),
  ];

  const groupA = structure.stages[0].groups!.find((g) => g.id === 'iubit-g-a')!;
  const placesA = computeGroupFinishPlaces(groupA, games);
  assert(placesA.get('um') === 1, 'UM 1st in A');
  assert(placesA.get('ntu') === 2, 'NTU 2nd');
  assert(placesA.get('sjtu') === 3, 'SJTU 3rd');

  const { games: tagged, report } = retagTournamentGames(games, 't-iubit', structure);
  const byId = new Map(tagged.map((g) => [g.id, g]));

  assert(byId.get('ga1')?.stageId === 'iubit-stage-groups', 'group game stage');
  assert(byId.get('ga1')?.groupId === 'iubit-g-a', 'group game groupId');
  assert(byId.get('sf14')?.stageId === 'iubit-stage-1-4', '1-4 semi');
  assert(byId.get('sf14')?.groupId == null, 'classification no group');
  assert(byId.get('p1314')?.stageId === 'iubit-stage-13-14', '13-14');
  assert(report.groupTagged >= 3, 'group tagged count');
  assert(report.classificationTagged >= 2, 'classification tagged');
}

function testSameGroupRematchPrefersEarliestForRr(): void {
  const structure: import('../src/utils/tournamentStructure').TournamentStructure = {
    stages: [
      {
        id: 'rr',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups: [
          { id: 'g-b', name: 'Group B', teamIds: ['sit', 'sutd', 'nus'] },
        ],
      },
      {
        id: 'place',
        name: '5th - 7th Placing',
        kind: 'classification',
        order: 2,
      },
    ],
  };
  const games = [
    baseGame({
      id: 'sep26',
      homeTeamId: 'sit',
      awayTeamId: 'sutd',
      date: '2025-09-26',
      tournamentId: 't-sunig',
    }),
    baseGame({
      id: 'oct1',
      homeTeamId: 'sit',
      awayTeamId: 'sutd',
      date: '2025-10-01',
      tournamentId: 't-sunig',
    }),
  ];
  // Fix tournament ids on games - baseGame hardcodes t-iubit
  const fixed = games.map((g) => ({ ...g, tournamentId: 't-sunig' }));
  const { games: tagged } = retagTournamentGames(fixed, 't-sunig', structure);
  const byId = new Map(tagged.map((g) => [g.id, g]));
  assert(byId.get('sep26')?.groupId === 'g-b', 'sep26 is RR');
  assert(byId.get('sep26')?.stageId === 'rr', 'sep26 stage rr');
  assert(byId.get('oct1')?.stageId === 'place', 'oct1 classification');
  assert(byId.get('oct1')?.groupId == null, 'oct1 no group');
}

function testDescribeHidesOrphanStageId(): void {
  const label = describeGameStageTag(
    baseGame({
      id: 'x',
      homeTeamId: 'a',
      awayTeamId: 'b',
      stageId: 'stage-orphan-deleted',
    }),
    { stages: [{ id: 'rr', name: 'Group stage', kind: 'round_robin', order: 1 }] }
  );
  assert(label == null, `orphan label=${label}`);
}

function main(): void {
  testGroupAndClassificationTagging();
  testSameGroupRematchPrefersEarliestForRr();
  testDescribeHidesOrphanStageId();
  console.log('PASS: test-retag-tournament-games');
}

main();
