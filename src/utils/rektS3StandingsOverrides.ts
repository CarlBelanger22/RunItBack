/**
 * One-off REKT League Season 3 standings presentation:
 * SGKR withdrew mid-season and was replaced by MGM — keep their 1–0
 * record, pin them to the bottom, and show a footnote.
 */

export const REKT_S3_TOURNAMENT_ID = 'tournament-rekt-s3-2026';
export const REKT_S3_DEMOTED_TEAM_ID = 'team-rekt-s1-sgkr';

export const REKT_S3_STANDINGS_FOOTNOTE =
  'SGKR withdrew from the season and were replaced by MGM.';

export function isRektS3StandingsOverride(
  tournamentId: string | undefined | null
): boolean {
  return tournamentId === REKT_S3_TOURNAMENT_ID;
}

export function isRektS3DemotedTeam(
  tournamentId: string | undefined | null,
  teamId: string | undefined | null
): boolean {
  return (
    isRektS3StandingsOverride(tournamentId) &&
    teamId === REKT_S3_DEMOTED_TEAM_ID
  );
}

export function rektS3StandingsFootnote(
  tournamentId: string | undefined | null
): string | null {
  return isRektS3StandingsOverride(tournamentId)
    ? REKT_S3_STANDINGS_FOOTNOTE
    : null;
}

/** Stable: move demoted team(s) to the end; leave others' relative order. */
export function applyRektS3StandingsOrder<T extends { team: { id: string } }>(
  tournamentId: string | undefined | null,
  rows: T[]
): T[] {
  if (!isRektS3StandingsOverride(tournamentId)) return rows;
  const kept: T[] = [];
  const demoted: T[] = [];
  for (const row of rows) {
    if (row.team.id === REKT_S3_DEMOTED_TEAM_ID) demoted.push(row);
    else kept.push(row);
  }
  if (demoted.length === 0) return rows;
  return [...kept, ...demoted];
}
