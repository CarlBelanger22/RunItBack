/**
 * LE-125 — Soft-remove first-round bracket legs.
 * Run: npx tsx scripts/test-bracket-legs.ts
 */
import {
  canRemoveBracketLeg,
  canRestoreBracketLeg,
  isSlotInactive,
  removeBracketLeg,
  restoreBracketLeg,
} from '../src/utils/bracketLegs';
import { buildLast16Bracket } from '../src/utils/fourTeamBracket';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  const { rounds } = buildLast16Bracket('stage-16');
  const r16_1 = rounds[0].slots[0].id;
  const qf1 = rounds[1].slots[0].id;

  assert(canRemoveBracketLeg(rounds, r16_1), 'can remove R16-1');
  assert(!canRemoveBracketLeg(rounds, qf1), 'cannot remove QF (not first round)');

  const removed = removeBracketLeg(rounds, r16_1);
  const r16 = removed[0].slots[0];
  const qf = removed[1].slots[0];
  assert(isSlotInactive(r16), 'R16 inactive');
  assert(r16.inactiveFeedSlotId === qf1, 'remember QF');
  assert(r16.inactiveFeedSide === 'home', 'remember home side');
  assert(qf.homeFromSlotId == null, 'QF home feeder cleared');
  assert(qf.homeSeedLabel == null, 'QF home seed empty');
  assert(qf.awayFromSlotId === rounds[0].slots[1].id, 'QF away still R16-2');
  assert(canRestoreBracketLeg(removed, r16_1), 'can restore');

  const restored = restoreBracketLeg(removed, r16_1);
  assert(!isSlotInactive(restored[0].slots[0]), 'active again');
  assert(
    restored[1].slots[0].homeFromSlotId === r16_1,
    'feeder restored'
  );
  assert(restored[1].slots[0].homeFromOutcome === 'winner', 'winner outcome');

  console.log('PASS: test-bracket-legs');
}

main();
