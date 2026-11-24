import type { PlayerSeasonRow } from './playerSeasonStats';

/** Primary positions available on Tournament Player Stats filters. */
export const PLAYER_STATS_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export type PlayerStatsPosition = (typeof PLAYER_STATS_POSITIONS)[number];

export type PlayerSeasonRowFilters = {
  /** Empty / null = all teams. Otherwise row.team.id must be in the set. */
  teamIds?: ReadonlySet<string> | null;
  /** Empty / null = all positions. Primary position only (normalized). */
  positions?: ReadonlySet<string> | null;
};

/** Normalize profile/TR position for filter matching (trim + upper). */
export function normalizePlayerStatsPosition(
  position: string | null | undefined
): string {
  return String(position ?? '').trim().toUpperCase();
}

/**
 * Filter tournament player-season rows by team and/or primary position.
 * Both constraints AND when set. Empty selection = no constraint.
 */
export function filterPlayerSeasonRows<T extends PlayerSeasonRow>(
  rows: T[],
  filters: PlayerSeasonRowFilters = {}
): T[] {
  const teamIds = filters.teamIds;
  const positions = filters.positions;
  const filterTeams = Boolean(teamIds && teamIds.size > 0);
  const filterPositions = Boolean(positions && positions.size > 0);
  if (!filterTeams && !filterPositions) return rows;

  return rows.filter((row) => {
    if (filterTeams && !teamIds!.has(row.team.id)) return false;
    if (filterPositions) {
      const pos = normalizePlayerStatsPosition(row.player.position);
      if (!positions!.has(pos)) return false;
    }
    return true;
  });
}

export function toggleIdInSet(
  current: ReadonlySet<string>,
  id: string,
  checked: boolean
): Set<string> {
  const next = new Set(current);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}
