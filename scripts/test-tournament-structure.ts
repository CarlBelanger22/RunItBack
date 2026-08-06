/**
 * LE-95.1 — tournament structure normalize + lookup helpers.
 * Run: npm run test:tournament-structure
 */
import {
  findBracketSlot,
  findGroup,
  findStage,
  groupTeamIdsByGroupId,
  normalizeTournamentStructure,
  tournamentHasStructure,
  type TournamentStructure,
} from '../src/utils/tournamentStructure';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sampleStructure(): TournamentStructure {
  return {
    stages: [
      {
        id: 'stage-group',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups: [
          { id: 'g-a', name: 'Group A', teamIds: ['um', 'ntu', 'sjtu'] },
          { id: 'g-b', name: 'Group B', teamIds: ['usyd', 'thu', 'xjtu'] },
          {
            id: 'g-c',
            name: 'Group C',
            teamIds: ['chula', 'cam', 'pku', 'ustc'],
          },
          {
            id: 'g-d',
            name: 'Group D',
            teamIds: ['snu', 'fdu', 'hit', 'nju'],
          },
        ],
      },
      {
        id: 'stage-1-4',
        name: '1–4',
        kind: 'classification',
        order: 2,
        bracket: {
          rounds: [
            {
              id: 'r-sf',
              name: 'Semis',
              slots: [
                {
                  id: 'slot-a1-d1',
                  label: 'SF1',
                  homeTeamId: 'um',
                  awayTeamId: 'snu',
                },
                { id: 'slot-b1-c1', label: 'SF2' },
              ],
            },
            {
              id: 'r-final',
              name: 'Final / 3rd',
              slots: [
                { id: 'slot-final', label: 'Final' },
                { id: 'slot-3-4', label: '3/4' },
              ],
            },
          ],
        },
      },
      {
        id: 'stage-13-14',
        name: '13–14',
        kind: 'classification',
        order: 5,
        bracket: {
          rounds: [
            {
              id: 'r-13',
              name: 'Placement',
              slots: [{ id: 'slot-13-14', label: '13/14' }],
            },
          ],
        },
      },
    ],
  };
}

function testNormalizeKeepsUnequalGroups(): void {
  const normalized = normalizeTournamentStructure(sampleStructure());
  assert(normalized, 'normalized');
  assert(normalized.stages.length === 3, '3 stages');
  const groups = normalized.stages[0].groups ?? [];
  assert(groups.length === 4, '4 groups');
  assert(groups.find((g) => g.id === 'g-a')?.teamIds.length === 3, 'A=3');
  assert(groups.find((g) => g.id === 'g-c')?.teamIds.length === 4, 'C=4');
  assert(tournamentHasStructure(normalized), 'has structure');
  assert(!tournamentHasStructure(undefined), 'empty undefined');
  assert(!tournamentHasStructure(normalizeTournamentStructure({ stages: [] })), 'empty stages');
}

function testNormalizeDropsJunk(): void {
  const normalized = normalizeTournamentStructure({
    stages: [
      { id: 'ok', name: 'OK', kind: 'round_robin', order: 2 },
      { id: 'bad', name: 'Bad', kind: 'playoff', order: 1 },
      { name: 'no-id', kind: 'custom', order: 0 },
    ],
  });
  assert(normalized?.stages.length === 1, 'only valid stage');
  assert(normalized!.stages[0].id === 'ok', 'ok kept');
}

function testLookups(): void {
  const s = normalizeTournamentStructure(sampleStructure())!;
  assert(findStage(s, 'stage-1-4')?.name === '1–4', 'find stage');
  assert(findGroup(s, 'g-d')?.name === 'Group D', 'find group');
  assert(findBracketSlot(s, 'slot-13-14')?.label === '13/14', 'find slot');
  const byGroup = groupTeamIdsByGroupId(s, 'stage-group');
  assert(byGroup.get('g-b')?.includes('thu'), 'group map');
  assert(byGroup.size === 4, '4 group keys');
}

function main(): void {
  testNormalizeKeepsUnequalGroups();
  testNormalizeDropsJunk();
  testLookups();
  console.log('PASS: test-tournament-structure');
}

main();
