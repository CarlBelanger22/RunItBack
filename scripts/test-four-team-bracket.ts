/**
 * LE-103 / LE-118 / LE-122 / LE-127 — 4-Team, 8-Team, 12-Team, and Last 16 brackets.
 * Run: npm run test:four-team-bracket
 */
import {
  buildEightTeamBracket,
  buildFourTeamBracket,
  buildLast16Bracket,
  buildTwelveTeamBracket,
  classificationStagesNeedBracketSlots,
  ensureClassificationBrackets,
} from '../src/utils/fourTeamBracket';
import {
  countBracketSlots,
  ensureIubitClassificationBrackets,
} from '../src/utils/iubit2026Bracket';
import {
  buildIubit2026Structure,
  IUBIT_2026_GROUPS,
} from '../src/utils/iubit2026Structure';
import type { TournamentStructure } from '../src/utils/tournamentStructure';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testTwelveTeam(): void {
  const built = buildTwelveTeamBracket('stage-12');
  assert(built.rounds.length === 4, 'r16 + qf + sf + finals');
  assert(built.rounds[0].name === 'Last 16', 'round name Last 16');
  assert(built.rounds[0].slots.length === 4, '4 R16');
  assert(built.rounds[0].slots[0].homeSeedLabel === 'C2', 'R16-1 C2');
  assert(built.rounds[0].slots[0].awaySeedLabel === 'B3', 'R16-1 B3');
  assert(built.rounds[0].slots[1].homeSeedLabel === 'B2', 'R16-2 B2');
  assert(built.rounds[0].slots[1].awaySeedLabel === 'C3', 'R16-2 C3');
  assert(built.rounds[0].slots[2].homeSeedLabel === 'D2', 'R16-3 D2');
  assert(built.rounds[0].slots[2].awaySeedLabel === 'A3', 'R16-3 A3');
  assert(built.rounds[0].slots[3].homeSeedLabel === 'A2', 'R16-4 A2');
  assert(built.rounds[0].slots[3].awaySeedLabel === 'D3', 'R16-4 D3');
  assert(built.rounds[1].name === 'Quarters', 'quarters');
  assert(built.rounds[1].slots.length === 4, '4 QF');
  assert(built.rounds[1].slots[0].homeSeedLabel === 'A1', 'QF1 A1 bye');
  assert(
    built.rounds[1].slots[0].awayFromSlotId === built.rounds[0].slots[0].id,
    'QF1←R16-1'
  );
  assert(
    built.rounds[1].slots[1].homeFromSlotId === built.rounds[0].slots[1].id,
    'QF2←R16-2'
  );
  assert(built.rounds[1].slots[1].awaySeedLabel === 'D1', 'QF2 D1 bye');
  assert(built.rounds[1].slots[2].homeSeedLabel === 'B1', 'QF3 B1 bye');
  assert(built.rounds[1].slots[3].awaySeedLabel === 'C1', 'QF4 C1 bye');
  assert(built.rounds[2].slots[0].label === 'SF1', 'SF1');
  assert(built.rounds[3].slots[0].winnerPlace === 1, 'final 1st');
  assert(built.rounds[3].slots[1].loserPlace === 4, '3rd loser 4th');
}

