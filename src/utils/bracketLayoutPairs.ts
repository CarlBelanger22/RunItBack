/**
 * Pair first-round bracket slots with the next-round slot they actually feed.
 * Layout must follow homeFromSlotId / awayFromSlotId — not raw array index —
 * so rescheduled SF feeders (e.g. NBL) still draw truthful joins.
 */

import type { BracketSlot } from './tournamentStructure';

export interface FirstRoundFeederPair {
  a: BracketSlot;
  b: BracketSlot | undefined;
  next: BracketSlot;
}

function slotIndex(slots: BracketSlot[], id: string | null | undefined): number {
  if (!id) return Number.MAX_SAFE_INTEGER;
  const i = slots.findIndex((s) => s.id === id);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * For each next-round slot, take its feeder first-round slots (home then away).
 * Next-round order is preserved. Unfed next slots / leftover first-round slots
 * fall back to classic index pairing (0+1→next0, 2+3→next1, …).
 */
export function pairFirstRoundByFeeders(
  firstRound: BracketSlot[],
  nextRound: BracketSlot[]
): FirstRoundFeederPair[] {
  if (nextRound.length === 0) return [];

  const byId = new Map(firstRound.map((s) => [s.id, s]));
  const used = new Set<string>();
  const pairs: FirstRoundFeederPair[] = [];

  for (const next of nextRound) {
    const home = next.homeFromSlotId
      ? byId.get(next.homeFromSlotId)
      : undefined;
    const away = next.awayFromSlotId
      ? byId.get(next.awayFromSlotId)
      : undefined;
    const feeders = [home, away].filter((s): s is BracketSlot => Boolean(s));
    if (feeders.length === 0) continue;

    for (const f of feeders) used.add(f.id);

    // Prefer SF home feeder on top, then away; if only one side resolves, keep it.
    if (home && away) {
      pairs.push({ a: home, b: away, next });
    } else if (home) {
      pairs.push({ a: home, b: undefined, next });
    } else if (away) {
      pairs.push({ a: away, b: undefined, next });
    }
  }

  if (pairs.length === nextRound.length) {
    return pairs;
  }

  // Fallback: classic contiguous pairs when feeders are missing / incomplete.
  const leftoverFirst = firstRound.filter((s) => !used.has(s.id));
  const coveredNext = new Set(pairs.map((p) => p.next.id));
  const leftoverNext = nextRound.filter((s) => !coveredNext.has(s.id));

  const merged = [...pairs];
  for (let i = 0; i < leftoverNext.length; i += 1) {
    const a = leftoverFirst[i * 2];
    const b = leftoverFirst[i * 2 + 1];
    if (!a) break;
    merged.push({ a, b, next: leftoverNext[i]! });
  }

  // Stable: keep nextRound order
  return [...merged].sort(
    (x, y) =>
      slotIndex(nextRound, x.next.id) - slotIndex(nextRound, y.next.id)
  );
}
