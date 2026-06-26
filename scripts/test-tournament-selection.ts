/**
 * Run: npm run test:tournament-selection
 */

import {
  applySelectAllTournaments,
  applyTournamentToggle,
  isAllTournamentsSelected,
  isNoTournamentsSelected,
  isTournamentCheckedInScope,
  parseTournamentSelection,
  pruneTournamentSelection,
  serializeTournamentSelection,
  tournamentMatchesSelection,
  tournamentSelectionTriggerLabel,
  toggleTournamentInSelection,
  TOURNAMENT_SELECTION_NONE,
  type TournamentSelectOption,
} from '../src/utils/tournamentSelection';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const OPTIONS: TournamentSelectOption[] = [
  { id: 't-5a', label: 'Five A', gameFormat: '5v5' },
  { id: 't-5b', label: 'Five B', gameFormat: '5v5' },
  { id: 't-3a', label: 'Three A', gameFormat: '3x3' },
];

function testParseSerialize(): void {
  assert(parseTournamentSelection(null) === null, 'null → all');
  assert(parseTournamentSelection(undefined) === null, 'undefined → all');
  assert(parseTournamentSelection('t-a,t-b')!.size === 2, 'parse two');
  assert(
    serializeTournamentSelection(new Set(['t-b', 't-a'])) === 't-a,t-b',
    'sorted serialize'
  );
  assert(serializeTournamentSelection(null) === undefined, 'all omit');
  assert(
    serializeTournamentSelection(new Set()) === TOURNAMENT_SELECTION_NONE,
    'none sentinel'
  );
  assert(parseTournamentSelection(TOURNAMENT_SELECTION_NONE)!.size === 0, 'none parse');
}

function testMatchAndAll(): void {
  assert(tournamentMatchesSelection('t-a', null), 'null matches all');
  assert(tournamentMatchesSelection('t-a', new Set(['t-a'])), 'explicit match');
  assert(!tournamentMatchesSelection('t-b', new Set(['t-a'])), 'no match');
  assert(!tournamentMatchesSelection('t-a', new Set()), 'none matches nothing');
  assert(isAllTournamentsSelected(null, ['t-a']), 'null is all');
  assert(isAllTournamentsSelected(new Set(['t-a', 't-b']), ['t-a', 't-b']), 'full set is all');
  assert(!isAllTournamentsSelected(new Set(['t-a']), ['t-a', 't-b']), 'partial not all');
  assert(isNoTournamentsSelected(new Set()), 'empty set is none');
  assert(!isNoTournamentsSelected(null), 'null is not none');
}

function testPruneAndToggle(): void {
  assert(
    pruneTournamentSelection(new Set(['t-a', 't-x']), ['t-a', 't-b'])!.size === 1,
    'prune unknown'
  );
  assert(
    pruneTournamentSelection(new Set(['t-a', 't-b']), ['t-a', 't-b']) === null,
    'prune full → all'
  );
  const toggled = toggleTournamentInSelection(new Set(), 't-a', true, ['t-a', 't-b']);
  assert(toggled!.size === 1 && toggled!.has('t-a'), 'toggle on from none');
  const allViaToggle = toggleTournamentInSelection(new Set(['t-a', 't-b']), 't-c', true, [
    't-a',
    't-b',
    't-c',
  ]);
  assert(allViaToggle === null, 'select last → all sentinel');
  const fromAll = toggleTournamentInSelection(null, 't-b', false, ['t-a', 't-b', 't-c']);
  assert(fromAll!.size === 2 && !fromAll!.has('t-b'), 'uncheck from all');
}

function testLabel(): void {
  assert(
    tournamentSelectionTriggerLabel(null, OPTIONS, '5v5') === 'All 5v5 tournaments',
    'all 5v5 label'
  );
  assert(
    tournamentSelectionTriggerLabel(null, OPTIONS, '3x3') === 'All 3×3 tournaments',
    'all 3x3 label'
  );
  assert(
    tournamentSelectionTriggerLabel(new Set(), OPTIONS) === 'No tournaments',
    'none label'
  );
  assert(
    tournamentSelectionTriggerLabel(new Set(['t-5a']), OPTIONS) === 'Five A',
    'single label'
  );
  assert(
    tournamentSelectionTriggerLabel(new Set(['t-5a', 't-5b']), OPTIONS) === '2 tournaments',
    'multi label'
  );
}

