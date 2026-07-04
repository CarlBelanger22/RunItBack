import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Game, GameEvent, Player } from '../App';
import { GameLogic } from '../utils/GameLogic';
import { clickToCourtPointM, type CourtPointM } from '../lib/fibaCourtGeometry';
import { resolveHorizontalShotZone } from '../lib/horizontalCourtClick';
import {
  clockForPeriod,
  resolveGameClockSettings,
} from '../utils/gameClock';
import {
  buildFoulEvent,
  buildFreeThrowEvent,
  buildHeldBallJumpBallEvent,
  buildOpeningJumpBallEvent,
  buildPeriodEndEvent,
  buildPeriodStartEvent,
  buildReboundEvent,
  buildShotEvent,
  buildSubstitutionEvent,
  buildTurnoverEvent,
} from './liveEntryActions';
import {
  initialLiveEntryContext,
  liveEntryReducer,
  type LiveEntryState,
  type PendingShot,
  defenseTeamIdFor,
} from './liveEntryStateMachine';
import { derivePossessionSnapshot } from './possessionEngine';
import { gameNeedsOpeningJumpBall, hasOpeningTipBeenRecorded, opponentTeamId } from './possessionArrow';
import type { FoulCommitParams } from './foulFlow';
import {
  deriveReboundTeamsForMissedShot,
  resolveReboundTeams,
  teamIdForPlayer,
} from './reboundTeams';
import {
  applySubstitutionCheckpoint,
  flushStintToClock,
  replayMinutesOntoGame,
  startPeriodLineups,
  type MinutesTrackingState,
} from './minutesEngine';
import { isValidSubstitutionClock } from '../utils/gameClock';

function resolveOnCourt(game: Game, side: 'home' | 'away'): string[] {
  const starters = side === 'home' ? game.homeStarters : game.awayStarters;
  if (starters.length >= 5) return starters.slice(0, 5);
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  return team.players.slice(0, 5).map((p) => p.id);
}

