import type { Game, GameEvent, Shot } from '../App';

/** Length of a JSON array column / in-memory list; non-arrays → 0. */
export function pbpArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Keep DB / richer PBP when an incoming write would wipe it with [].
 * Mirrors shouldPreserveExistingGameStats for events/shots.
 */
export function shouldPreserveExistingPbpArray(
  incoming: unknown,
  existing: unknown
): boolean {
  return pbpArrayLength(existing) > 0 && pbpArrayLength(incoming) === 0;
}

export interface GamePbpColumns {
  events: unknown;
  shots: unknown;
  lineup_stints?: unknown;
}

/** Apply preserve rules onto a DB-shaped game row (mutates a shallow copy). */
export function applyPreservedPbpToDbRow<T extends GamePbpColumns>(
  row: T,
  existing: GamePbpColumns | undefined
): T {
  if (!existing) return row;
  const next = { ...row };
  if (shouldPreserveExistingPbpArray(row.events, existing.events)) {
    next.events = existing.events;
  }
  if (shouldPreserveExistingPbpArray(row.shots, existing.shots)) {
    next.shots = existing.shots;
  }
  if (
    shouldPreserveExistingPbpArray(
      row.lineup_stints ?? [],
      existing.lineup_stints ?? []
    )
  ) {
    next.lineup_stints = existing.lineup_stints;
  }
  return next;
}

/**
 * When preferring a completed (or other) shell, copy events/shots from the
 * richer sibling if the preferred copy would otherwise drop PBP.
 */
export function withRicherPbp(preferred: Game, other: Game): Game {
  if (preferred.id !== other.id) return preferred;

  const prefEvents = preferred.events ?? [];
  const otherEvents = other.events ?? [];
  const prefShots = preferred.shots ?? [];
  const otherShots = other.shots ?? [];

  let events: GameEvent[] = prefEvents;
  let shots: Shot[] = prefShots;

  if (otherEvents.length > prefEvents.length) {
    events = otherEvents;
  }
  if (otherShots.length > prefShots.length) {
    shots = otherShots;
  }

  if (events === prefEvents && shots === prefShots) return preferred;

  return {
    ...preferred,
    events,
    shots,
  };
}
