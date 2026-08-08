/**
 * Seed codes A1…Z16.
 * Run: npx tsx scripts/test-seed-codes.ts
 */
import {
  normalizeSeedCode,
  parseSeedMatchupLabel,
  SEED_MAX_PLACE,
} from '../src/utils/seedCodes';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(SEED_MAX_PLACE === 16, 'max 16');
  assert(normalizeSeedCode('A1') === 'A1', 'A1');
  assert(normalizeSeedCode('a10') === 'A10', 'a10');
  assert(normalizeSeedCode('A16') === 'A16', 'A16');
  assert(normalizeSeedCode('A17') === null, 'A17 rejected');
  assert(normalizeSeedCode('A0') === null, 'A0 rejected');
  assert(normalizeSeedCode('B8') === 'B8', 'B8');
  assert(normalizeSeedCode('10') === null, 'no letter');

  const pair = parseSeedMatchupLabel('A10 vs A2');
  assert(pair?.[0] === 'A10' && pair?.[1] === 'A2', 'matchup A10 vs A2');
  assert(parseSeedMatchupLabel('A17 vs A1') === null, 'bad matchup');

  console.log('PASS: test-seed-codes');
}

main();
