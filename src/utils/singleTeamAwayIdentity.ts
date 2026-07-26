import type { Team } from '../App';
import {
  isValidTeamAbbreviation,
  normalizeTeamAbbreviation,
} from './teamAbbreviation';

export type OppIdentityMode = 'none' | 'existing' | 'create_new';

/**
 * LE-91.7 Option A: keep Opp identity on the game snapshot, strip roster.
 * Live entry treats Away as a unit when trackBothTeams is false.
 */
export function toIdentityOnlyAwayTeam(team: Team): Team {
  const abbreviation =
    normalizeTeamAbbreviation(team.abbreviation) || team.abbreviation.trim();
  const next: Team = {
    id: team.id,
    name: team.name.trim(),
    abbreviation,
    players: [],
  };
  if (team.icon) next.icon = team.icon;
  if (team.description) next.description = team.description;
  if (team.currentTournamentId) next.currentTournamentId = team.currentTournamentId;
  if (team.createdAt) next.createdAt = team.createdAt;
  return next;
}

/** Ready to start a single-team game with this Opp identity. */
export function isOppIdentityReady(mode: OppIdentityMode, team: Team): boolean {
  if (mode === 'none') return false;
  if (!team.name.trim()) return false;
  if (mode === 'create_new') {
    return isValidTeamAbbreviation(team.abbreviation);
  }
  return Boolean(team.id) && team.id !== 'away';
}

/** Exclude Your/Home team from Opponent tournament dropdown (Q4: no same club). */
export function oppTournamentTeamsExcludingHome(
  tournamentTeams: Team[],
  homeMode: OppIdentityMode,
  homeTeamId: string | undefined
): Team[] {
  if (homeMode !== 'existing' || !homeTeamId || homeTeamId === 'home') {
    return tournamentTeams;
  }
  return tournamentTeams.filter((t) => t.id !== homeTeamId);
}
