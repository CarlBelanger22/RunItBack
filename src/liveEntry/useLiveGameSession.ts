import { useCallback, useEffect, useReducer, useState } from 'react';
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
import { gameNeedsOpeningJumpBall, opponentTeamId } from './possessionArrow';

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
  const [ftSession, setFtSession] = useState<{
    playerId: string;
    ftTotal: number;
    ftIndex: number;
  } | null>(null);

  const [entryState, dispatch] = useReducer(liveEntryReducer, {
    phase: { kind: 'idle' as const },
    ctx: initialLiveEntryContext(
      game.homeTeamId,
      resolveOnCourt(game, 'home'),
      resolveOnCourt(game, 'away')
    ),
  } as LiveEntryState);

  useEffect(() => {
    setCurrentGame(game);
  }, [game]);

  useEffect(() => {
    if (gameNeedsOpeningJumpBall(game)) {
      dispatch({ type: 'START_OPENING_JUMPBALL' });
    }
  }, [game.id]);

  const offenseTeamId = entryState.ctx.offenseTeamId;
  const defenseTeamId = defenseTeamIdFor(
    currentGame.homeTeamId,
    currentGame.awayTeamId,
    offenseTeamId
  );

  const syncGame = useCallback(
    (updated: Game) => {
      setCurrentGame(updated);
      onGameUpdate(updated);
      const snap = derivePossessionSnapshot(updated, updated.events);
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
      syncGame(GameLogic.replayFromEvents(currentGame, events));
      dispatch({ type: 'RESET' });
      setFtSession(null);
    },
    [currentGame, syncGame]
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
      const shootingTeamId = offenseTeamId;
      const defendingTeamId = defenseTeamId;
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
      const shootingTeam = entryState.ctx.reboundShootingTeamId ?? offenseTeamId;
      const defendingTeam = entryState.ctx.reboundDefendingTeamId ?? defenseTeamId;
      let teamId = shootingTeam;
      if (reboundType === 'defensive' || reboundType === 'team_defensive') {
        teamId = defendingTeam;
      }

      const event = buildReboundEvent(currentGame, teamId, playerId, reboundType);
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    },
    [
      currentGame,
      defenseTeamId,
      entryState.ctx.reboundDefendingTeamId,
      entryState.ctx.reboundShootingTeamId,
      offenseTeamId,
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
    (
      committerId: string,
      recipientId: string | undefined,
      foulCategory: string,
      ftCount: number,
      ftShooterId?: string,
      foulingTeamId?: string
    ) => {
      const event = buildFoulEvent(
        currentGame,
        foulingTeamId ?? defenseTeamId,
        committerId,
        recipientId,
        foulCategory
      );
      let g = GameLogic.recordEvent(currentGame, event);
      syncGame(g);

      if (ftCount > 0 && ftShooterId) {
        setFtSession({ playerId: ftShooterId, ftTotal: ftCount, ftIndex: 1 });
        dispatch({ type: 'START_FT', playerId: ftShooterId, ftTotal: ftCount });
      } else {
        dispatch({ type: 'RESET' });
      }
    },
    [currentGame, defenseTeamId, syncGame]
  );

  const commitFreeThrow = useCallback(
    (made: boolean) => {
      if (!ftSession) return;
      const { playerId, ftTotal, ftIndex } = ftSession;
      const shooterTeam =
        currentGame.homeTeam.players.some((p) => p.id === playerId)
          ? currentGame.homeTeamId
          : currentGame.awayTeamId;

      const event = buildFreeThrowEvent(
        currentGame,
        shooterTeam,
        playerId,
        made,
        ftIndex,
        ftTotal
      );
      const g = GameLogic.recordEvent(currentGame, event);
      const defendingTeamId =
        shooterTeam === currentGame.homeTeamId
          ? currentGame.awayTeamId
          : currentGame.homeTeamId;
      syncGame(g);

      if (ftIndex < ftTotal) {
        setFtSession({ playerId, ftTotal, ftIndex: ftIndex + 1 });
      } else {
        setFtSession(null);
        if (!made) {
          dispatch({
            type: 'START_REBOUND',
            shootingTeamId: shooterTeam,
            defendingTeamId,
          });
        } else {
          dispatch({ type: 'RESET' });
        }
      }
    },
    [currentGame, ftSession, syncGame]
  );

  const commitSubstitution = useCallback(
    (teamId: string, outIds: string[], inIds: string[]) => {
      const event = buildSubstitutionEvent(currentGame, teamId, outIds, inIds);
      syncGame(GameLogic.recordEvent(currentGame, event));

      if (teamId === currentGame.homeTeamId) {
        setOnCourtHome((prev) =>
          prev.filter((id) => !outIds.includes(id)).concat(inIds)
        );
      } else {
        setOnCourtAway((prev) =>
          prev.filter((id) => !outIds.includes(id)).concat(inIds)
        );
      }
      dispatch({ type: 'RESET' });
    },
    [currentGame, syncGame]
  );

  const undo = useCallback(() => {
    const updated = GameLogic.undoLastEvent(currentGame);
    syncGame(updated);
    dispatch({ type: 'RESET' });
    setFtSession(null);
    if (gameNeedsOpeningJumpBall(updated)) {
      dispatch({ type: 'START_OPENING_JUMPBALL' });
    }
  }, [currentGame, syncGame]);

  const endPeriod = useCallback(() => {
    const nextPeriod = currentGame.currentPeriod + 1;
    const clock = resolveGameClockSettings(currentGame);
    syncGame({
      ...currentGame,
      currentPeriod: nextPeriod,
      currentGameTime: clockForPeriod(nextPeriod, clock),
    });
  }, [currentGame, syncGame]);

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
    undo,
    replayEvents,
    endPeriod,
    toggleClock,
    getTeamPlayers,
    getOnCourtIds,
    offenseTeamId,
    defenseTeamId,
    possessionArrowTeamId: currentGame.possessionArrowTeamId ?? null,
    ftSession,
    onCourtHome,
    onCourtAway,
  };
}
