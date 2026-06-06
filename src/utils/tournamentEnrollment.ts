/** Tournament team enrollment helpers (import + tests). */

export function buildTournamentTeamEnrollmentIds(
  teamIds: string[],
  homeTeamId: string | undefined,
  awayTeamId: string | undefined
): string[] {
  return [
    ...new Set(
      [...teamIds, homeTeamId, awayTeamId].filter((id): id is string => Boolean(id))
    ),
  ];
}

export function buildTournamentTeamRows(
  tournamentId: string,
  teamIds: string[],
  homeTeamId: string | undefined,
  awayTeamId: string | undefined
): Array<{ tournament_id: string; team_id: string }> {
  return buildTournamentTeamEnrollmentIds(teamIds, homeTeamId, awayTeamId).map(
    (team_id) => ({
      tournament_id: tournamentId,
      team_id,
    })
  );
}
