import type { Game } from '../App';

export function getPlayerLastGameMs(
  playerId: string,
  games: Game[] | undefined,
  match: (game: Game) => boolean
): number {
  let max = 0;
  for (const game of games ?? []) {
    if (!game.isCompleted) continue;
    if (!match(game)) continue;
    if (!(game.gameStats ?? []).some((stat) => stat.playerId === playerId)) continue;
    const ms = Date.parse(game.date);
    if (!Number.isNaN(ms) && ms > max) max = ms;
  }
  return max;
}

export function getIdCreatedAtMs(item: { id: string; createdAt?: string }): number {
  if (item.createdAt) {
    const parsed = Date.parse(item.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const match = item.id.match(/-(\d{10,})$/);
  return match ? Number(match[1]) : 0;
}
