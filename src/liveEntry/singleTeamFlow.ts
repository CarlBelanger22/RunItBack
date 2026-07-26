import type { Game } from '../App';

/** Single-team live entry: home roster only; away is Opp unit. */
export function isSingleTeamLive(game: Game): boolean {
  return game.trackBothTeams === false;
}

export function isOppUnitOffense(game: Game, offenseTeamId: string): boolean {
  return isSingleTeamLive(game) && offenseTeamId === game.awayTeamId;
}

export function isHomeOffense(game: Game, offenseTeamId: string): boolean {
  return offenseTeamId === game.homeTeamId;
}
