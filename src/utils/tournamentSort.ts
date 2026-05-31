import type { Tournament } from '../App';

function getCreatedAtMs(item: { id: string; createdAt?: string }): number {
  if (item.createdAt) {
    const parsed = Date.parse(item.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const match = item.id.match(/-(\d{10,})$/);
  if (match) return Number(match[1]);
  return 0;
}

/** Sort key from tournament season (month + year), newest first. */
export function getTournamentDateMs(tournament: Pick<Tournament, 'month' | 'year'>): number {
  const parsed = Date.parse(`${tournament.month} 1, ${tournament.year}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Latest tournament season first; ties broken by createdAt then name. */
export function sortTournamentsByDateDesc(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort((a, b) => {
    const dateDiff = getTournamentDateMs(b) - getTournamentDateMs(a);
    if (dateDiff !== 0) return dateDiff;

    const createdDiff = getCreatedAtMs(b) - getCreatedAtMs(a);
    if (createdDiff !== 0) return createdDiff;

    return a.name.localeCompare(b.name);
  });
}
