/**
 * LE-95.5 — IUBIT classification bracket slots.
 * Run: npm run test:iubit-2026-bracket
 */
import {
  buildIubit2026Structure,
  IUBIT_2026_GROUPS,
} from '../src/utils/iubit2026Structure';
import {
  classificationStagesNeedBracketSlots,
  countBracketSlots,
  ensureIubitClassificationBrackets,
  iubitClassificationBracketForStage,
} from '../src/utils/iubit2026Bracket';
import type { TournamentStructure } from '../src/utils/tournamentStructure';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  const teams = IUBIT_2026_GROUPS.flatMap((g) =>
    g.abbreviations.map((abbreviation) => ({
      id: `id-${abbreviation}`,
      abbreviation,
    }))
  );
  const structure = buildIubit2026Structure(teams);
  assert(structure, 'structure');
  assert(countBracketSlots(structure) === 13, `expected 13 slots, got ${countBracketSlots(structure)}`);
  // 1-4: 4, 5-8: 4, 9-12: 4, 13-14: 1 = 13

  const sf = iubitClassificationBracketForStage('iubit-stage-1-4');
  assert(sf?.rounds.length === 2, '1-4 two rounds');
  assert(sf!.rounds[0].slots[0].label === 'A1 vs D1', 'A vs D semis');
  assert(
    iubitClassificationBracketForStage('iubit-stage-13-14')?.rounds[0].slots[0]
      .label === 'C4 vs D4',
    '13/14 direct'
  );

  // Stages without brackets → ensure fills them
  const bare: TournamentStructure = {
    stages: structure.stages.map((s) => {
      if (s.kind !== 'classification') return s;
      const { bracket: _b, ...rest } = s;
      return rest;
    }),
  };
  assert(classificationStagesNeedBracketSlots(bare), 'needs slots');
  const filled = ensureIubitClassificationBrackets(bare);
  assert(!classificationStagesNeedBracketSlots(filled), 'filled');
  assert(countBracketSlots(filled) === 13, 'ensured 13');

  // Preserve gameId on re-ensure
  const withLink = ensureIubitClassificationBrackets({
    stages: filled.stages.map((s) => {
      if (s.id !== 'iubit-stage-13-14') return s;
      return {
        ...s,
        bracket: {
          rounds: [
            {
              id: 'iubit-r-13-14',
              name: 'Placement',
              slots: [
                {
                  id: 'iubit-slot-13-14',
                  label: 'C4 vs D4',
                  gameId: 'game-13-14',
                },
              ],
            },
          ],
        },
      };
    }),
  });
  const slot13 = withLink.stages
    .find((s) => s.id === 'iubit-stage-13-14')
    ?.bracket?.rounds[0]?.slots[0];
  assert(slot13?.gameId === 'game-13-14', 'preserve link');

  console.log('PASS: test-iubit-2026-bracket');
}

main();
