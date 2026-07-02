import type { Game, GameEvent } from '../App';

export function opponentTeamId(game: Game, teamId: string): string {
  return teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
}

/** Who gets the next jump ball — derived from jump_ball events. */
export function derivePossessionArrowTeamId(
  game: Game,
  events: GameEvent[]
): string | null {
  let arrow: string | null = null;
  for (const event of events) {
    if (event.type !== 'jump_ball') continue;
    const after = event.details.arrowAfterTeamId as string | undefined;
    if (after) arrow = after;
  }
  return arrow;
}

export function gameNeedsOpeningJumpBall(game: Game): boolean {
  return game.events.length === 0;
}
