import type { Tournament } from '../App';

/** True when the tournament should be omitted from public browse lists. */
export function isTournamentHiddenFromList(
  tournament: Pick<Tournament, 'hiddenFromList'>
): boolean {
  return tournament.hiddenFromList === true;
}

/**
 * Browse list / Dashboard: non-admins never see hidden tournaments.
 * Admins see all (so they can unhide).
 */
export function filterTournamentsForBrowseList<T extends Pick<Tournament, 'hiddenFromList'>>(
  tournaments: readonly T[],
  options: { isAdmin: boolean }
): T[] {
  if (options.isAdmin) return [...tournaments];
  return tournaments.filter((t) => !isTournamentHiddenFromList(t));
}
