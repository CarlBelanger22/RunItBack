/**
 * Tournament home-page league leaders: qualification floors.
 *
 * - Counting + % boards: >= 2 GP and >= 50% of that club's tournament games
 * - Major awards (MVP / DPOY / Sixth Man / All-Teams): >= 2 GP and >= 60%
 * - FG%: >= 4 FGA per game played
 * - 3P%: >= 1.5 3PA per game played
 * - FT%: >= 2 FTA per game played
 *
 * Absolute min GP blocks 1-game rate spikes (e.g. withdrawn clubs with GP=1).
 * Attempts (not makes) — better sample-size gate for short tournaments.
 */

/** Absolute floor so one-game averages cannot lead boards. */
export const TOURNAMENT_LEADER_MIN_GAMES = 2;
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
  if (gamesPlayed < TOURNAMENT_LEADER_MIN_GAMES || teamGamesInTournament <= 0) {
    return false;
  }
  return gamesPlayed >= teamGamesInTournament * fraction;
}

/** >= 2 GP and at least 50% of the club's tournament games. */
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

/** >= 2 GP and at least 60% of the club's tournament games (majors). */
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
