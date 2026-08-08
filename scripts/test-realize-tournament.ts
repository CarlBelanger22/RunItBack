/**
 * Tests for tournament score-sequence realization (LE-130).
 * Run: npx tsx scripts/test-realize-tournament.ts
 */

import {
  isLandauScoreSequence,
  realizeTournament,
} from '../src/utils/realizeTournament';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function countWins(edges: { winnerId: string; loserId: string }[], id: string): number {
  return edges.filter((e) => e.winnerId === id).length;
}

// Classic 3-cycle
{
  assert(isLandauScoreSequence([1, 1, 1]), '3-cycle Landau');
  const edges = realizeTournament([
    { id: 'a', wins: 1 },
    { id: 'b', wins: 1 },
    { id: 'c', wins: 1 },
  ]);
  assert(edges && edges.length === 3, '3-cycle edges');
  assert(countWins(edges!, 'a') === 1, 'a wins');
  assert(countWins(edges!, 'b') === 1, 'b wins');
  assert(countWins(edges!, 'c') === 1, 'c wins');
}

// Invalid: sum wrong
{
  assert(isLandauScoreSequence([2, 1, 0]), 'linear Landau');
  assert(!isLandauScoreSequence([3, 0, 0]), 'sum too small');
  assert(!isLandauScoreSequence([2, 2, 2]), 'sum too big');
}

// Linear hierarchy
{
  const edges = realizeTournament([
    { id: 'a', wins: 2 },
    { id: 'b', wins: 1 },
    { id: 'c', wins: 0 },
  ]);
  assert(edges && edges.length === 3, 'linear edges');
  assert(countWins(edges!, 'a') === 2, 'a=2');
  assert(countWins(edges!, 'b') === 1, 'b=1');
  assert(countWins(edges!, 'c') === 0, 'c=0');
}

// NBL Div 2 remaining 11-team targets
{
  const targets = [
    { id: 'tungsan', wins: 9 },
    { id: 'clementi', wins: 9 },
    { id: 'police', wins: 7 },
    { id: 'sinkee', wins: 6 },
    { id: 'loaded', wins: 5 },
    { id: 'threeS', wins: 5 },
    { id: 'safsa', wins: 4 },
    { id: 'kts', wins: 4 },
    { id: 'gmac', wins: 3 },
    { id: 'tampines', wins: 2 },
    { id: 'amity', wins: 1 },
  ];
  assert(
    isLandauScoreSequence(targets.map((t) => t.wins)),
    'NBL remaining Landau'
  );
  const edges = realizeTournament(targets);
  assert(edges && edges.length === 55, `expected 55 edges, got ${edges?.length}`);
  for (const t of targets) {
    const w = countWins(edges!, t.id);
    assert(w === t.wins, `${t.id} expected ${t.wins} wins, got ${w}`);
  }
  // every pair exactly once
  const seen = new Set<string>();
  for (const e of edges!) {
    const key =
      e.winnerId < e.loserId
        ? `${e.winnerId}|${e.loserId}`
        : `${e.loserId}|${e.winnerId}`;
    assert(!seen.has(key), `duplicate pair ${key}`);
    seen.add(key);
  }
  assert(seen.size === 55, '55 unique pairs');
}

console.log('test-realize-tournament: ok');