function testLast16(): void {
  const built = buildLast16Bracket('stage-16');
  assert(built.rounds.length === 4, 'r16 + qf + sf + finals');
  assert(built.rounds[0].name === 'Last 16', 'round name Last 16');
  assert(built.rounds[0].slots.length === 8, '8 R16');
  for (let i = 0; i < 8; i++) {
    assert(built.rounds[0].slots[i].label === `R16-${i + 1}`, `R16-${i + 1}`);
  }
  assert(built.rounds[0].slots[0].homeSeedLabel === 'A1', 'R16-1 A1');
  assert(built.rounds[0].slots[0].awaySeedLabel === 'C4', 'R16-1 C4');
  assert(built.rounds[0].slots[1].homeSeedLabel === 'C2', 'R16-2 C2');
  assert(built.rounds[0].slots[3].awaySeedLabel === 'C3', 'R16-4 C3');
  assert(built.rounds[0].slots[4].homeSeedLabel === 'B1', 'R16-5 B1');
  assert(built.rounds[0].slots[7].awaySeedLabel === 'D3', 'R16-8 D3');
  assert(built.rounds[1].name === 'Quarters', 'quarters');
  assert(built.rounds[1].slots.length === 4, '4 QF');
  assert(built.rounds[1].slots[0].label === 'QF1', 'QF1');
  assert(
    built.rounds[1].slots[0].homeFromSlotId === built.rounds[0].slots[0].id,
    'QF1←R16-1'
  );
  assert(
    built.rounds[1].slots[0].awayFromSlotId === built.rounds[0].slots[1].id,
    'QF1←R16-2'
  );
  assert(built.rounds[2].slots[0].label === 'SF1', 'SF1');
  assert(
    built.rounds[2].slots[0].homeFromSlotId === built.rounds[1].slots[0].id,
    'SF1←QF1'
  );
  assert(built.rounds[3].slots[0].label === 'Final', 'Final');
  assert(built.rounds[3].slots[0].winnerPlace === 1, 'final 1st');
  assert(built.rounds[3].slots[1].label === '3rd Place', '3rd');
  assert(built.rounds[3].slots[1].loserPlace === 4, '3rd loser 4th');
  assert(built.rounds[3].slots[1].homeFromOutcome === 'loser', '3rd from losers');
}

function testEightTeam(): void {
  const built = buildEightTeamBracket('stage-8');
  assert(built.rounds.length === 3, 'qf + sf + finals');
  assert(built.rounds[0].name === 'Quarters', 'quarters');
  assert(built.rounds[0].slots.length === 4, '4 QF');
  assert(built.rounds[0].slots[0].label === 'QF1', 'QF1');
  assert(built.rounds[0].slots[1].label === 'QF2', 'QF2');
  assert(built.rounds[0].slots[2].label === 'QF3', 'QF3');
  assert(built.rounds[0].slots[3].label === 'QF4', 'QF4');
  assert(built.rounds[0].slots[0].homeSeedLabel === 'A1', 'QF1 home seed');
  assert(built.rounds[0].slots[0].awaySeedLabel === 'C2', 'QF1 away seed');
  assert(built.rounds[1].slots[0].label === 'SF1', 'SF1');
  assert(built.rounds[1].slots[1].label === 'SF2', 'SF2');
  assert(
    built.rounds[1].slots[0].homeFromSlotId === built.rounds[0].slots[0].id,
    'SF1←QF1'
  );
  assert(
    built.rounds[1].slots[0].awayFromSlotId === built.rounds[0].slots[1].id,
    'SF1←QF2'
  );
  assert(built.rounds[2].slots[0].winnerPlace === 1, 'final 1st');
  assert(built.rounds[2].slots[1].loserPlace === 4, '3rd place loser 4th');
}

