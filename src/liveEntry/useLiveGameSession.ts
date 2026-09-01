import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Game, GameEvent, Player, Team } from '../App';
import { normalizeGameTeamRosters } from '../utils/gameTeamRosters';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
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
import { gameNeedsOpeningJumpBall, hasOpeningTipBeenRecorded, opponentTeamId, applyResolvedPossessionArrow } from './possessionArrow';
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
import { stripPossessionContext } from './eventEditGuards';
import { isValidSubstitutionClock } from '../utils/gameClock';
import { isOppUnitOffense, isSingleTeamLive } from './singleTeamFlow';

function resolveOnCourt(game: Game, side: 'home' | 'away'): string[] {
  const starters = side === 'home' ? game.homeStarters : game.awayStarters;
  if (starters.length >= 5) return starters.slice(0, 5);
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  return team.players.slice(0, 5).map((p) => p.id);
}

export interface LiveGameRosterContext {
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
}

export function useLiveGameSession(
  game: Game,
  onGameUpdate: (game: Game) => void,
  rosterContext?: LiveGameRosterContext
) {
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const currentGameRef = useRef(game);
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
    const base =
      rosterContext != null
        ? normalizeGameTeamRosters(
            game,
            rosterContext.teams,
            rosterContext.tournamentRosters
          )
        : game;
    const replayed = replayMinutesOntoGame(base);
    const synced = GameLogic.syncTrackedTeamTotalsFromPlayers(replayed.game);
    const courtSidesFlipped =
      base.courtSidesFlipped ??
      (base.id === currentGameRef.current.id
        ? currentGameRef.current.courtSidesFlipped
        : undefined);
    const merged: Game = applyResolvedPossessionArrow({
      ...synced,
      courtSidesFlipped: courtSidesFlipped === true ? true : undefined,
    });
    currentGameRef.current = merged;
    setCurrentGame(merged);
    setMinutesState(replayed.state);
    setOnCourtHome(replayed.state.onCourtHome);
    setOnCourtAway(replayed.state.onCourtAway);
  }, [game, game.id, game.events.length, rosterContext]);

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
      const synced = GameLogic.syncTrackedTeamTotalsFromPlayers(replayed.game);
      currentGameRef.current = synced;
      setCurrentGame(synced);
      setMinutesState(replayed.state);
      setOnCourtHome(replayed.state.onCourtHome);
      setOnCourtAway(replayed.state.onCourtAway);
      onGameUpdate(synced);
      if (
        options?.skipPossessionSync ||
        entryStateRef.current.phase.kind === 'free_throw'
      ) {
        return;
      }
      const snap = derivePossessionSnapshot(synced, synced.events);
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
      const cleaned = stripPossessionContext(events);
      const base = GameLogic.replayFromEvents(currentGameRef.current, cleaned);
      const replayed = replayMinutesOntoGame(base);
      syncGame(replayed.game);
      syncMinutesFromGame(replayed.game);
      dispatch({ type: 'RESET' });
    },
    [syncGame, syncMinutesFromGame]
  );

  const commitShot = useCallback(
    (pending: PendingShot, and1 = false) => {
      const game = currentGameRef.current;
      const built = buildShotEvent(game, offenseTeamId, pending);
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
        ...game,
        shots: [...game.shots, built.shot],
      };
      g = GameLogic.recordEvent(g, built.event);
      const { shootingTeamId, defendingTeamId } = deriveReboundTeamsForMissedShot(
        game,
        pending,
        built.event.teamId
      );
      syncGame(g);

      if (and1 && (pending.shooterId || pending.teamOnly)) {
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
    [offenseTeamId, syncGame]
  );

  const handleShotOutcome = useCallback(
    (outcome: 'make' | 'miss' | 'block', point?: { xM: number; yM: number }) => {
      const pendingBase = entryStateRef.current.ctx.pendingShot;
      if (!pendingBase) return;

      if (point) {
        dispatch({
          type: 'ADD_MARKER',
          marker: { point, color: outcome === 'make' ? 'green' : 'red' },
        });
      }

      const single = isSingleTeamLive(currentGameRef.current);
      const oppOffense = isOppUnitOffense(currentGameRef.current, offenseTeamId);

      if (single && oppOffense) {
        if (outcome === 'miss') {
          commitShot({ ...pendingBase, outcome: 'miss', teamOnly: true });
          return;
        }
        if (outcome === 'make') {
          dispatch({ type: 'SHOT_OUTCOME', outcome: 'make', teamOnly: true });
          return;
        }
        // block — pick home blocker next
        dispatch({ type: 'SHOT_OUTCOME', outcome: 'block', teamOnly: true });
        return;
      }

      if (single && !oppOffense && outcome === 'block') {
        dispatch({ type: 'SHOT_OUTCOME', outcome: 'block', skipBlockerPick: true });
        return;
      }

      dispatch({ type: 'SHOT_OUTCOME', outcome });
    },
    [commitShot, offenseTeamId]
  );

  const commitRebound = useCallback(
    (reboundType: string, playerId?: string) => {
      const game = currentGameRef.current;
      const teams = resolveReboundTeams(
        game,
        entryState.ctx.reboundShootingTeamId,
        entryState.ctx.reboundDefendingTeamId
      );
      let teamId = teams?.shootingTeamId;
      if (reboundType === 'defensive' || reboundType === 'team_defensive') {
        teamId = teams?.defendingTeamId;
      }
      if (!teamId) return;

      const event = buildReboundEvent(game, teamId, playerId, reboundType);
      syncGame(GameLogic.recordEvent(game, event));
      dispatch({ type: 'RESET' });
    },
    [
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
      const game = currentGameRef.current;
      const event = buildTurnoverEvent(
        game,
        offenseTeamId,
        playerId,
        isTeam,
        stolenBy
      );
      syncGame(GameLogic.recordEvent(game, event));
      dispatch({ type: 'RESET' });
    },
    [offenseTeamId, syncGame]
  );

  const commitOpeningTip = useCallback(
    (winnerTeamId: string) => {
      const game = currentGameRef.current;
      const loserTeamId =
        winnerTeamId === game.homeTeamId
          ? game.awayTeamId
          : game.homeTeamId;
      const event = buildOpeningJumpBallEvent(game, winnerTeamId, loserTeamId);
      syncGame(GameLogic.recordEvent(game, event));
      dispatch({ type: 'RESET' });
    },
    [syncGame]
  );

  const startJumpBall = useCallback(() => {
    const game = currentGameRef.current;
    const arrowTeamId = game.possessionArrowTeamId;
    if (!arrowTeamId) return;

    if (arrowTeamId === offenseTeamId) {
      const event = buildHeldBallJumpBallEvent(game, {
        losingTeamId: offenseTeamId,
        arrowBeforeTeamId: arrowTeamId,
        arrowAfterTeamId: opponentTeamId(game, arrowTeamId),
        awardedTeamId: offenseTeamId,
        possessionChanged: false,
      });
      syncGame(GameLogic.recordEvent(game, event));
      dispatch({ type: 'RESET' });
    } else {
      dispatch({ type: 'START_JUMPBALL' });
    }
  }, [offenseTeamId, syncGame]);

  const commitJumpBallWithStats = useCallback(
    (turnoverPlayerId?: string, stealPlayerId?: string) => {
      const game = currentGameRef.current;
      const arrowTeamId = game.possessionArrowTeamId;
      if (!arrowTeamId) return;

      const event = buildHeldBallJumpBallEvent(game, {
        losingTeamId: offenseTeamId,
        arrowBeforeTeamId: arrowTeamId,
        arrowAfterTeamId: opponentTeamId(game, arrowTeamId),
        awardedTeamId: arrowTeamId,
        possessionChanged: true,
        turnoverPlayerId,
        stealPlayerId,
      });
      syncGame(GameLogic.recordEvent(game, event));
      dispatch({ type: 'RESET' });
    },
    [offenseTeamId, syncGame]
  );

  const commitFoul = useCallback(
    (params: FoulCommitParams) => {
      const game = currentGameRef.current;
      const offendedTeamId = params.offendedTeamId ?? offenseTeamId;
      const event = buildFoulEvent(game, {
        foulingTeamId: params.foulingTeamId,
        committerId: params.committerId,
        recipientId: params.recipientId,
        chargeDrawnBy: params.chargeDrawnBy,
        foulCategory: params.foulCategory,
        isTeamFoul: params.foulEntity === 'team',
        isCoachFoul: params.isCoachFoul,
        retainPossession: params.retainPossession ?? false,
        offendedTeamId,
        doublePartnerPlayerId: params.doublePartnerPlayerId,
        doublePartnerTeamId: params.doublePartnerTeamId,
      });
      const g = GameLogic.recordEvent(game, event);
      syncGame(g);

      if (params.ftCount > 0 && (params.ftShooterId || params.ftShootingTeamId)) {
        const shooterTeam = params.ftShooterId
          ? teamIdForPlayer(g, params.ftShooterId) ??
            (g.homeTeam.players.some((p) => p.id === params.ftShooterId)
              ? g.homeTeamId
              : g.awayTeamId)
          : (params.ftShootingTeamId as string);
        const retainPossession = params.retainPossession ?? false;
        const possessionTeamAfterFt =
          params.possessionTeamAfterFt ??
          (retainPossession
            ? offendedTeamId
            : opponentTeamId(g, shooterTeam));

        dispatch({
          type: 'START_FT',
          playerId: params.ftShooterId,
          shootingTeamId: shooterTeam,
          ftTotal: params.ftCount,
          retainPossession,
          offendedTeamId,
          possessionTeamAfterFt,
        });
      } else {
        dispatch({ type: 'RESET' });
      }
    },
    [offenseTeamId, syncGame]
  );

  const commitFreeThrow = useCallback(
    (made: boolean) => {
      const phase = entryStateRef.current.phase;
      if (phase.kind !== 'free_throw') return;

      const game = currentGameRef.current;
      const {
        playerId,
        shootingTeamId,
        ftTotal,
        ftIndex,
        retainPossession,
        offendedTeamId,
        possessionTeamAfterFt,
      } = phase;
      const shooterTeam =
        shootingTeamId ??
        (playerId
          ? teamIdForPlayer(game, playerId) ??
            (game.homeTeam.players.some((p) => p.id === playerId)
              ? game.homeTeamId
              : game.awayTeamId)
          : game.awayTeamId);
      const defendingTeamId = opponentTeamId(game, shooterTeam);

      const event = buildFreeThrowEvent(
        game,
        shooterTeam,
        playerId,
        made,
        ftIndex,
        ftTotal,
        { retainPossession, offendedTeamId, possessionTeamAfterFt }
      );
      let g = GameLogic.recordEvent(game, event);
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
    [syncGame, dispatch]
  );

  const commitSubstitution = useCallback(
    (
      teamId: string,
      outIds: string[],
      inIds: string[],
      clockTime: string,
      options?: { preserveEntryPhase?: boolean }
    ) => {
      const game = currentGameRef.current;
      const checkpointFrom = minutesState.checkpointClock;
      if (!isValidSubstitutionClock(checkpointFrom, clockTime)) {
        return { ok: false as const, error: `Time must be at or before ${checkpointFrom}` };
      }

      const scores = {
        home: game.teamStats.home.total_points,
        away: game.teamStats.away.total_points,
      };

      const checkpoint = applySubstitutionCheckpoint(
        game,
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
      if (!options?.preserveEntryPhase) {
        dispatch({ type: 'RESET' });
      }
      return { ok: true as const };
    },
    [minutesState, syncGame]
  );

  const commitPeriodEnd = useCallback((): Game => {
    const game = currentGameRef.current;
    const scores = {
      home: game.teamStats.home.total_points,
      away: game.teamStats.away.total_points,
    };
    const flushed = flushStintToClock(game, minutesState, '0:00', scores);
    const event = buildPeriodEndEvent(flushed.game, game.currentPeriod);
    const g = GameLogic.recordEvent(flushed.game, event);
    const updated = { ...g, currentGameTime: '0:00' };
    syncGame(updated);
    setMinutesState(flushed.state);
    return updated;
  }, [minutesState, syncGame]);

  const commitPeriodStart = useCallback(
    (homeLineup: string[], awayLineup: string[]) => {
      const game = currentGameRef.current;
      const nextPeriod = game.currentPeriod + 1;
      const clock = clockForPeriod(nextPeriod, resolveGameClockSettings(game));
      const started = startPeriodLineups(game, nextPeriod, homeLineup, awayLineup);
      const possessionTeamId = game.possessionArrowTeamId;
      const periodStartOptions =
        possessionTeamId != null
          ? {
              possessionTeamId,
              arrowAfterTeamId: opponentTeamId(game, possessionTeamId),
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
    [syncGame]
  );

  const undo = useCallback(() => {
    const updated = GameLogic.undoLastEvent(currentGameRef.current);
    const replayed = replayMinutesOntoGame(updated);
    syncGame(replayed.game);
    setMinutesState(replayed.state);
    setOnCourtHome(replayed.state.onCourtHome);
    setOnCourtAway(replayed.state.onCourtAway);
    dispatch({ type: 'RESET' });
    if (gameNeedsOpeningJumpBall(updated)) {
      dispatch({ type: 'START_OPENING_JUMPBALL' });
    }
  }, [syncGame]);

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
