import type { Game, GameEvent } from '../App';

export interface EventEditGuardResult {
  ok: boolean;
  reason?: string;
}

/** Away-team events in single-team mode are Opp unit rows — not editable (LE-91). */
export function isSingleTeamOppUnitEvent(game: Game, event: GameEvent): boolean {
  if (game.trackBothTeams !== false) return false;
  return event.teamId === game.awayTeamId;
}

export function canOpenLiveEventEdit(
  game: Game,
  event: GameEvent
): EventEditGuardResult {
  if (isSingleTeamOppUnitEvent(game, event)) {
    return {
      ok: false,
      reason:
        'Opponent unit events are read-only in single-team mode. Undo if you need to correct them.',
    };
  }
  return { ok: true };
}

/**
 * Blocks edits that would break a linked live-entry sequence (v1).
 * And-1: made shot immediately followed by a foul drawn by that shooter.
 */
export function canEditShotFields(
  original: GameEvent,
  updated: GameEvent,
  events: GameEvent[]
): EventEditGuardResult {
  if (original.type !== 'shot_attempt' || updated.type !== 'shot_attempt') {
    return { ok: true };
  }

  const idx = events.findIndex((e) => e.id === original.id);
  if (idx < 0) return { ok: true };

  const next = events[idx + 1];
  const isAnd1Link =
    !!original.details.made &&
    next?.type === 'foul' &&
    next.details?.drawnBy === original.playerId;

  if (!isAnd1Link) return { ok: true };

  const shooterChanged = updated.playerId !== original.playerId;
  const madeFlippedOff = !!original.details.made && !updated.details.made;

  if (shooterChanged || madeFlippedOff) {
    return {
      ok: false,
      reason:
        'This made shot is linked to an and-1 foul. Undo the foul/free throws first, or edit those events separately — you cannot change the shooter or flip this shot to a miss here.',
    };
  }

  return { ok: true };
}

/** Strip cached possession context so replay re-derives POT / 2nd-chance points. */
export function stripPossessionContext(events: GameEvent[]): GameEvent[] {
  return events.map((e) => {
    if (!e.details || e.details.possessionContext == null) return e;
    const { possessionContext: _removed, ...rest } = e.details;
    return { ...e, details: { ...rest } };
  });
}