function testFormatAwareChecks(): void {
  assert(
    isTournamentCheckedInScope('t-5a', '5v5', '5v5', null, OPTIONS),
    '5v5 checked on 5v5 scope'
  );
  assert(
    !isTournamentCheckedInScope('t-3a', '3x3', '5v5', null, OPTIONS),
    '3x3 unchecked on 5v5 scope'
  );
  assert(
    isTournamentCheckedInScope('t-3a', '3x3', '3x3', null, OPTIONS),
    '3x3 checked on 3x3 scope'
  );
  assert(
    !isTournamentCheckedInScope('t-5a', '5v5', '3x3', null, OPTIONS),
    '5v5 unchecked on 3x3 scope'
  );
}

function testFormatAwareToggle(): void {
  const partial5v5 = new Set(['t-5a']);
  const add3x3ToPartial = applyTournamentToggle('t-3a', true, '5v5', partial5v5, OPTIONS);
  assert(add3x3ToPartial.format === 'combined', '3x3 on partial 5v5 → combined');
  assert(add3x3ToPartial.selection!.size === 2, 'keeps partial 5v5 + 3x3');
  assert(
    add3x3ToPartial.selection!.has('t-5a') &&
      !add3x3ToPartial.selection!.has('t-5b') &&
      add3x3ToPartial.selection!.has('t-3a'),
    'only previously checked 5v5 remain'
  );

  const all5v5Add3x3 = applyTournamentToggle('t-3a', true, '5v5', null, OPTIONS);
  assert(all5v5Add3x3.format === 'combined', '3x3 on all 5v5 → combined');
  assert(all5v5Add3x3.selection === null, 'all tournaments → collapsed null');

  const afterSelectAll = applySelectAllTournaments();
  const afterUncheck3x3 = applyTournamentToggle(
    't-3a',
    false,
    afterSelectAll.format,
    afterSelectAll.selection,
    OPTIONS
  );
  assert(
    afterUncheck3x3.format === '5v5' && afterUncheck3x3.selection === null,
    'uncheck only 3x3 → all 5v5'
  );
  const afterRecheck3x3 = applyTournamentToggle(
    't-3a',
    true,
    afterUncheck3x3.format,
    afterUncheck3x3.selection,
    OPTIONS
  );
  assert(afterRecheck3x3.format === 'combined', 'recheck 3x3 → combined');
  assert(afterRecheck3x3.selection === null, 'all 5v5 + 3x3 restored');

  const toCombined = applyTournamentToggle('t-5a', true, '3x3', null, OPTIONS);
  assert(toCombined.format === 'combined', 'pick 5v5 on 3x3 → combined');
  assert(
    toCombined.selection!.has('t-5a') && toCombined.selection!.has('t-3a'),
    'combined keeps 3x3 + picked 5v5'
  );

  const partial3x3 = new Set(['t-3a']);
  const add5v5ToPartial3x3 = applyTournamentToggle('t-5b', true, '3x3', partial3x3, OPTIONS);
  assert(add5v5ToPartial3x3.format === 'combined', '5v5 on partial 3x3 → combined');
  assert(
    add5v5ToPartial3x3.selection!.has('t-3a') &&
      add5v5ToPartial3x3.selection!.has('t-5b') &&
      !add5v5ToPartial3x3.selection!.has('t-5a'),
    'only picked 5v5 added'
  );

  const selectAll = applySelectAllTournaments();
  assert(selectAll.format === 'combined' && selectAll.selection === null, 'select all → combined');
}

function main(): void {
  testParseSerialize();
  testMatchAndAll();
  testPruneAndToggle();
  testLabel();
  testFormatAwareChecks();
  testFormatAwareToggle();
  console.log('All tournament selection tests passed.');
}

main();