export function useLiveGameSession(
  game: Game,
  onGameUpdate: (game: Game) => void
) {
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [onCourtHome, setOnCourtHome] = useState<string[]>(() =>
    resolveOnCourt(game, 'home')
  );
  const [onCourtAway, setOnCourtAway] = useState<string[]>(() =>
    resolveOnCourt(game, 'away')
  );

  const [minutesState, setMinutesState] = useState<MinutesTrackingState>(() =>
    replayMinutesOntoGame(game).state
  );

  const syncMinutesFromGame = useCallback((g: Game) => {
    const replayed = replayMinutesOntoGame(g);
    setMinutesState(replayed.state);
    setOnCourtHome(replayed.state.onCourtHome);
    setOnCourtAway(replayed.state.onCourtAway);
    return replayed;
  }, []);

  const [entryState, dispatch] = useReducer(liveEntryReducer, {
    phase: { kind: 'idle' as const },
    ctx: initialLiveEntryContext(
      game.homeTeamId,
      resolveOnCourt(game, 'home'),
      resolveOnCourt(game, 'away')
    ),
  } as LiveEntryState);

  const entryStateRef = useRef(entryState);
  entryStateRef.current = entryState;

  useEffect(() => {
    const replayed = replayMinutesOntoGame(game);
    setCurrentGame(replayed.game);
    setMinutesState(replayed.state);
    setOnCourtHome(replayed.state.onCourtHome);
    setOnCourtAway(replayed.state.onCourtAway);
  }, [game.id, game.events.length]);

  const openingTipRecorded = hasOpeningTipBeenRecorded(game.events ?? []);

  useEffect(() => {
    if (!openingTipRecorded) {
      dispatch({ type: 'START_OPENING_JUMPBALL' });
    }
  }, [game.id, openingTipRecorded]);

  useEffect(() => {
    if (
      openingTipRecorded &&
      entryState.phase.kind === 'jumpball' &&
      entryState.phase.step === 'opening'
    ) {
      dispatch({ type: 'RESET' });
    }
  }, [openingTipRecorded, entryState.phase]);

  const offenseTeamId = entryState.ctx.offenseTeamId;
  const defenseTeamId = defenseTeamIdFor(
    currentGame.homeTeamId,
    currentGame.awayTeamId,
    offenseTeamId
  );

  const syncGame = useCallback(
    (updated: Game, options?: { skipPossessionSync?: boolean }) => {
      const replayed = replayMinutesOntoGame(updated);
      setCurrentGame(replayed.game);
      setMinutesState(replayed.state);
      setOnCourtHome(replayed.state.onCourtHome);
      setOnCourtAway(replayed.state.onCourtAway);
      onGameUpdate(replayed.game);
      if (
        options?.skipPossessionSync ||
        entryStateRef.current.phase.kind === 'free_throw'
      ) {
        return;
      }
      const snap = derivePossessionSnapshot(replayed.game, replayed.game.events);
      dispatch({ type: 'SET_OFFENSE', teamId: snap.offenseTeamId });
    },
    [onGameUpdate]
  );

  const handleCourtClick = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      const point = clickToCourtPointM(clientX, clientY, rect);
      const zone = resolveHorizontalShotZone(point);
      dispatch({ type: 'COURT_CLICK', point, zone });
    },
    []
  );

  const handleCourtPoint = useCallback((point: CourtPointM) => {
    const zone = resolveHorizontalShotZone(point);
    dispatch({ type: 'COURT_CLICK', point, zone });
  }, []);

  const replayEvents = useCallback(
    (events: GameEvent[]) => {
      const base = GameLogic.replayFromEvents(currentGame, events);
      const replayed = replayMinutesOntoGame(base);
      syncGame(replayed.game);
      syncMinutesFromGame(replayed.game);
      dispatch({ type: 'RESET' });
    },
    [currentGame, syncGame, syncMinutesFromGame]
  );

  const handleShotOutcome = useCallback(
    (outcome: 'make' | 'miss' | 'block', point?: { xM: number; yM: number }) => {
      dispatch({ type: 'SHOT_OUTCOME', outcome });
      if (point) {
        dispatch({
          type: 'ADD_MARKER',
          marker: { point, color: outcome === 'make' ? 'green' : 'red' },
        });
      }
    },
    []
  );

  const commitShot = useCallback(
    (pending: PendingShot, and1 = false) => {
      const built = buildShotEvent(currentGame, offenseTeamId, pending);
      if (!built) return;

      if (pending.point) {
        dispatch({
          type: 'ADD_MARKER',
          marker: {
            point: pending.point,
            color: pending.outcome === 'make' ? 'green' : 'red',
          },
        });
      }

      let g: Game = {
        ...currentGame,
        shots: [...currentGame.shots, built.shot],
      };
      g = GameLogic.recordEvent(g, built.event);
      const { shootingTeamId, defendingTeamId } = deriveReboundTeamsForMissedShot(
        currentGame,
        pending,
        built.event.teamId
      );
      syncGame(g);

      if (and1 && pending.shooterId) {
        dispatch({ type: 'START_FOUL' });
        return;
      }

      if (pending.outcome === 'miss' || pending.outcome === 'block') {
        dispatch({
          type: 'START_REBOUND',
          shootingTeamId,
          defendingTeamId,
        });
      } else {
        dispatch({ type: 'RESET' });
      }
    },
    [currentGame, offenseTeamId, syncGame]
  );

  const commitRebound = useCallback(
    (reboundType: string, playerId?: string) => {
      const teams = resolveReboundTeams(
        currentGame,
        entryState.ctx.reboundShootingTeamId,
        entryState.ctx.reboundDefendingTeamId
      );
      let teamId = teams?.shootingTeamId;
      if (reboundType === 'defensive' || reboundType === 'team_defensive') {
        teamId = teams?.defendingTeamId;
      }
      if (!teamId) return;

      const event = buildReboundEvent(currentGame, teamId, playerId, reboundType);
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    },
    [
      currentGame,
      entryState.ctx.reboundDefendingTeamId,
      entryState.ctx.reboundShootingTeamId,
      syncGame,
    ]
  );

  const commitTurnover = useCallback(
    (
      playerId: string | undefined,
      isTeam: boolean,
      stolenBy?: string | null
    ) => {
      const event = buildTurnoverEvent(
        currentGame,
        offenseTeamId,
        playerId,
        isTeam,
        stolenBy
      );
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    },
    [currentGame, offenseTeamId, syncGame]
  );

  const commitOpeningTip = useCallback(
    (winnerTeamId: string) => {
      const loserTeamId =
        winnerTeamId === currentGame.homeTeamId
          ? currentGame.awayTeamId
          : currentGame.homeTeamId;
      const event = buildOpeningJumpBallEvent(currentGame, winnerTeamId, loserTeamId);
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    },
    [currentGame, syncGame]
  );

  const startJumpBall = useCallback(() => {
    const arrowTeamId = currentGame.possessionArrowTeamId;
    if (!arrowTeamId) return;

    if (arrowTeamId === offenseTeamId) {
      const event = buildHeldBallJumpBallEvent(currentGame, {
        losingTeamId: offenseTeamId,
        arrowBeforeTeamId: arrowTeamId,
        arrowAfterTeamId: opponentTeamId(currentGame, arrowTeamId),
        awardedTeamId: offenseTeamId,
        possessionChanged: false,
      });
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    } else {
      dispatch({ type: 'START_JUMPBALL' });
    }
  }, [currentGame, offenseTeamId, defenseTeamId, syncGame]);

  const commitJumpBallWithStats = useCallback(
    (turnoverPlayerId: string, stealPlayerId: string) => {
      const arrowTeamId = currentGame.possessionArrowTeamId;
      if (!arrowTeamId) return;

      const event = buildHeldBallJumpBallEvent(currentGame, {
        losingTeamId: offenseTeamId,
        arrowBeforeTeamId: arrowTeamId,
        arrowAfterTeamId: opponentTeamId(currentGame, arrowTeamId),
        awardedTeamId: arrowTeamId,
        possessionChanged: true,
        turnoverPlayerId,
        stealPlayerId,
      });
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    },
    [currentGame, offenseTeamId, defenseTeamId, syncGame]
  );

  const commitFoul = useCallback(
    (params: FoulCommitParams) => {
      const offendedTeamId = params.offendedTeamId ?? offenseTeamId;
      const event = buildFoulEvent(currentGame, {
        foulingTeamId: params.foulingTeamId,
        committerId: params.committerId,
        recipientId: params.recipientId,
        foulCategory: params.foulCategory,
        isTeamFoul: params.foulEntity === 'team',
        isCoachFoul: params.isCoachFoul,
        retainPossession: params.retainPossession ?? false,
        offendedTeamId,
        doublePartnerPlayerId: params.doublePartnerPlayerId,
        doublePartnerTeamId: params.doublePartnerTeamId,
      });
      const g = GameLogic.recordEvent(currentGame, event);
      syncGame(g);

      if (params.ftCount > 0 && params.ftShooterId) {
        const shooterTeam =
          teamIdForPlayer(currentGame, params.ftShooterId) ??
          (currentGame.homeTeam.players.some((p) => p.id === params.ftShooterId)
            ? currentGame.homeTeamId
            : currentGame.awayTeamId);
        const retainPossession = params.retainPossession ?? false;
        const possessionTeamAfterFt =
          params.possessionTeamAfterFt ??
          (retainPossession
            ? offendedTeamId
            : opponentTeamId(currentGame, shooterTeam));

        dispatch({
          type: 'START_FT',
          playerId: params.ftShooterId,
          ftTotal: params.ftCount,
          retainPossession,
          offendedTeamId,
          possessionTeamAfterFt,
        });
      } else {
        dispatch({ type: 'RESET' });
      }
    },
    [currentGame, offenseTeamId, syncGame]
  );

  const commitFreeThrow = useCallback(
    (made: boolean) => {
      const phase = entryStateRef.current.phase;
      if (phase.kind !== 'free_throw') return;

      const {
        playerId,
        ftTotal,
        ftIndex,
        retainPossession,
        offendedTeamId,
        possessionTeamAfterFt,
      } = phase;
      const shooterTeam =
        teamIdForPlayer(currentGame, playerId) ??
        (currentGame.homeTeam.players.some((p) => p.id === playerId)
          ? currentGame.homeTeamId
          : currentGame.awayTeamId);
      const defendingTeamId = opponentTeamId(currentGame, shooterTeam);

      const event = buildFreeThrowEvent(
        currentGame,
        shooterTeam,
        playerId,
        made,
        ftIndex,
        ftTotal,
        { retainPossession, offendedTeamId, possessionTeamAfterFt }
      );
      let g = GameLogic.recordEvent(currentGame, event);
      syncGame(g, { skipPossessionSync: true });

      if (ftIndex < ftTotal) {
        dispatch({ type: 'ADVANCE_FT' });
        return;
      }

      if (made) {
        dispatch({
          type: 'SET_OFFENSE',
          teamId: possessionTeamAfterFt,
        });
        dispatch({ type: 'RESET' });
        return;
      }

      if (retainPossession) {
        const reb = buildReboundEvent(
          g,
          possessionTeamAfterFt,
          undefined,
          'team_offensive'
        );
        g = GameLogic.recordEvent(g, reb);
        syncGame(g);
        dispatch({ type: 'SET_OFFENSE', teamId: possessionTeamAfterFt });
        dispatch({ type: 'RESET' });
        return;
      }

      dispatch({
        type: 'START_REBOUND',
        shootingTeamId: shooterTeam,
        defendingTeamId,
      });
    },
    [currentGame, syncGame, dispatch]
  );

  const commitSubstitution = useCallback(
    (teamId: string, outIds: string[], inIds: string[], clockTime: string) => {
      const checkpointFrom = minutesState.checkpointClock;
      if (!isValidSubstitutionClock(checkpointFrom, clockTime)) {
        return { ok: false as const, error: `Time must be at or before ${checkpointFrom}` };
      }

      const scores = {
        home: currentGame.teamStats.home.total_points,
        away: currentGame.teamStats.away.total_points,
      };

      const checkpoint = applySubstitutionCheckpoint(
        currentGame,
        minutesState,
        {
          teamId,
          outIds,
          inIds,
          clockTime,
          onCourtHome: minutesState.onCourtHome,
          onCourtAway: minutesState.onCourtAway,
        },
        scores
      );

      const event = buildSubstitutionEvent(
        checkpoint.game,
        teamId,
        outIds,
        inIds,
        clockTime,
        checkpointFrom
      );
      const g = GameLogic.recordEvent(checkpoint.game, event);
      syncGame(g);
      setMinutesState(checkpoint.state);
      setOnCourtHome(checkpoint.state.onCourtHome);
      setOnCourtAway(checkpoint.state.onCourtAway);
      dispatch({ type: 'RESET' });
      return { ok: true as const };
    },
    [currentGame, minutesState, syncGame]
  );

  const commitPeriodEnd = useCallback((): Game => {
    const scores = {
      home: currentGame.teamStats.home.total_points,
      away: currentGame.teamStats.away.total_points,
    };
    const flushed = flushStintToClock(currentGame, minutesState, '0:00', scores);
    const event = buildPeriodEndEvent(flushed.game, currentGame.currentPeriod);
    const g = GameLogic.recordEvent(flushed.game, event);
    const updated = { ...g, currentGameTime: '0:00' };
    syncGame(updated);
    setMinutesState(flushed.state);
    return updated;
  }, [currentGame, minutesState, syncGame]);

  const commitPeriodStart = useCallback(
    (homeLineup: string[], awayLineup: string[]) => {
      const nextPeriod = currentGame.currentPeriod + 1;
      const clock = clockForPeriod(nextPeriod, resolveGameClockSettings(currentGame));
      const started = startPeriodLineups(currentGame, nextPeriod, homeLineup, awayLineup);
      const possessionTeamId = currentGame.possessionArrowTeamId;
      const periodStartOptions =
        possessionTeamId != null
          ? {
              possessionTeamId,
              arrowAfterTeamId: opponentTeamId(currentGame, possessionTeamId),
            }
          : undefined;
      const event = buildPeriodStartEvent(
        started.game,
        nextPeriod,
        homeLineup,
        awayLineup,
        clock,
        periodStartOptions
      );
      const g = GameLogic.recordEvent(started.game, event);
      syncGame(g);
      setMinutesState(started.state);
      setOnCourtHome(homeLineup);
      setOnCourtAway(awayLineup);
      dispatch({ type: 'RESET' });
    },
    [currentGame, syncGame]
  );

  const undo = useCallback(() => {
    const updated = GameLogic.undoLastEvent(currentGame);
    const replayed = replayMinutesOntoGame(updated);
    syncGame(replayed.game);
    setMinutesState(replayed.state);
    setOnCourtHome(replayed.state.onCourtHome);
    setOnCourtAway(replayed.state.onCourtAway);
    dispatch({ type: 'RESET' });
    if (gameNeedsOpeningJumpBall(updated)) {
      dispatch({ type: 'START_OPENING_JUMPBALL' });
    }
  }, [currentGame, syncGame]);

  const endPeriod = useCallback(() => {
    commitPeriodEnd();
  }, [commitPeriodEnd]);

  const getTeamPlayers = useCallback(
    (teamId: string): Player[] =>
      teamId === currentGame.homeTeamId
        ? currentGame.homeTeam.players
        : currentGame.awayTeam.players,
    [currentGame]
  );

  const getOnCourtIds = useCallback(
    (teamId: string): string[] =>
      teamId === currentGame.homeTeamId ? onCourtHome : onCourtAway,
    [currentGame.homeTeamId, onCourtAway, onCourtHome]
  );

  const toggleClock = useCallback(() => {
    dispatch({ type: 'TOGGLE_CLOCK' });
  }, []);

  return {
    currentGame,
    entryState,
    dispatch,
    handleCourtClick,
    handleCourtPoint,
    handleShotOutcome,
    commitShot,
    commitRebound,
    commitTurnover,
    commitOpeningTip,
    startJumpBall,
    commitJumpBallWithStats,
    commitFoul,
    commitFreeThrow,
    commitSubstitution,
    commitPeriodEnd,
    commitPeriodStart,
    undo,
    replayEvents,
    endPeriod,
    toggleClock,
    getTeamPlayers,
    getOnCourtIds,
    offenseTeamId,
    defenseTeamId,
    possessionArrowTeamId: currentGame.possessionArrowTeamId ?? null,
    onCourtHome,
    onCourtAway,
  };
}
