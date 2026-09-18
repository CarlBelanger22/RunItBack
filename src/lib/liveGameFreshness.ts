import type { Game } from '../App';
import { mergeGamesPreferCompleted } from './completedGamePersist';

/** Measurable progress for an in-progress game (events weigh heaviest). */
export function incompleteGameProgressScore(game: Game): number {
  const events = game.events?.length ?? 0;
  const shots = game.shots?.length ?? 0;
  const points = (game.gameStats ?? []).reduce((n, s) => n + (s.points || 0), 0);
  const fga = (game.gameStats ?? []).reduce(
    (n, s) => n + (s.fg_attempted || 0),
    0
  );
  return events * 1_000_000 + shots * 1_000 + points * 10 + fga;
}

/**
 * Between two copies of the same game id:
 * - completed always beats incomplete
 * - two incomplete → strictly higher progress wins
 * - tie → keep `fallback` (typically cloud / already-applied)
 */
export function preferFresherIncompleteGame(
  candidate: Game,
  fallback: Game
): Game {
  if (candidate.id !== fallback.id) {
    throw new Error(
      `preferFresherIncompleteGame id mismatch ${candidate.id} vs ${fallback.id}`
    );
  }
  const candidateDone = Boolean(candidate.isCompleted);
  const fallbackDone = Boolean(fallback.isCompleted);
  if (candidateDone && !fallbackDone) return candidate;
  if (!candidateDone && fallbackDone) return fallback;
  if (candidateDone && fallbackDone) return fallback;

  const candidateScore = incompleteGameProgressScore(candidate);
  const fallbackScore = incompleteGameProgressScore(fallback);
  return candidateScore > fallbackScore ? candidate : fallback;
}

/**
 * Start from cloud games; replace incomplete rows with a strictly fresher
 * local incomplete copy of the same id.
 * - Local completed beats cloud still-active (End Game before sync).
 * - When **both** are completed, keep **cloud** (server remaps / truth).
 * - Local-only rows: keep only in-progress live games (durability). Do **not**
 *   keep completed/inactive local-only games — that resurrects cloud deletes
 *   from a stale snapshot on refresh.
 * - `omitLocalOnlyIds`: intentionally deleted ids (skip even if still live in memory).
 */
export function mergeCloudGamesWithFresherLocal(
  cloudGames: Game[],
  localGames: Game[],
  options?: { omitLocalOnlyIds?: ReadonlySet<string> }
): Game[] {
  const localById = new Map(localGames.map((g) => [g.id, g]));
  const merged: Game[] = [];
  const seen = new Set<string>();
  const omit = options?.omitLocalOnlyIds;

  for (const cloud of cloudGames) {
    seen.add(cloud.id);
    const local = localById.get(cloud.id);
    if (!local) {
      merged.push(cloud);
      continue;
    }
    if (cloud.isCompleted && local.isCompleted) {
      merged.push(cloud);
      continue;
    }
    if (cloud.isCompleted || local.isCompleted) {
      merged.push(mergeGamesPreferCompleted([cloud], [local])[0]!);
      continue;
    }
    merged.push(preferFresherIncompleteGame(local, cloud));
  }

  for (const local of localGames) {
    if (seen.has(local.id)) continue;
    if (omit?.has(local.id)) continue;
    if (local.isActive && !local.isCompleted) {
      merged.push(local);
    }
  }

  return merged;
}
