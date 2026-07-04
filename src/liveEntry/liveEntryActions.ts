import type { Game, GameEvent, Shot } from '../App';
import type { PendingShot } from './liveEntryStateMachine';
import { courtPointMToPercent } from '../lib/fibaCourtGeometry';
import { teamIdForPlayer } from './reboundTeams';

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

  const shootingTeamId = teamIdForPlayer(game, pending.shooterId) ?? offenseTeamId;

  const event: GameEvent = {
    id: `event-${ts}`,
    type: 'shot_attempt',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: shootingTeamId,
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

export function buildOpeningJumpBallEvent(
  game: Game,
  winnerTeamId: string,
  loserTeamId: string
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'jump_ball',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: winnerTeamId,
    details: {
      kind: 'opening',
      winnerTeamId,
      awardedTeamId: winnerTeamId,
      arrowBeforeTeamId: null,
      arrowAfterTeamId: loserTeamId,
      possessionChanged: true,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildHeldBallJumpBallEvent(
  game: Game,
  params: {
    losingTeamId: string;
    arrowBeforeTeamId: string;
    arrowAfterTeamId: string;
    awardedTeamId: string;
    possessionChanged: boolean;
    turnoverPlayerId?: string;
    stealPlayerId?: string;
  }
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'jump_ball',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: params.losingTeamId,
    playerId: params.turnoverPlayerId,
    details: {
      kind: 'held_ball',
      arrowBeforeTeamId: params.arrowBeforeTeamId,
      arrowAfterTeamId: params.arrowAfterTeamId,
      awardedTeamId: params.awardedTeamId,
      possessionChanged: params.possessionChanged,
      turnoverPlayerId: params.turnoverPlayerId ?? null,
      stealPlayerId: params.stealPlayerId ?? null,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildFoulEvent(
  game: Game,
  params: {
    foulingTeamId: string;
    committerId?: string;
    recipientId?: string;
    foulCategory: string;
    isTeamFoul?: boolean;
    isCoachFoul?: boolean;
    retainPossession?: boolean;
    offendedTeamId?: string;
    doublePartnerPlayerId?: string;
    doublePartnerTeamId?: string;
  }
): GameEvent {
  const ts = Date.now();
  const foulCategory = params.foulCategory;
  const foulType =
    foulCategory === 'technical'
      ? 'technical'
      : foulCategory === 'unsportsmanlike'
        ? 'unsportsmanlike'
        : foulCategory === 'double'
          ? 'double'
          : 'normal';

  const drawnBy =
    foulCategory === 'technical' || params.isTeamFoul ? undefined : params.recipientId;

  return {
    id: `event-${ts}`,
    type: 'foul',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: game.currentGameTime,
    teamId: params.foulingTeamId,
    playerId: params.committerId,
    details: {
      foulType,
      foulCategory,
      drawnBy,
      isTeamFoul: params.isTeamFoul ?? false,
      isCoachFoul: params.isCoachFoul ?? false,
      retainPossession: params.retainPossession ?? false,
      offendedTeamId: params.offendedTeamId,
      doublePartnerPlayerId: params.doublePartnerPlayerId,
      doublePartnerTeamId: params.doublePartnerTeamId,
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
  ftTotal: number,
  options?: { retainPossession?: boolean; offendedTeamId?: string; possessionTeamAfterFt?: string }
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
      retainPossession: options?.retainPossession ?? false,
      offendedTeamId: options?.offendedTeamId,
      possessionTeamAfterFt: options?.possessionTeamAfterFt,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildSubstitutionEvent(
  game: Game,
  teamId: string,
  outIds: string[],
  inIds: string[],
  clockTime: string,
  checkpointFrom: string
): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'substitution',
    timestamp: ts,
    period: game.currentPeriod,
    gameTime: clockTime,
    teamId,
    details: {
      playersOut: outIds,
      playersIn: inIds,
      clockTime,
      checkpointFrom,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildPeriodEndEvent(game: Game, period: number): GameEvent {
  const ts = Date.now();
  return {
    id: `event-${ts}`,
    type: 'period_end',
    timestamp: ts,
    period,
    gameTime: '0:00',
    teamId: game.homeTeamId,
    details: { period, clockTime: '0:00' },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}

export function buildPeriodStartEvent(
  game: Game,
  period: number,
  homeLineup: string[],
  awayLineup: string[],
  clockTime: string,
  options?: { possessionTeamId: string; arrowAfterTeamId: string }
): GameEvent {
  const ts = Date.now();
  const possessionTeamId = options?.possessionTeamId;
  return {
    id: `event-${ts}`,
    type: 'period_start',
    timestamp: ts,
    period,
    gameTime: clockTime,
    teamId: possessionTeamId ?? game.homeTeamId,
    details: {
      period,
      clockTime,
      homeLineup,
      awayLineup,
      possessionTeamId,
      arrowAfterTeamId: options?.arrowAfterTeamId,
    },
    homeScore: game.teamStats.home.total_points,
    awayScore: game.teamStats.away.total_points,
  };
}
