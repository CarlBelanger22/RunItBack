/**
 * LE-103 — Generic Format A (Semis → Final + 3rd) brackets.
 * Run: npm run test:four-team-bracket
 */
import {
  buildFourTeamBracket,
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

function main(): void {
  const built = buildFourTeamBracket('stage-ivp-class');
  assert(built.rounds.length === 2, 'two rounds');
  assert(built.rounds[0].name === 'Semis', 'semis');
  assert(built.rounds[0].slots.length === 2, 'two semis');
  assert(built.rounds[0].slots[0].label === 'A1 vs B2', 'cross seed 1');
  assert(built.rounds[0].slots[1].label === 'B1 vs A2', 'cross seed 2');
  assert(built.rounds[1].slots.length === 2, 'final + 3rd');
  assert(built.rounds[1].slots[0].label === 'Final', 'final');
  assert(built.rounds[1].slots[1].label === '3rd Place', '3rd');
  assert(
    built.rounds[1].slots[0].homeFromSlotId === built.rounds[0].slots[0].id,
    'final feeds from SF1'
  );

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
