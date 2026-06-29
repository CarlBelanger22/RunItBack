import { useCallback, useEffect, useReducer, useState } from 'react';
import type { Game, GameEvent, Player } from '../App';
import { GameLogic } from '../utils/GameLogic';
import { resolveShotZone, clickToCourtPointM, type CourtPointM } from '../lib/fibaCourtGeometry';
import {
  clockForPeriod,
  resolveGameClockSettings,
} from '../utils/gameClock';
import {
  buildFoulEvent,
  buildFreeThrowEvent,
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
      const zone = resolveShotZone(point);
      dispatch({ type: 'COURT_CLICK', point, zone });
    },
    []
  );

  const handleCourtPoint = useCallback((point: CourtPointM) => {
    const zone = resolveShotZone(point);
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
      syncGame(g);

      if (and1 && pending.shooterId) {
        dispatch({ type: 'START_FOUL' });
        return;
      }

      if (pending.outcome === 'miss' || pending.outcome === 'block') {
        dispatch({ type: 'START_REBOUND' });
      } else {
        dispatch({ type: 'RESET' });
      }
    },
    [currentGame, offenseTeamId, syncGame]
  );

  const commitRebound = useCallback(
    (reboundType: string, playerId?: string) => {
      let teamId = offenseTeamId;
      if (reboundType === 'defensive' || reboundType === 'team_defensive') {
        teamId = defenseTeamId;
      }

      const event = buildReboundEvent(currentGame, teamId, playerId, reboundType);
      syncGame(GameLogic.recordEvent(currentGame, event));
      dispatch({ type: 'RESET' });
    },
    [currentGame, defenseTeamId, offenseTeamId, syncGame]
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

  const commitFoul = useCallback(
    (
      committerId: string,
      recipientId: string | undefined,
      foulCategory: string,
      ftCount: number,
      ftShooterId?: string
    ) => {
      const event = buildFoulEvent(
        currentGame,
        defenseTeamId,
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
      syncGame(g);

      if (ftIndex < ftTotal) {
        setFtSession({ playerId, ftTotal, ftIndex: ftIndex + 1 });
      } else {
        setFtSession(null);
        if (!made) dispatch({ type: 'START_REBOUND' });
        else dispatch({ type: 'RESET' });
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
    syncGame(GameLogic.undoLastEvent(currentGame));
    dispatch({ type: 'RESET' });
    setFtSession(null);
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
    ftSession,
    onCourtHome,
    onCourtAway,
  };
}
