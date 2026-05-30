export type OrderedBoxScoreSection = 'starters' | 'bench' | 'divider';

export interface OrderedBoxScoreRow<T> {
  kind: OrderedBoxScoreSection;
  player?: T;
}

export function orderBoxScorePlayers<T extends { playerId: string; minutes_played: number }>(
  players: T[],
  starterIds: string[]
): OrderedBoxScoreRow<T>[] {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const used = new Set<string>();
  const result: OrderedBoxScoreRow<T>[] = [];

  for (const id of starterIds) {
    const player = byId.get(id);
    if (!player) continue;
    used.add(id);
    result.push({ kind: 'starters', player });
  }

  const bench = players
    .filter((p) => !used.has(p.playerId))
    .sort((a, b) => b.minutes_played - a.minutes_played);

  if (result.length > 0 && bench.length > 0) {
    result.push({ kind: 'divider' });
  }

  for (const player of bench) {
    result.push({ kind: 'bench', player });
  }

  return result;
}
