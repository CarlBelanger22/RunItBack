/**
 * LE-95 — IUBIT 2026 structure builder.
 * Run: npm run test:iubit-2026-structure
 */
import {
  buildIubit2026Structure,
  canBuildIubit2026Structure,
  IUBIT_2026_GROUPS,
} from '../src/utils/iubit2026Structure';

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
  assert(canBuildIubit2026Structure(teams), 'can build');
  const structure = buildIubit2026Structure(teams);
  assert(structure, 'structure');
  assert(structure.stages.length === 5, '1 group + 4 classification');
  const groups = structure.stages[0].groups ?? [];
  assert(groups.length === 4, '4 groups');
  assert(groups[0].teamIds.length === 3, 'A=3');
  assert(groups[2].teamIds.length === 4, 'C=4');
  assert(
    structure.stages.some((s) => s.name === '13th–14th Placement' && s.kind === 'classification'),
    '13-14 stage'
  );
  const slotCount = structure.stages.reduce(
    (n, s) => n + (s.bracket?.rounds ?? []).reduce((m, r) => m + r.slots.length, 0),
    0
  );
  assert(slotCount === 13, `expected 13 bracket slots, got ${slotCount}`);
  assert(
    !canBuildIubit2026Structure(teams.slice(0, 10)),
    'missing team blocks build'
  );
  console.log('PASS: test-iubit-2026-structure');
}

main();
