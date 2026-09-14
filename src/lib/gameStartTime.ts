import type { Game } from '../App';

/** Prefer explicit tip time; otherwise keep a previously persisted one. */
export function resolveStartTimeForPersist(
  game: Pick<Game, 'startTime'>,
  existingMetaStartTime?: string | null
): string | undefined {
  const incoming = game.startTime?.trim();
  if (incoming) return incoming;
  const existing = existingMetaStartTime?.trim();
  return existing || undefined;
}

/** Copy tip time onto the game when memory lost it but storage still has it. */
export function applyPreservedStartTime(
  game: Game,
  existingMetaStartTime?: string | null
): Game {
  const startTime = resolveStartTimeForPersist(game, existingMetaStartTime);
  if (!startTime || game.startTime === startTime) return game;
  return { ...game, startTime };
}

/** Live update: never drop a tip time the previous in-memory game already had. */
export function copyForwardStartTime(
  previous: Pick<Game, 'startTime'> | null | undefined,
  next: Game
): Game {
  if (next.startTime?.trim()) return next;
  const prior = previous?.startTime?.trim();
  if (!prior) return next;
  return { ...next, startTime: prior };
}
