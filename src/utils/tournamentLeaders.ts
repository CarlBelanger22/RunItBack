/**
 * Tournament home-page league leaders: qualification floors.
 *
 * - Counting + % boards: played >= 50% of that club's games in the tournament
 * - FG%: >= 2 FGA per game played
 * - 3P%: >= 1 3PA per game played
 * - FT%: >= 1.5 FTA per game played
 */

export const TOURNAMENT_LEADER_MIN_TEAM_GAME_FRACTION = 0.5;
export const TOURNAMENT_LEADER_MIN_FGA_PER_GAME = 2;
export const TOURNAMENT_LEADER_MIN_3PA_PER_GAME = 1;
export const TOURNAMENT_LEADER_MIN_FTA_PER_GAME = 1.5;

/** Player must have appeared in at least half of their team's tournament games. */
export function meetsTournamentLeaderGamesFloor(
  gamesPlayed: number,
  teamGamesInTournament: number
): boolean {
  if (gamesPlayed <= 0 || teamGamesInTournament <= 0) return false;
  return gamesPlayed >= teamGamesInTournament * TOURNAMENT_LEADER_MIN_TEAM_GAME_FRACTION;
}

export function meetsTournamentLeaderFgFloor(
  fgAttempted: number,
  gamesPlayed: number
): boolean {
  return gamesPlayed > 0 && fgAttempted >= gamesPlayed * TOURNAMENT_LEADER_MIN_FGA_PER_GAME;
}

export function meetsTournamentLeaderThreeFloor(
  threeAttempted: number,
  gamesPlayed: number
): boolean {
  return gamesPlayed > 0 && threeAttempted >= gamesPlayed * TOURNAMENT_LEADER_MIN_3PA_PER_GAME;
}

export function meetsTournamentLeaderFtFloor(
  ftAttempted: number,
  gamesPlayed: number
): boolean {
  return gamesPlayed > 0 && ftAttempted >= gamesPlayed * TOURNAMENT_LEADER_MIN_FTA_PER_GAME;
}
