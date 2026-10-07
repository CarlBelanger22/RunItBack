/**
 * Tournament home-page league leaders: qualification floors.
 *
 * - Counting + % boards: played >= 50% of that club's games in the tournament
 * - Major awards (MVP / DPOY / Sixth Man / All-Teams): >= 60% (see major floor)
 * - FG%: >= 4 FGA per game played
 * - 3P%: >= 1.5 3PA per game played
 * - FT%: >= 2 FTA per game played
 *
 * Attempts (not makes) — better sample-size gate for short tournaments.
 */

/** Home leaders + non-major awards (scoring, shooting, etc.). */
export const TOURNAMENT_LEADER_MIN_TEAM_GAME_FRACTION = 0.5;
/** MVP, DPOY, Sixth Man, All-Teams. */
export const TOURNAMENT_MAJOR_AWARD_MIN_TEAM_GAME_FRACTION = 0.6;
export const TOURNAMENT_LEADER_MIN_FGA_PER_GAME = 4;
export const TOURNAMENT_LEADER_MIN_3PA_PER_GAME = 1.5;
export const TOURNAMENT_LEADER_MIN_FTA_PER_GAME = 2;

function meetsGamesFloor(
  gamesPlayed: number,
  teamGamesInTournament: number,
  fraction: number
): boolean {
  if (gamesPlayed <= 0 || teamGamesInTournament <= 0) return false;
  return gamesPlayed >= teamGamesInTournament * fraction;
}

/** Player must have appeared in at least 50% of their team's tournament games. */
export function meetsTournamentLeaderGamesFloor(
  gamesPlayed: number,
  teamGamesInTournament: number
): boolean {
  return meetsGamesFloor(
    gamesPlayed,
    teamGamesInTournament,
    TOURNAMENT_LEADER_MIN_TEAM_GAME_FRACTION
  );
}

/** Stricter floor for MVP / DPOY / Sixth Man / All-Teams. */
export function meetsTournamentMajorAwardGamesFloor(
  gamesPlayed: number,
  teamGamesInTournament: number
): boolean {
  return meetsGamesFloor(
    gamesPlayed,
    teamGamesInTournament,
    TOURNAMENT_MAJOR_AWARD_MIN_TEAM_GAME_FRACTION
  );
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
  return (
    gamesPlayed > 0 &&
    threeAttempted >= gamesPlayed * TOURNAMENT_LEADER_MIN_3PA_PER_GAME
  );
}

export function meetsTournamentLeaderFtFloor(
  ftAttempted: number,
  gamesPlayed: number
): boolean {
  return gamesPlayed > 0 && ftAttempted >= gamesPlayed * TOURNAMENT_LEADER_MIN_FTA_PER_GAME;
}
