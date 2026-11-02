import type { Game, GameEvent, Shot } from '../App';

/** Length of a JSON array column / in-memory list; non-arrays → 0. */
export function pbpArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export interface PreservePbpOptions {
  /**
   * When false (default), keep DB PBP if incoming is empty OR strictly shorter
   * (stale tab / completed shell). Live single-game saves pass true so Undo can sync.
   */
  allowShrink?: boolean;
}

/**
 * Keep DB / richer PBP when an incoming write would wipe or (by default) shrink it.
 * Mirrors shouldPreserveExistingGameStats for events/shots.
 */
export function shouldPreserveExistingPbpArray(
  incoming: unknown,
  existing: unknown,
  options?: PreservePbpOptions
): boolean {
  const existingLen = pbpArrayLength(existing);
  if (existingLen <= 0) return false;
  const incomingLen = pbpArrayLength(incoming);
  if (incomingLen === 0) return true;
  if (!options?.allowShrink && incomingLen < existingLen) return true;
  return false;
}

export interface GamePbpColumns {
  events: unknown;
  shots: unknown;
  lineup_stints?: unknown;
}

/** Apply preserve rules onto a DB-shaped game row (shallow copy). */
export function applyPreservedPbpToDbRow<T extends GamePbpColumns>(
  row: T,
  existing: GamePbpColumns | undefined,
  options?: PreservePbpOptions
): T {
  if (!existing) return row;
  const next = { ...row };
  if (shouldPreserveExistingPbpArray(row.events, existing.events, options)) {
    next.events = existing.events;
  }
  if (shouldPreserveExistingPbpArray(row.shots, existing.shots, options)) {
    next.shots = existing.shots;
  }
  if (
    shouldPreserveExistingPbpArray(
      row.lineup_stints ?? [],
      existing.lineup_stints ?? [],
      options
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
