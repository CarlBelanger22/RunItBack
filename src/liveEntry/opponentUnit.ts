/** Reserved Shot.playerId for team-only opponent FGA chart dots (no gameStats row). */
export const OPPONENT_UNIT_SHOT_PLAYER_ID = '__opponent_unit__';

export function isOpponentUnitShotPlayerId(playerId: string | undefined | null): boolean {
  return playerId === OPPONENT_UNIT_SHOT_PLAYER_ID;
}