function main(): void {
  testTwelveTeam();
  testLast16();
  testEightTeam();
  const built = buildFourTeamBracket('stage-ivp-class');
  assert(built.rounds.length === 2, 'two rounds');
  assert(built.rounds[0].name === 'Semis', 'semis');
  assert(built.rounds[0].slots.length === 2, 'two semis');
  assert(built.rounds[0].slots[0].label === 'SF1', 'SF1');
  assert(built.rounds[0].slots[1].label === 'SF2', 'SF2');
  assert(built.rounds[0].slots[0].homeSeedLabel === 'A1', 'SF1 home seed');
  assert(built.rounds[0].slots[0].awaySeedLabel === 'B2', 'SF1 away seed');
  assert(built.rounds[0].slots[1].homeSeedLabel === 'B1', 'SF2 home seed');
  assert(built.rounds[0].slots[1].awaySeedLabel === 'A2', 'SF2 away seed');
  assert(built.rounds[1].slots.length === 2, 'final + 3rd');
  assert(built.rounds[1].slots[0].label === 'Final', 'final');
  assert(built.rounds[1].slots[1].label === '3rd Place', '3rd');
  assert(built.rounds[1].slots[0].winnerPlace === 1, 'final winner place');
  assert(built.rounds[1].slots[0].loserPlace === 2, 'final loser place');
  assert(built.rounds[1].slots[1].winnerPlace === 3, '3rd winner place');
  assert(built.rounds[1].slots[1].homeFromOutcome === 'loser', '3rd from losers');

  const empty: TournamentStructure = {
    stages: [
      {
        id: 'grp',
        name: 'Groups',
        kind: 'round_robin',
        order: 1,
        groups: [],
      },
      {
        id: 'stage-empty',
        name: 'Classification',
        kind: 'classification',
        order: 2,
      },
    ],
  };
  assert(classificationStagesNeedBracketSlots(empty), 'needs slots');
  const filled = ensureClassificationBrackets(empty);
  assert(!classificationStagesNeedBracketSlots(filled), 'filled');
  const classStage = filled.stages.find((s) => s.id === 'stage-empty');
  assert(classStage?.bracket?.rounds.length === 2, 'applied 4-team');
  assert(countBracketSlots(filled) === 4, '4 slots');

  // Idempotent
  const again = ensureClassificationBrackets(filled);
  assert(JSON.stringify(again) === JSON.stringify(filled), 'idempotent');

  // IUBIT still gets IUBIT templates, not generic 4-team
  const teams = IUBIT_2026_GROUPS.flatMap((g) =>
    g.abbreviations.map((abbreviation) => ({
      id: `id-${abbreviation}`,
      abbreviation,
    }))
  );
  const iubit = buildIubit2026Structure(teams);
  assert(iubit, 'iubit structure');
  const bareIubit: TournamentStructure = {
    stages: iubit.stages.map((s) => {
      if (s.kind !== 'classification') return s;
      const { bracket: _b, ...rest } = s;
      return rest;
    }),
  };
  const ensured = ensureClassificationBrackets(bareIubit);
  assert(countBracketSlots(ensured) === 13, 'IUBIT 13 slots via combined ensure');
  const oneFour = ensured.stages.find((s) => s.id === 'iubit-stage-1-4');
  assert(oneFour?.bracket?.rounds[0]?.slots[0]?.label === 'A1 vs D1', 'IUBIT label');

  // Existing linked slot preserved when re-ensuring generic (no wipe)
  const withGame = ensureClassificationBrackets({
    stages: [
      {
        id: 'stage-linked',
        name: 'Classification',
        kind: 'classification',
        order: 1,
        bracket: {
          rounds: [
            {
              id: 'stage-linked-r-sf',
              name: 'Semis',
              slots: [
                {
                  id: 'stage-linked-sf-a1b2',
                  label: 'A1 vs B2',
                  gameId: 'g1',
                },
                {
                  id: 'stage-linked-sf-b1a2',
                  label: 'B1 vs A2',
                  gameId: null,
                },
              ],
            },
            {
              id: 'stage-linked-r-finals',
              name: 'Finals',
              slots: [
                { id: 'stage-linked-final', label: 'Final' },
                { id: 'stage-linked-3rd', label: '3rd Place' },
              ],
            },
          ],
        },
      },
    ],
  });
  const sf = withGame.stages[0].bracket?.rounds[0].slots[0];
  assert(sf?.gameId === 'g1', 'preserved gameId on non-empty bracket');

  // Sanity: bare IUBIT path still works via ensureIubit alone
  assert(
    countBracketSlots(ensureIubitClassificationBrackets(bareIubit)) === 13,
    'ensureIubit alone'
  );

  console.log('PASS: test-four-team-bracket');
}

main();
