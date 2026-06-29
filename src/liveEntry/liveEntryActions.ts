import type { Game, GameEvent, Shot } from '../App';
import type { PendingShot } from './liveEntryStateMachine';
import { courtPointMToPercent } from '../lib/fibaCourtGeometry';

export function buildShotEvent(
  game: Game,
  offenseTeamId: string,
  pending: PendingShot
): { event: GameEvent; shot: Shot } | null {
  if (!pending.shooterId) return null;

  const made = pending.outcome === 'make';
  const pct = courtPointMToPercent(pending.point);
  const ts = Date.now();

  const shot: Shot = {
    id: `shot-${ts}`,
    playerId: pending.shooterId,
    x: pct.x,
    y: pct.y,
    made,
    isThree: pending.isThree,
    timestamp: ts,
    assistedBy: pending.assistId ?? undefined,
    blockedBy: pending.blockerId,
    isTransition: pending.isTransition,
    inPaint: pending.isPaint,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
  };

  const event: GameEvent = {
    id: `event-${ts}`,
    type: 'shot_attempt',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: offenseTeamId,
    playerId: pending.shooterId,
    details: {
      made,
      isThree: pending.isThree,
      inPaint: pending.isPaint,
      assistedBy: pending.assistId,
      blockedBy: pending.blockerId,
      isTransition: pending.isTransition,
      x: pct.x,
      y: pct.y,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };

  return { event, shot };
}

export function buildReboundEvent(
  game: Game,
  teamId: string,
  playerId: string | undefined,
  reboundType: string
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'rebound',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId,
    playerId,
    details: { reboundType },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildTurnoverEvent(
  game: Game,
  offenseTeamId: string,
  playerId: string | undefined,
  isTeam: boolean,
  stolenBy?: string | null
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'turnover',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: offenseTeamId,
    playerId: isTeam ? undefined : playerId,
    details: {
      isTeamTurnover: isTeam,
      stolenBy: stolenBy ?? null,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildFoulEvent(
  game: Game,
  defenseTeamId: string,
  committerId: string,
  recipientId: string | undefined,
  foulCategory: string
): GameEvent {
  const ts = Date.now();
  const foulType =
    foulCategory === 'technical'
      ? 'technical'
      : foulCategory === 'unsportsmanlike'
        ? 'unsportsmanlike'
        : 'normal';

  return {
    id: `event-${ts}`,
    type: 'foul',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: defenseTeamId,
    playerId: committerId,
    details: {
      foulType,
      foulCategory,
      drawnBy: recipientId,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildFreeThrowEvent(
  game: Game,
  teamId: string,
  playerId: string,
  made: boolean,
  ftIndex: number,
  ftTotal: number
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'free_throw',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId,
    playerId,
    details: {
      made,
      ftIndex,
      ftTotal,
      isFinal: ftIndex === ftTotal,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildSubstitutionEvent(
  game: Game,
  teamId: string,
  outIds: string[],
  inIds: string[]
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'substitution',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId,
    details: { playersOut: outIds, playersIn: inIds },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}
