/**
 * LE-130 — verify NBL Div 2 remaining RR orientation hits full-table W–L.
 * Run: npx tsx scripts/test-nbl-div2-schedule.ts
 */

import {
  TEAM,
  REMAINING_WIN_TARGETS,
  buildRemainingRrGames,
  allNewScoreOnlyGames,
  FULL_RR_TARGET_WINS,
  PROTECTED_GAME_IDS,
  KO_SCORE_ONLY_GAMES,
} from './nbl-div2-schedule-data';
import { isLandauScoreSequence } from '../src/utils/realizeTournament';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Landau on remaining
assert(
  isLandauScoreSequence(REMAINING_WIN_TARGETS.map((t) => t.wins)),
  'remaining Landau'
);

const rr = buildRemainingRrGames();
assert(rr.length === 55, `55 RR games, got ${rr.length}`);

const wins = new Map<string, number>();
for (const t of REMAINING_WIN_TARGETS) wins.set(t.id, 0);
for (const g of rr) {
  assert(g.homeScore > g.awayScore, `${g.id} home must win`);
  assert(!g.id.includes('kai'), 'no kai xuan in new RR ids');
  wins.set(g.homeTeamId, (wins.get(g.homeTeamId) ?? 0) + 1);
}
for (const t of REMAINING_WIN_TARGETS) {
  assert(
    wins.get(t.id) === t.wins,
    `${t.key} expected ${t.wins} remaining wins, got ${wins.get(t.id)}`
  );
}

// Unique pairs
const pairs = new Set(rr.map((g) => [g.homeTeamId, g.awayTeamId].sort().join('|')));
assert(pairs.size === 55, '55 unique RR pairs');

// No overlap with protected ids
const newIds = new Set(allNewScoreOnlyGames().map((g) => g.id));
for (const id of PROTECTED_GAME_IDS) {
  assert(!newIds.has(id), `must not overwrite protected ${id}`);
}

assert(KO_SCORE_ONLY_GAMES.length === 2, 'SF2 + Final');
assert(
  KO_SCORE_ONLY_GAMES[0].awayScore > KO_SCORE_ONLY_GAMES[0].homeScore,
  'Police beat Clementi'
);
assert(
  KO_SCORE_ONLY_GAMES[1].homeScore > KO_SCORE_ONLY_GAMES[1].awayScore,
  'Tungsan beat Police'
);

// Full table: locked KX RR (7W) + remaining
const kxLockedWins: Record<string, number> = {
  [TEAM.kaiXuan]: 7,
  [TEAM.safsa]: 1,
  [TEAM.police]: 1,
  [TEAM.tungsan]: 1,
  [TEAM.loaded]: 1,
  // losers vs KX get 0 from those games
};
const full = { ...FULL_RR_TARGET_WINS };
const computed: Record<string, number> = {};
for (const id of Object.keys(full)) computed[id] = 0;
computed[TEAM.kaiXuan] = 7;
for (const [id, w] of Object.entries(kxLockedWins)) {
  if (id === TEAM.kaiXuan) continue;
  computed[id] = (computed[id] ?? 0) + w;
}
for (const g of rr) {
  computed[g.homeTeamId] = (computed[g.homeTeamId] ?? 0) + 1;
}
for (const [id, target] of Object.entries(full)) {
  assert(
    computed[id] === target,
    `full ${id}: expected ${target}, got ${computed[id]}`
  );
}

console.log('test-nbl-div2-schedule: ok');
console.log(`  RR games: ${rr.length}, KO new: ${KO_SCORE_ONLY_GAMES.length}`);
console.log(`  Sample RR: ${rr[0].id} ${rr[0].homeScore}-${rr[0].awayScore}`);
