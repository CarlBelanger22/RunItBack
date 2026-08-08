/**
 * LE-111 — bracket place helpers + structure slot fields.
 * Run: npm run test:bracket-places
 */
import {
  formatFinishPlace,
  inferPlacesFromLabel,
  placeForMatchSide,
  resolveSlotPlaces,
} from '../src/utils/bracketPlaces';
import {
  normalizeTournamentStructure,
  type BracketSlot,
} from '../src/utils/tournamentStructure';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testFormat(): void {
  assert(formatFinishPlace(1) === '1st', '1st');
  assert(formatFinishPlace(2) === '2nd', '2nd');
  assert(formatFinishPlace(3) === '3rd', '3rd');
  assert(formatFinishPlace(4) === '4th', '4th');
  assert(formatFinishPlace(11) === '11th', '11th');
  assert(formatFinishPlace(12) === '12th', '12th');
  assert(formatFinishPlace(21) === '21st', '21st');
}

function testInfer(): void {
  assert(inferPlacesFromLabel('Final')?.winner === 1, 'Final winner');
  assert(inferPlacesFromLabel('Final')?.loser === 2, 'Final loser');
  assert(inferPlacesFromLabel('3rd Place')?.winner === 3, '3rd');
  assert(inferPlacesFromLabel('3rd Place')?.loser === 4, '4th');
  assert(inferPlacesFromLabel('5th')?.winner === 5, '5th');
  assert(inferPlacesFromLabel('13th Place')?.winner === 13, '13th Place');
  assert(inferPlacesFromLabel('13th Place')?.loser === 14, '14th from 13th Place');
  assert(inferPlacesFromLabel('13th–14th Placement')?.winner === 13, '13-14 band');
  assert(inferPlacesFromLabel('A1 vs B2') == null, 'no place for SF');
  assert(inferPlacesFromLabel('C4 vs D4') == null, 'seed label alone');
}

function testResolveWithHint(): void {
  const slot: BracketSlot = {
    id: 'iubit-slot-13-14',
    label: 'C4 vs D4',
  };
  const places = resolveSlotPlaces(slot, ['13th Place']);
  assert(places.winner === 13, 'hint winner');
  assert(places.loser === 14, 'hint loser');
  assert(
    placeForMatchSide(slot, true, false, ['13th Place']) === 13,
    'hint winner side'
  );
}

function testResolveOverride(): void {
  const slot: BracketSlot = {
    id: 's1',
    label: 'Final',
    winnerPlace: 5,
    loserPlace: 6,
  };
  const places = resolveSlotPlaces(slot);
  assert(places.winner === 5, 'override winner');
  assert(places.loser === 6, 'override loser');
  assert(placeForMatchSide(slot, true, false) === 5, 'winner side');
  assert(placeForMatchSide(slot, false, true) === 6, 'loser side');
}

function testNormalizeSlotFields(): void {
  const normalized = normalizeTournamentStructure({
    stages: [
      {
        id: 'c1',
        name: 'Class',
        kind: 'classification',
        order: 1,
        bracket: {
          rounds: [
            {
              id: 'r1',
              name: 'R1',
              slots: [
                {
                  id: 'slot-1',
                  label: 'Play-in',
                  homeFromSlotId: 'slot-0',
                  homeFromOutcome: 'loser',
                  awaySeedLabel: 'A3',
                  homeSeedLabel: 'B3',
                  winnerPlace: 5,
                  loserPlace: 7,
                },
              ],
            },
          ],
        },
      },
    ],
  });
  const slot = normalized!.stages[0].bracket!.rounds[0].slots[0];
  assert(slot.homeFromOutcome === 'loser', 'outcome');
  assert(slot.awaySeedLabel === 'A3', 'away seed');
  assert(slot.homeSeedLabel === 'B3', 'home seed');
  assert(slot.winnerPlace === 5, 'winner place');
  assert(slot.loserPlace === 7, 'loser place');
}

function testSuppressPlaceWhenOutcomeFeedsFurther(): void {
  const semi: BracketSlot = {
    id: 'sf-5th',
    label: '5th Place',
    winnerPlace: 5,
    loserPlace: 6,
  };
  const final6: BracketSlot = {
    id: 'f-6th',
    label: '6th Place',
    homeFromSlotId: 'sf-5th',
    homeFromOutcome: 'loser',
    awaySeedLabel: 'A3',
    winnerPlace: 6,
    loserPlace: 7,
  };
  const rounds = [
    { id: 'r-sf', name: 'Semis', slots: [semi] },
    { id: 'r-f', name: 'Finals', slots: [final6] },
  ];

  assert(
    placeForMatchSide(semi, true, false, [], rounds) === 5,
    'semi winner still 5th'
  );
  assert(
    placeForMatchSide(semi, false, true, [], rounds) == null,
    'semi loser no 6th yet (feeds further)'
  );
  assert(
    placeForMatchSide(final6, true, false, [], rounds) === 6,
    '6th place match winner'
  );
  assert(
    placeForMatchSide(final6, false, true, [], rounds) === 7,
    '6th place match loser = 7th'
  );
}

function main(): void {
  testFormat();
  testInfer();
  testResolveWithHint();
  testResolveOverride();
  testNormalizeSlotFields();
  testSuppressPlaceWhenOutcomeFeedsFurther();
  console.log('test-bracket-places: all passed');
}

main();
