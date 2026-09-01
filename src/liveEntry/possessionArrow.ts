import type { Game, GameEvent } from '../App';

export function opponentTeamId(game: Game, teamId: string): string {
  return teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
}

/** Who gets the next jump ball — last arrowAfterTeamId from jump_ball or period_start. */
export function derivePossessionArrowTeamId(events: GameEvent[]): string | null {
  let arrow: string | null = null;
  for (const event of events) {
    if (event.type !== 'jump_ball' && event.type !== 'period_start') continue;
    const after = event.details.arrowAfterTeamId as string | undefined;
    if (after) arrow = after;
  }
  return arrow;
}

/**
 * Events-derived arrow wins; otherwise fall back to stored value on the game or meta.
 */
export function resolvePossessionArrowTeamId(
  game: Pick<Game, 'possessionArrowTeamId'>,
  events: GameEvent[] = [],
  storedArrow?: string | null
): string | undefined {
  const derived = derivePossessionArrowTeamId(events);
  if (derived) return derived;
  const stored = storedArrow ?? game.possessionArrowTeamId;
  return stored ?? undefined;
}

/** Set possessionArrowTeamId from events/meta without mutating stats or the event log. */
export function applyResolvedPossessionArrow(game: Game): Game {
  const resolved = resolvePossessionArrowTeamId(game, game.events ?? []);
  if (!resolved || resolved === game.possessionArrowTeamId) return game;
  return { ...game, possessionArrowTeamId: resolved };
}

/** Opening tip already recorded in the event log. */
export function hasOpeningTipBeenRecorded(events: GameEvent[]): boolean {
  return events.some(
    (e) => e.type === 'jump_ball' && (e.details.kind as string) === 'opening'
  );
}

export function gameNeedsOpeningJumpBall(game: Game): boolean {
  return !hasOpeningTipBeenRecorded(game.events ?? []);
}
