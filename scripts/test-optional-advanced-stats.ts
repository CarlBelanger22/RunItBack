/**
 * Optional advanced team stat display: null vs recorded zero.
 *
 * Usage: npx tsx scripts/test-optional-advanced-stats.ts
 */

import type { TeamStats } from '../src/App';
import {
  getOptionalAdvancedStatValue,
  isOptionalAdvancedStatRecorded,
} from '../src/utils/gameDisplay';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const base: TeamStats = {
  teamId: 'team-test',
  q1_points: 0,
  q2_points: 0,
  q3_points: 0,
  q4_points: 0,
  ot_points: 0,
  total_points: 0,
  fg_made: 0,
  fg_attempted: 0,
  three_made: 0,
  three_attempted: 0,
  two_made: 0,
  two_attempted: 0,
  ft_made: 0,
  ft_attempted: 0,
  orb: 0,
  drb: 0,
  team_rebounds: 0,
  total_rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  points_off_turnovers: null,
  points_in_paint: null,
  second_chance_points: null,
  fastbreak_points: null,
  bench_points: null,
  biggest_lead: null,
  biggest_scoring_run: null,
};

assert(
  getOptionalAdvancedStatValue(base, 'fastbreak_points', false) === null,
  'null should display as not recorded'
);

assert(
  getOptionalAdvancedStatValue(
    { ...base, fastbreak_points: 0 },
    'fastbreak_points',
    false
  ) === 0,
  'recorded zero should return 0'
);

assert(
  getOptionalAdvancedStatValue(
    { ...base, fastbreak_points: 19 },
    'fastbreak_points',
    false
  ) === 19,
  'positive value should return value'
);

assert(
  getOptionalAdvancedStatValue(base, 'fastbreak_points', true) === null,
  'score-only team should be not recorded'
);

assert(!isOptionalAdvancedStatRecorded(null), 'null is not recorded');
assert(isOptionalAdvancedStatRecorded(0), 'zero is recorded');
assert(isOptionalAdvancedStatRecorded(3), 'positive is recorded');

console.log('test-optional-advanced-stats: PASS');
