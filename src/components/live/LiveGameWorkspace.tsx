import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Label } from '../ui/label';
import type { Game, GameEvent, Player, Team, Tournament } from '../../App';
import type { TournamentRosterEntry } from '../../utils/tournamentRosters';
import { GameForm } from '../forms/GameForm';
import { buildGameMetadataPatch } from '../../utils/gameMetadata';
import { useLiveGameSession } from '../../liveEntry/useLiveGameSession';
import { HorizontalFullCourtCanvas } from './HorizontalFullCourtCanvas';
import { OnCourtColumn } from './OnCourtColumn';
import { LiveGameHeader } from './LiveGameHeader';
import { LiveActionBar } from './LiveActionBar';
import { LivePlayByPlayRail } from './LivePlayByPlayRail';
import { LiveBoxScorePanel } from './LiveBoxScorePanel';
import { EventEditDialog, type EventEditSaveResult } from './EventEditDialog';
import { resolveHorizontalShotZone, homeAttacksLeft } from '../../lib/horizontalCourtClick';
import { courtPointMToPercent, type CourtPointM } from '../../lib/fibaCourtGeometry';
import { ShotOutcomeOverlay } from './ShotOutcomeOverlay';
import { FreeThrowOutcomeOverlay } from './FreeThrowOutcomeOverlay';
import { CourtAnchoredOverlayPortal } from './CourtAnchoredOverlayPortal';
import { LiveCourtFlowOverlays } from './LiveCourtFlowOverlays';
import { LiveOpeningJumpBallOverlay } from './LiveOpeningJumpBallOverlay';
import {
  LiveQuarterLineupOverlay,
  SubstitutionClockInput,
} from './LiveQuarterLineupOverlay';
import {
  endPeriodButtonLabel,
  isValidSubstitutionClock,
  shouldCompleteGameOnPeriodEnd,
  shouldPromptLineupAfterPeriodEnd,
} from '../../utils/gameClock';
import { DesktopOnlyGuard } from './DesktopOnlyGuard';
import { paths } from '../../routing/paths';
import { getLiveTeamColor, liveTeamTint } from './liveEntryTheme';
import type { LiveEntryAction, LiveEntryPhase, PendingShot } from '../../liveEntry/liveEntryStateMachine';
import { resolveReboundTeams, teamIdForPlayer } from '../../liveEntry/reboundTeams';
import { getLineupStateBeforeEvent } from '../../liveEntry/minutesEngine';
import { courtOverlayActive } from '../../liveEntry/courtOverlayActive';
import {
  getFouledOutOnCourt,
  isFoulOutEnabled,
  isPlayerFouledOut,
  type FouledOutPlayer,
} from '../../utils/foulOut';

interface LiveGameWorkspaceProps {
  game: Game;
  teams: Team[];
  tournaments: Tournament[];
  tournamentRosters: TournamentRosterEntry[];
  onGameUpdate: (game: Game) => void;
  onGameComplete: (game: Game) => void;
  onDeleteGame: () => void;
}

type Side = 'home' | 'away';

interface ColumnPick {
  side: Side;
  hint: string;
  onSelect: (player: Player) => void;
  excludeId?: string | null;
}

function teamSide(game: Game, teamId: string): Side {
  return teamId === game.homeTeamId ? 'home' : 'away';
}

function resolveColumnPick(
  game: Game,
  phase: LiveEntryPhase,
  offenseTeamId: string,
  defenseTeamId: string,
  possessionArrowTeamId: string | null,
  pending: PendingShot | null,
  pendingReboundType: string | null,
  turnoverPlayerId: string | undefined,
  trackBoth: boolean,
  reboundShootingTeamId: string | null,
  reboundDefendingTeamId: string | null,
  handlers: {
    dispatch: ReturnType<typeof useLiveGameSession>['dispatch'];
    commitShot: ReturnType<typeof useLiveGameSession>['commitShot'];
    commitRebound: ReturnType<typeof useLiveGameSession>['commitRebound'];
    commitTurnover: ReturnType<typeof useLiveGameSession>['commitTurnover'];
    commitJumpBallWithStats: ReturnType<typeof useLiveGameSession>['commitJumpBallWithStats'];
    commitFoul: ReturnType<typeof useLiveGameSession>['commitFoul'];
    setPendingReboundType: (v: string | null) => void;
    setTurnoverPlayerId: (v: string | undefined) => void;
    and1RecipientId: string | null;
    and1FoulingTeamId: string | null;
    clearAnd1Session: () => void;
  }
): ColumnPick | null {
  const { dispatch, commitShot, commitRebound, commitTurnover, commitJumpBallWithStats, commitFoul } =
    handlers;

  if (phase.kind === 'shot' && phase.step === 'pick_shooter' && pending) {
    return {
      side: teamSide(game, offenseTeamId),
      hint: 'Select shooter',
      onSelect: (p) => {
        const shot = { ...pending, shooterId: p.id };
        if (pending.outcome === 'miss' || pending.outcome === 'block') {
          commitShot(shot);
        } else {
          dispatch({ type: 'PICK_SHOOTER', playerId: p.id });
        }
      },
    };
  }

  if (phase.kind === 'shot' && phase.step === 'pick_blocker' && trackBoth) {
    return {
      side: teamSide(game, defenseTeamId),
      hint: 'Select blocker',
      onSelect: (p) => dispatch({ type: 'PICK_BLOCKER', playerId: p.id }),
    };
  }

  if (phase.kind === 'shot' && phase.step === 'pick_assist' && pending) {
    return {
      side: teamSide(game, offenseTeamId),
      hint: 'Select assister (optional — use overlay for no assist)',
      excludeId: pending.shooterId,
      onSelect: (p) => dispatch({ type: 'PICK_ASSIST', playerId: p.id }),
    };
  }

  if (
    phase.kind === 'rebound' &&
    pendingReboundType &&
    (pendingReboundType === 'offensive' || pendingReboundType === 'defensive')
  ) {
    const teams = resolveReboundTeams(game, reboundShootingTeamId, reboundDefendingTeamId);
    if (!teams) return null;
    const teamId =
      pendingReboundType === 'offensive' ? teams.shootingTeamId : teams.defendingTeamId;
    return {
      side: teamSide(game, teamId),
      hint: `${pendingReboundType === 'offensive' ? 'ORB' : 'DRB'} — select player`,
      onSelect: (p) => {
        commitRebound(pendingReboundType, p.id);
        handlers.setPendingReboundType(null);
      },
    };
  }

  if (phase.kind === 'turnover' && phase.step === 'entity') {
    return {
      side: teamSide(game, offenseTeamId),
      hint: 'Select turnover player (or use overlay for team TO)',
      onSelect: (p) => {
        dispatch({ type: 'TURNOVER_STEAL', hasSteal: false });
        commitTurnover(p.id, false);
      },
    };
  }

  if (phase.kind === 'turnover' && phase.step === 'pick_stealer') {
    if (!turnoverPlayerId) {
      return {
        side: teamSide(game, offenseTeamId),
        hint: 'Select turnover player',
        onSelect: (p) => handlers.setTurnoverPlayerId(p.id),
      };
    }
    if (trackBoth) {
      return {
        side: teamSide(game, defenseTeamId),
        hint: 'Select stealer',
        onSelect: (p) => {
          commitTurnover(turnoverPlayerId, false, p.id);
          handlers.setTurnoverPlayerId(undefined);
        },
      };
    }
  }

  if (phase.kind === 'jumpball' && phase.step === 'pick_to') {
    return {
      side: teamSide(game, offenseTeamId),
      hint: 'Jump ball — turnover player',
      onSelect: (p) => dispatch({ type: 'JUMPBALL_PICK_TO', playerId: p.id }),
    };
  }

  if (phase.kind === 'jumpball' && phase.step === 'pick_steal' && phase.turnoverPlayerId) {
    const arrowTeamId = possessionArrowTeamId ?? defenseTeamId;
    return {
      side: teamSide(game, arrowTeamId),
      hint: 'Jump ball — steal player',
      onSelect: (p) => {
        commitJumpBallWithStats(phase.turnoverPlayerId!, p.id);
      },
    };
  }

  if (phase.kind === 'foul' && phase.step === 'committer') {
    if (
      phase.foulCategory === 'technical' ||
      phase.foulCategory === 'unsportsmanlike' ||
      phase.foulEntity === 'team'
    ) {
      // Committer selectable on either roster (handled by both on-court columns).
      return null;
    }

    const isOffensive = phase.foulCategory === 'offensive';
    const foulingTeamId = isOffensive
      ? offenseTeamId
      : handlers.and1RecipientId && handlers.and1FoulingTeamId
        ? handlers.and1FoulingTeamId
        : defenseTeamId;

    return {
      side: teamSide(game, foulingTeamId),
      hint: isOffensive ? 'Offensive foul — select player' : 'Foul committed by',
      onSelect: (p) => {
        if (handlers.and1RecipientId) {
          commitFoul({
            foulingTeamId,
            foulCategory: 'personal',
            foulEntity: 'player',
            committerId: p.id,
            recipientId: handlers.and1RecipientId,
            ftCount: 1,
            ftShooterId: handlers.and1RecipientId,
            retainPossession: false,
            offendedTeamId: offenseTeamId,
          });
          handlers.clearAnd1Session();
        } else {
          // Offensive fouls also route through PICK_FOUL_COMMITTER now, then the
          // required charge_drawer step credits the defender with a foul drawn.
          dispatch({
            type: 'PICK_FOUL_COMMITTER',
            playerId: p.id,
            teamId: foulingTeamId,
          });
        }
      },
    };
  }

  if (phase.kind === 'foul' && phase.step === 'charge_drawer') {
    // Offensive foul: the defender who drew it is on the committer's opponent.
    const committerTeamId = phase.committerTeamId ?? offenseTeamId;
    const drawerTeamId =
      committerTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    return {
      side: teamSide(game, drawerTeamId),
      hint: 'Foul drawn by (defender)',
      onSelect: (p) => {
        commitFoul({
          foulingTeamId: committerTeamId,
          foulCategory: 'offensive',
          foulEntity: 'player',
          committerId: phase.committerId,
          chargeDrawnBy: p.id,
          ftCount: 0,
          retainPossession: false,
        });
      },
    };
  }

  if (phase.kind === 'foul' && phase.step === 'recipient') {
    // The fouled player is on the committer's opponent (falls back to offense for legacy personal fouls).
    const recipientTeamId = phase.committerTeamId
      ? phase.committerTeamId === game.homeTeamId
        ? game.awayTeamId
        : game.homeTeamId
      : offenseTeamId;
    return {
      side: teamSide(game, recipientTeamId),
      hint: 'Fouled player',
      onSelect: (p) => dispatch({ type: 'PICK_FOUL_RECIPIENT', playerId: p.id }),
    };
  }

  if (phase.kind === 'foul' && phase.step === 'double_committer_a') {
    return {
      side: teamSide(game, offenseTeamId),
      hint: 'Double foul — offense player',
      onSelect: (p) => dispatch({ type: 'PICK_DOUBLE_COMMITTER_A', playerId: p.id }),
    };
  }

  if (phase.kind === 'foul' && phase.step === 'double_committer_b') {
    return {
      side: teamSide(game, defenseTeamId),
      hint: 'Double foul — defense player',
      onSelect: (p) => dispatch({ type: 'PICK_DOUBLE_COMMITTER_B', playerId: p.id }),
    };
  }

  if (phase.kind === 'foul' && phase.step === 'tech_shooter' && phase.committerTeamId) {
    const nonOffendingTeamId =
      phase.committerTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    return {
      side: teamSide(game, nonOffendingTeamId),
      hint: 'Technical — free throw shooter',
      onSelect: (p) => {
        commitFoul({
          foulingTeamId: phase.committerTeamId!,
          foulCategory: 'technical',
          foulEntity: phase.isCoachFoul ? 'team' : 'player',
          committerId: phase.committerId,
          isCoachFoul: phase.isCoachFoul,
          ftCount: 1,
          ftShooterId: p.id,
          retainPossession: true,
          offendedTeamId: nonOffendingTeamId,
          possessionTeamAfterFt: offenseTeamId,
        });
      },
    };
  }

  return null;
}

export function LiveGameWorkspace({
  game,
  teams,
  tournaments,
  tournamentRosters,
  onGameUpdate,
  onGameComplete,
  onDeleteGame,
}: LiveGameWorkspaceProps) {
  const navigate = useNavigate();
  const session = useLiveGameSession(game, onGameUpdate, { teams, tournamentRosters });
  const {
    currentGame,
    entryState,
    dispatch,
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
    getTeamPlayers,
    getOnCourtIds,
    offenseTeamId,
    defenseTeamId,
    possessionArrowTeamId,
  } = session;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [fastbreak, setFastbreak] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subOut, setSubOut] = useState<string[]>([]);
  const [subIn, setSubIn] = useState<string[]>([]);
  const [subTeamId, setSubTeamId] = useState<string>(game.homeTeamId);
  const [subClock, setSubClock] = useState('');
  const [subClockError, setSubClockError] = useState<string | null>(null);
  /** When set, the sub dialog is editing this past substitution (not creating a new one). */
  const [editingSubEventId, setEditingSubEventId] = useState<string | null>(null);
  /** On-court IDs for the sub team at the moment before the edited substitution. */
  const [editSubOnCourtIds, setEditSubOnCourtIds] = useState<string[]>([]);
  const [editSubCheckpointFrom, setEditSubCheckpointFrom] = useState<string | null>(null);
  const [foulOutQueue, setFoulOutQueue] = useState<FouledOutPlayer[]>([]);
  const [lineupOverlayOpen, setLineupOverlayOpen] = useState(false);
  const [and1RecipientId, setAnd1RecipientId] = useState<string | null>(null);
  const [and1FoulingTeamId, setAnd1FoulingTeamId] = useState<string | null>(null);

  const clearAnd1Session = useCallback(() => {
    setAnd1RecipientId(null);
    setAnd1FoulingTeamId(null);
  }, []);

  const handleAndOneFoul = useCallback(
    (shotPayload: PendingShot) => {
      if (shotPayload.shooterId) {
        setAnd1RecipientId(shotPayload.shooterId);
        setAnd1FoulingTeamId(defenseTeamId);
      }
      commitShot(shotPayload, true);
      setFastbreak(false);
      dispatch({ type: 'FOUL_CATEGORY', category: 'personal' });
    },
    [commitShot, defenseTeamId, dispatch]
  );

  const [pendingReboundType, setPendingReboundType] = useState<string | null>(null);
  const [turnoverPlayerId, setTurnoverPlayerId] = useState<string | undefined>();
  const [editEvent, setEditEvent] = useState<GameEvent | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  /** Shot PBP edit: dialog closed while user re-taps the court for a new location. */
  const [relocatingShot, setRelocatingShot] = useState(false);

  const phase = entryState.phase;
  const pending = entryState.ctx.pendingShot;
  const trackBoth = currentGame.trackBothTeams;
  const isOpeningJumpBall = phase.kind === 'jumpball' && phase.step === 'opening';

  const handlePendingReboundTypeChange = useCallback(
    (value: string | null) => {
      setPendingReboundType(value);
      if (value === 'offensive' || value === 'defensive') {
        dispatch({ type: 'REBOUND_TYPE', reboundType: value });
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (
      phase.kind === 'idle' ||
      (phase.kind === 'shot' && phase.step === 'await_outcome')
    ) {
      setPendingReboundType(null);
    }
  }, [phase]);

  useEffect(() => {
    if (
      phase.kind === 'rebound' &&
      phase.step === 'pick_type' &&
      entryState.ctx.reboundShootingTeamId
    ) {
      setPendingReboundType(null);
    }
  }, [
    phase,
    entryState.ctx.reboundShootingTeamId,
    entryState.ctx.reboundDefendingTeamId,
  ]);

  const homeScore = currentGame.teamStats.home.total_points;
  const awayScore = currentGame.teamStats.away.total_points;
  const periodEndLabel = endPeriodButtonLabel(currentGame, homeScore, awayScore);

  useEffect(() => {
    if (phase.kind === 'idle') {
      clearAnd1Session();
    }
  }, [phase.kind, clearAnd1Session]);

  useEffect(() => {
    if (phase.kind !== 'free_throw' || subOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        commitFreeThrow(true);
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        commitFreeThrow(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase.kind, subOpen, commitFreeThrow]);

  const isTechFoulCommitter =
    phase.kind === 'foul' &&
    phase.step === 'committer' &&
    phase.foulCategory === 'technical';

  const isUnsportsmanlikeFoulCommitter =
    phase.kind === 'foul' &&
    phase.step === 'committer' &&
    phase.foulCategory === 'unsportsmanlike';

  // Fouls whose committer can be picked from either team's on-court roster.
  const isBothRosterFoulCommitter =
    isTechFoulCommitter || isUnsportsmanlikeFoulCommitter;

  const columnPick = useMemo(
    () =>
      resolveColumnPick(
        currentGame,
        phase,
        offenseTeamId,
        defenseTeamId,
        possessionArrowTeamId,
        pending,
        pendingReboundType,
        turnoverPlayerId,
        trackBoth,
        entryState.ctx.reboundShootingTeamId,
        entryState.ctx.reboundDefendingTeamId,
        {
          dispatch,
          commitShot,
          commitRebound,
          commitTurnover,
          commitJumpBallWithStats,
          commitFoul,
          setPendingReboundType,
          setTurnoverPlayerId,
          and1RecipientId,
          and1FoulingTeamId,
          clearAnd1Session,
        }
      ),
    [
      currentGame,
      phase,
      offenseTeamId,
      defenseTeamId,
      possessionArrowTeamId,
      pending,
      pendingReboundType,
      turnoverPlayerId,
      trackBoth,
      entryState.ctx.reboundShootingTeamId,
      entryState.ctx.reboundDefendingTeamId,
      dispatch,
      commitShot,
      commitRebound,
      commitTurnover,
      commitJumpBallWithStats,
      commitFoul,
      and1RecipientId,
      and1FoulingTeamId,
      clearAnd1Session,
    ]
  );

  const showShotOverlay =
    phase.kind === 'shot' && phase.step === 'await_outcome' && pending;

  const showFtOverlay = phase.kind === 'free_throw' && !subOpen;

  const portaledCourtOverlayOpen = Boolean(showShotOverlay) || Boolean(showFtOverlay);

  const courtFrameRef = useRef<HTMLDivElement>(null);

  const courtAcceptsPlacement =
    (!isOpeningJumpBall && phase.kind === 'idle') || relocatingShot;

  /** During relocate, orient the court to the shot's shooting team — not live possession. */
  const canvasOffenseTeamId =
    relocatingShot && editEvent
      ? (editEvent.playerId
          ? teamIdForPlayer(currentGame, editEvent.playerId)
          : null) ?? editEvent.teamId
      : offenseTeamId;

  const flowCourtOverlayVisible = useMemo(
    () =>
      courtOverlayActive({
        phase,
        pending,
        pendingReboundType,
        trackBoth,
        turnoverPlayerId,
        showShotOverlay: false,
      }),
    [phase, pending, pendingReboundType, trackBoth, turnoverPlayerId]
  );

  const contextHint = useMemo(() => {
    if (columnPick) return null;
    if (showShotOverlay) return 'Make / miss / block on court overlay';
    if (phase.kind === 'shot' && phase.step === 'fastbreak') return 'Confirm make — commit or + foul';
    if (phase.kind === 'shot' && phase.step === 'pick_assist') return 'Select assister or use overlay';
    if (phase.kind === 'shot' && phase.step === 'pick_shooter') return 'Select shooter on roster';
    if (phase.kind === 'shot' && phase.step === 'pick_blocker') return 'Select blocker on roster';
    if (phase.kind === 'rebound' && phase.step === 'pick_type') {
      if (pendingReboundType === 'offensive' || pendingReboundType === 'defensive') {
        return `${pendingReboundType === 'offensive' ? 'ORB' : 'DRB'} — select player on roster`;
      }
      return 'Choose rebound type on court overlay';
    }
    if (phase.kind === 'turnover' && phase.step === 'entity') return 'Turnover — select player or use overlay';
    if (phase.kind === 'turnover' && phase.step === 'pick_stealer') {
      return turnoverPlayerId ? 'Select stealer on roster' : 'Select turnover player on roster';
    }
    if (phase.kind === 'jumpball' && phase.step === 'pick_to') {
      return 'Jump ball — select turnover player';
    }
    if (phase.kind === 'jumpball' && phase.step === 'pick_steal') {
      return 'Jump ball — select steal player';
    }
    if (phase.kind === 'foul' && phase.step === 'entity') return 'Foul — player or team on court overlay';
    if (phase.kind === 'foul' && phase.step === 'category') return 'Choose foul category on court overlay';
    if (isTechFoulCommitter) return 'Technical — select committer on either roster or coach in overlay';
    if (isUnsportsmanlikeFoulCommitter) return 'Unsportsmanlike — select committer on either roster';
    if (phase.kind === 'foul' && phase.step === 'committer') return 'Select foul committer on roster';
    if (phase.kind === 'foul' && phase.step === 'recipient') return 'Select fouled player on roster';
    if (phase.kind === 'foul' && phase.step === 'double_committer_a') {
      return 'Double foul — select offense player';
    }
    if (phase.kind === 'foul' && phase.step === 'double_committer_b') {
      return 'Double foul — select defense player';
    }
    if (phase.kind === 'foul' && phase.step === 'tech_shooter') {
      return 'Technical — select free throw shooter';
    }
    if (phase.kind === 'foul' && phase.step === 'ft_count') return 'Choose free throws on court overlay';
    if (phase.kind === 'free_throw') return 'Make / miss on court overlay (M / X keys)';
    return '← Tap court to log a shot';
  }, [columnPick, showShotOverlay, phase, pendingReboundType, turnoverPlayerId, isTechFoulCommitter, isUnsportsmanlikeFoulCommitter]);

  const openSubForTeam = (teamId: string) => {
    setEditingSubEventId(null);
    setEditSubOnCourtIds([]);
    setEditSubCheckpointFrom(null);
    setSubTeamId(teamId);
    setSubOut([]);
    setSubIn([]);
    setSubClock(currentGame.currentGameTime);
    setSubClockError(null);
    setSubOpen(true);
  };

  const openSubEdit = (event: GameEvent) => {
    if (event.type !== 'substitution') return;
    const before = getLineupStateBeforeEvent(currentGame, event.id);
    if (!before) return;
    const onCourt =
      event.teamId === currentGame.homeTeamId ? before.onCourtHome : before.onCourtAway;
    const outIds = (event.details.playersOut as string[]) ?? [];
    const inIds = (event.details.playersIn as string[]) ?? [];
    const clock =
      (event.details.clockTime as string) ??
      (event.details.checkpointTo as string) ??
      event.gameTime;
    const checkpointFrom =
      (event.details.checkpointFrom as string) ?? before.checkpointClock;

    setEditingSubEventId(event.id);
    setEditSubOnCourtIds(onCourt);
    setEditSubCheckpointFrom(checkpointFrom);
    setSubTeamId(event.teamId);
    setSubOut([...outIds]);
    setSubIn([...inIds]);
    setSubClock(clock);
    setSubClockError(null);
    setEditDialogOpen(false);
    setEditEvent(null);
    setSubOpen(true);
  };

  const handleEndPeriod = () => {
    const endingPeriod = currentGame.currentPeriod;
    const complete = shouldCompleteGameOnPeriodEnd(currentGame, homeScore, awayScore);
    const promptLineup = shouldPromptLineupAfterPeriodEnd(currentGame, homeScore, awayScore);
    let updatedGame = commitPeriodEnd();
    // LE-90: always flip court sides at half (end of Q2).
    if (endingPeriod === 2) {
      updatedGame = {
        ...updatedGame,
        courtSidesFlipped: !updatedGame.courtSidesFlipped,
      };
      onGameUpdate(updatedGame);
    }
    if (complete) {
      onGameComplete(updatedGame);
      return;
    }
    if (promptLineup) {
      setLineupOverlayOpen(true);
    }
  };

  const tournament = tournaments.find((t) => t.id === currentGame.tournamentId);
  const foulOutEnabled = isFoulOutEnabled(currentGame, tournament);
  const fouledOutIds = foulOutEnabled
    ? currentGame.gameStats
        .filter((s) => isPlayerFouledOut(s))
        .map((s) => s.playerId)
    : [];

  // A fouled-out player stays visible but locked (cannot re-enter for the rest of the game).
  const isPlayerLockedOut = (playerId: string) =>
    foulOutEnabled &&
    isPlayerFouledOut(currentGame.gameStats.find((s) => s.playerId === playerId));

  const benchPlayers = (teamId: string) => {
    const onCourt = new Set(
      editingSubEventId && teamId === subTeamId
        ? editSubOnCourtIds
        : getOnCourtIds(teamId)
    );
    return getTeamPlayers(teamId).filter((p) => !onCourt.has(p.id));
  };

  const subDialogOnCourtIds =
    editingSubEventId && subTeamId
      ? editSubOnCourtIds
      : getOnCourtIds(subTeamId);

  // Bench players who can actually be brought in (excludes fouled-out/locked).
  const eligibleBench = (teamId: string) =>
    benchPlayers(teamId).filter((p) => !isPlayerLockedOut(p.id));

  const toggleSub = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  // LE-36: detect on-court players who have fouled out and queue them for a
  // forced substitution (one dialog at a time; a double foul can queue two).
  useEffect(() => {
    const fouledOut = getFouledOutOnCourt(
      currentGame,
      getOnCourtIds(currentGame.homeTeamId),
      getOnCourtIds(currentGame.awayTeamId),
      tournament
    );
    if (fouledOut.length === 0) return;
    setFoulOutQueue((prev) => {
      const known = new Set(prev.map((p) => p.playerId));
      const additions = fouledOut.filter((p) => !known.has(p.playerId));
      return additions.length === 0 ? prev : [...prev, ...additions];
    });
  }, [currentGame, getOnCourtIds, tournament]);

  const forcedFoulOut = foulOutQueue[0] ?? null;
  const isForcedSub = Boolean(forcedFoulOut);
  const forcedFoulOutPlayer = forcedFoulOut
    ? getTeamPlayers(forcedFoulOut.teamId).find(
        (p) => p.id === forcedFoulOut.playerId
      ) ?? null
    : null;
  // Short-handed: fouled-out player's team has no eligible replacement.
  const forcedNoBench =
    isForcedSub && forcedFoulOut
      ? eligibleBench(forcedFoulOut.teamId).length === 0
      : false;

  // Open/configure the substitution dialog in forced mode for the queued player.
  useEffect(() => {
    if (!forcedFoulOut) return;
    setSubTeamId(forcedFoulOut.teamId);
    setSubOut([forcedFoulOut.playerId]);
    setSubIn([]);
    setSubClock(currentGame.currentGameTime);
    setSubClockError(null);
    setSubOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedFoulOut?.playerId]);

  const handleSaveEventEdit = (result: EventEditSaveResult) => {
    const { event: updated, reboundAfter, removeFollowingRebound } = result;
    const idx = currentGame.events.findIndex((e) => e.id === updated.id);
    if (idx < 0) return;
    const next = [...currentGame.events];
    next[idx] = updated;

    const following = next[idx + 1];
    const followingIsRebound = following?.type === 'rebound';

    if (removeFollowingRebound && followingIsRebound) {
      next.splice(idx + 1, 1);
    } else if (reboundAfter) {
      const rebDetails = {
        reboundType: reboundAfter.reboundType,
      };
      if (followingIsRebound) {
        next[idx + 1] = {
          ...following,
          teamId: reboundAfter.teamId,
          playerId: reboundAfter.playerId,
          details: { ...following.details, ...rebDetails },
        };
      } else {
        const ts = Date.now();
        next.splice(idx + 1, 0, {
          id: `event-${ts}`,
          type: 'rebound',
          timestamp: ts,
          period: updated.period,
          gameTime: updated.gameTime,
          teamId: reboundAfter.teamId,
          playerId: reboundAfter.playerId,
          details: rebDetails,
          homeScore: updated.homeScore,
          awayScore: updated.awayScore,
        });
      }
    }

    setRelocatingShot(false);
    setEditEvent(null);
    replayEvents(next);
  };

  const handleRequestShotRelocate = useCallback((draft: GameEvent, _reboundKey: string) => {
    setEditEvent(draft);
    setEditDialogOpen(false);
    setRelocatingShot(true);
  }, []);

  const handleCancelShotRelocate = useCallback(() => {
    setRelocatingShot(false);
    if (editEvent) setEditDialogOpen(true);
  }, [editEvent]);

  const handleCourtPointForEditOrShot = useCallback(
    (point: CourtPointM) => {
      if (relocatingShot && editEvent?.type === 'shot_attempt') {
        const zone = resolveHorizontalShotZone(point);
        const pct = courtPointMToPercent(point);
        setEditEvent({
          ...editEvent,
          details: {
            ...editEvent.details,
            x: pct.x,
            y: pct.y,
            isThree: zone.shotValue === 3,
            inPaint: zone.isPaint,
          },
        });
        setRelocatingShot(false);
        setEditDialogOpen(true);
        return;
      }
      handleCourtPoint(point);
    },
    [relocatingShot, editEvent, handleCourtPoint]
  );

  const homeIsOffense = offenseTeamId === currentGame.homeTeamId;
  const actionBarDisabled =
    isOpeningJumpBall ||
    lineupOverlayOpen ||
    relocatingShot ||
    (phase.kind !== 'idle' && phase.kind !== 'shot');

  const subDisabled =
    isOpeningJumpBall ||
    lineupOverlayOpen ||
    (phase.kind !== 'idle' &&
      phase.kind !== 'shot' &&
      phase.kind !== 'free_throw');

  if (!trackBoth) {
    return (
      <DesktopOnlyGuard>
        <div className="h-[calc(100dvh-73px)] flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
          <h2 className="text-lg font-semibold">Both-team tracking required</h2>
          <p className="text-muted-foreground max-w-md">
            This live game only tracks your team&apos;s stats. Opponent quick-entry is
            paused while we finish the new courtside UI. Start a new game with{' '}
            <strong>Track both teams</strong> enabled in game setup.
          </p>
          <Button variant="outline" onClick={() => navigate(paths.home)}>
            Back to dashboard
          </Button>
        </div>
      </DesktopOnlyGuard>
    );
  }

  return (
    <DesktopOnlyGuard>
      <div className="live-entry-root">
        <LiveGameHeader
          game={currentGame}
          homeScore={homeScore}
          awayScore={awayScore}
          possessionArrowTeamId={possessionArrowTeamId}
          endPeriodLabel={periodEndLabel}
          onEndPeriod={handleEndPeriod}
          onEdit={() => setIsEditDialogOpen(true)}
          onDelete={() => setDeleteDialogOpen(true)}
          onBack={() => navigate(paths.home)}
          tournamentName={tournament?.name}
        />

        {isOpeningJumpBall && (
          <LiveOpeningJumpBallOverlay game={currentGame} onSelectWinner={commitOpeningTip} />
        )}

        {lineupOverlayOpen && (
          <LiveQuarterLineupOverlay
            game={currentGame}
            defaultHomeIds={getOnCourtIds(currentGame.homeTeamId)}
            defaultAwayIds={getOnCourtIds(currentGame.awayTeamId)}
            fouledOutIds={fouledOutIds}
            onConfirm={(homeLineup, awayLineup) => {
              commitPeriodStart(homeLineup, awayLineup);
              setLineupOverlayOpen(false);
            }}
          />
        )}

        <CourtAnchoredOverlayPortal
          anchorRef={courtFrameRef}
          open={portaledCourtOverlayOpen}
        >
          {showShotOverlay && pending && (
            <ShotOutcomeOverlay
              isThree={pending.isThree}
              isPaint={pending.isPaint}
              onMake={() => handleShotOutcome('make', pending.point)}
              onMiss={() => handleShotOutcome('miss', pending.point)}
              onBlock={() => handleShotOutcome('block', pending.point)}
              onCancel={() => dispatch({ type: 'RESET' })}
            />
          )}
          {showFtOverlay && phase.kind === 'free_throw' && (
            <FreeThrowOutcomeOverlay
              ftIndex={phase.ftIndex}
              ftTotal={phase.ftTotal}
              onMake={() => commitFreeThrow(true)}
              onMiss={() => commitFreeThrow(false)}
            />
          )}
        </CourtAnchoredOverlayPortal>

        <div className="live-entry-main">
          <div className="live-play-band">
            <div
              className="live-play-flex"
              style={
                currentGame.courtSidesFlipped
                  ? { flexDirection: 'row-reverse' }
                  : undefined
              }
            >
              <section
                className="live-play-side live-play-side--home"
                style={{ background: liveTeamTint('home', '06') }}
              >
                <OnCourtColumn
                  side="home"
                  className="h-full min-h-0 w-full"
                  players={getTeamPlayers(currentGame.homeTeamId)}
                  onCourtIds={getOnCourtIds(currentGame.homeTeamId)}
                  isOffense={homeIsOffense}
                  pickMode={columnPick?.side === 'home' || isBothRosterFoulCommitter}
                  onSelect={
                    isBothRosterFoulCommitter
                      ? (p) =>
                          dispatch({
                            type: 'PICK_FOUL_COMMITTER',
                            playerId: p.id,
                            teamId: currentGame.homeTeamId,
                          })
                      : columnPick?.side === 'home'
                        ? columnPick.onSelect
                        : undefined
                  }
                  excludeId={columnPick?.side === 'home' ? columnPick.excludeId : undefined}
                  onSubstitution={() => openSubForTeam(currentGame.homeTeamId)}
                  subDisabled={subDisabled}
                />
              </section>

              <section className="live-play-center">
                <div className="live-context-bar">
                  {relocatingShot && editEvent ? (
                    <div className="flex items-center gap-2">
                      <span className="live-font-condensed rounded px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400">
                        Tap new location on the{' '}
                        {(() => {
                          const attacksLeft = homeAttacksLeft(
                            currentGame.homeTeamId,
                            canvasOffenseTeamId,
                            !!currentGame.courtSidesFlipped
                          );
                          const teamLabel =
                            canvasOffenseTeamId === currentGame.homeTeamId
                              ? 'home'
                              : 'away';
                          return `${attacksLeft ? 'left' : 'right'} (${teamLabel})`;
                        })()}{' '}
                        half
                        {editEvent.playerId
                          ? ` — ${
                              [...currentGame.homeTeam.players, ...currentGame.awayTeam.players].find(
                                (p) => p.id === editEvent.playerId
                              )?.name ?? 'shooter'
                            }`
                          : ''}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleCancelShotRelocate}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : columnPick ? (
                    <>
                      <span
                        className="live-font-condensed rounded px-2 py-0.5 text-xs font-bold"
                        style={{
                          background: liveTeamTint(columnPick.side, '22'),
                          color: getLiveTeamColor(columnPick.side),
                        }}
                      >
                        {columnPick.hint}
                      </span>
                    </>
                  ) : contextHint ? (
                    <span className="live-font-mono text-[10px] text-muted-foreground">
                      {contextHint}
                    </span>
                  ) : null}
                </div>

                <div className="live-court-stage">
                  <div ref={courtFrameRef} className="live-court-frame relative">
                    <HorizontalFullCourtCanvas
                      className="h-full w-full"
                      game={currentGame}
                      homeTeamId={currentGame.homeTeamId}
                      offenseTeamId={canvasOffenseTeamId}
                      onPointClick={handleCourtPointForEditOrShot}
                      sessionMarkers={entryState.ctx.markers}
                      shots={currentGame.shots}
                      shotMode={showShotOverlay || relocatingShot}
                      interactive={courtAcceptsPlacement}
                    />
                    {flowCourtOverlayVisible && (
                      <div className="absolute inset-0 z-30">
                        <LiveCourtFlowOverlays
                          phase={phase}
                          pending={pending}
                          pendingReboundType={pendingReboundType}
                          turnoverPlayerId={turnoverPlayerId}
                          trackBoth={trackBoth}
                          fastbreak={fastbreak}
                          offenseTeamId={offenseTeamId}
                          defenseTeamId={defenseTeamId}
                          homeTeamId={currentGame.homeTeamId}
                          awayTeamId={currentGame.awayTeamId}
                          onFastbreakChange={setFastbreak}
                          onPendingReboundTypeChange={handlePendingReboundTypeChange}
                          onTurnoverPlayerIdChange={setTurnoverPlayerId}
                          onAndOneFoul={handleAndOneFoul}
                          dispatch={dispatch}
                          commitShot={commitShot}
                          commitRebound={commitRebound}
                          commitTurnover={commitTurnover}
                          commitFoul={commitFoul}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <LiveActionBar
                  variant="dark"
                  onUndo={() => {
                    undo();
                    clearAnd1Session();
                  }}
                  canUndo={currentGame.events.length > 0}
                  onFoul={() => dispatch({ type: 'START_FOUL' })}
                  onTurnover={() => dispatch({ type: 'START_TURNOVER' })}
                  onJumpBall={startJumpBall}
                  jumpBallDisabled={!possessionArrowTeamId}
                  disabled={actionBarDisabled}
                />
              </section>

              <section
                className="live-play-side live-play-side--away"
                style={{ background: liveTeamTint('away', '06') }}
              >
                <OnCourtColumn
                  side="away"
                  className="h-full min-h-0 w-full"
                  players={getTeamPlayers(currentGame.awayTeamId)}
                  onCourtIds={getOnCourtIds(currentGame.awayTeamId)}
                  isOffense={!homeIsOffense}
                  pickMode={columnPick?.side === 'away' || isBothRosterFoulCommitter}
                  onSelect={
                    isBothRosterFoulCommitter
                      ? (p) =>
                          dispatch({
                            type: 'PICK_FOUL_COMMITTER',
                            playerId: p.id,
                            teamId: currentGame.awayTeamId,
                          })
                      : columnPick?.side === 'away'
                        ? columnPick.onSelect
                        : undefined
                  }
                  excludeId={columnPick?.side === 'away' ? columnPick.excludeId : undefined}
                  onSubstitution={() => openSubForTeam(currentGame.awayTeamId)}
                  subDisabled={subDisabled}
                />
              </section>
            </div>
          </div>

          <LivePlayByPlayRail
            events={currentGame.events}
            homeTeam={currentGame.homeTeam}
            awayTeam={currentGame.awayTeam}
            onEventDoubleClick={(event) => {
              if (event.type === 'substitution') {
                openSubEdit(event);
                return;
              }
              if (event.type === 'jump_ball' || event.type === 'period_start' || event.type === 'period_end') {
                return;
              }
              setEditEvent(event);
              setEditDialogOpen(true);
            }}
          />

          <LiveBoxScorePanel
            game={currentGame}
            onCourtHomeIds={getOnCourtIds(currentGame.homeTeamId)}
            onCourtAwayIds={getOnCourtIds(currentGame.awayTeamId)}
            onCompleteGame={() => onGameComplete(currentGame)}
          />
        </div>

        <Dialog
          open={subOpen}
          onOpenChange={(open) => {
            if (!open && isForcedSub) return; // forced foul-out sub is non-dismissible
            setSubOpen(open);
            if (!open) {
              setEditingSubEventId(null);
              setEditSubOnCourtIds([]);
              setEditSubCheckpointFrom(null);
            }
          }}
        >
          <DialogContent
            className="max-w-lg"
            hideCloseButton={isForcedSub}
            onEscapeKeyDown={(e) => {
              if (isForcedSub) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (isForcedSub) e.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {isForcedSub && forcedFoulOutPlayer ? (
                  <span style={{ color: '#ff3838' }}>
                    Foul out — #{forcedFoulOutPlayer.number}{' '}
                    {forcedFoulOutPlayer.name} must be replaced
                  </span>
                ) : (
                  <>
                    {editingSubEventId ? 'Edit substitution' : 'Substitution'} —{' '}
                    {subTeamId === currentGame.homeTeamId
                      ? currentGame.homeTeam.abbreviation
                      : currentGame.awayTeam.abbreviation}
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Label>Out</Label>
                <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {isForcedSub && forcedFoulOutPlayer ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full justify-start"
                      disabled
                    >
                      #{forcedFoulOutPlayer.number} {forcedFoulOutPlayer.name}
                    </Button>
                  ) : (
                    getTeamPlayers(subTeamId)
                      .filter((p) => subDialogOnCourtIds.includes(p.id))
                      .map((p) => (
                        <Button
                          key={p.id}
                          variant={subOut.includes(p.id) ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => toggleSub(p.id, subOut, setSubOut)}
                        >
                          #{p.number} {p.name}
                        </Button>
                      ))
                  )}
                </div>
              </div>
              <div>
                <Label>In</Label>
                {forcedNoBench ? (
                  <div className="mt-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                    No available substitutes —{' '}
                    <span className="font-medium">
                      {subTeamId === currentGame.homeTeamId
                        ? currentGame.homeTeam.abbreviation
                        : currentGame.awayTeam.abbreviation}
                    </span>{' '}
                    continues with {Math.max(0, subDialogOnCourtIds.length - 1)}{' '}
                    players.
                  </div>
                ) : (
                  <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                    {benchPlayers(subTeamId).map((p) =>
                      isPlayerLockedOut(p.id) && !editingSubEventId ? (
                        <Button
                          key={p.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          disabled
                          style={{
                            opacity: 0.55,
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>
                            #{p.number} {p.name}
                          </span>
                          <span
                            style={{
                              color: '#ff3838',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                            }}
                          >
                            Fouled out
                          </span>
                        </Button>
                      ) : (
                        <Button
                          key={p.id}
                          variant={subIn.includes(p.id) ? 'default' : 'outline'}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => toggleSub(p.id, subIn, setSubIn)}
                        >
                          #{p.number} {p.name}
                        </Button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
            <SubstitutionClockInput
              currentClock={editSubCheckpointFrom ?? currentGame.currentGameTime}
              value={subClock}
              onChange={(v) => {
                setSubClock(v);
                setSubClockError(null);
              }}
              error={subClockError}
            />
            <Button
              className="w-full"
              disabled={
                !subOut.length ||
                !subClock.trim() ||
                (!forcedNoBench && subOut.length !== subIn.length)
              }
              onClick={() => {
                const clock = subClock.trim();
                if (editingSubEventId) {
                  const checkpointFrom = editSubCheckpointFrom ?? clock;
                  if (!isValidSubstitutionClock(checkpointFrom, clock)) {
                    setSubClockError(`Time must be at or before ${checkpointFrom}`);
                    return;
                  }
                  const idx = currentGame.events.findIndex((e) => e.id === editingSubEventId);
                  if (idx < 0) return;
                  const prev = currentGame.events[idx];
                  const next = [...currentGame.events];
                  next[idx] = {
                    ...prev,
                    gameTime: clock,
                    details: {
                      ...prev.details,
                      playersOut: [...subOut],
                      playersIn: [...subIn],
                      clockTime: clock,
                      checkpointFrom,
                    },
                  };
                  setEditingSubEventId(null);
                  setEditSubOnCourtIds([]);
                  setEditSubCheckpointFrom(null);
                  setSubOpen(false);
                  replayEvents(next);
                  return;
                }

                const result = commitSubstitution(
                  subTeamId,
                  subOut,
                  subIn,
                  clock,
                  phase.kind === 'free_throw' ? { preserveEntryPhase: true } : undefined
                );
                if (!result.ok) {
                  setSubClockError(result.error);
                  return;
                }
                if (isForcedSub) {
                  setFoulOutQueue((prev) => prev.slice(1));
                }
                setSubOpen(false);
              }}
            >
              {editingSubEventId
                ? 'Save & recalculate'
                : forcedNoBench
                  ? 'Acknowledge — continue short-handed'
                  : isForcedSub
                    ? 'Confirm replacement'
                    : 'Confirm substitution'}
            </Button>
            {isForcedSub && (
              <Button
                variant="ghost"
                className="w-full -mt-2"
                onClick={() => {
                  undo();
                  setFoulOutQueue([]);
                  setSubOpen(false);
                }}
              >
                Cancel &amp; undo foul (wrong entry)
              </Button>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Game Details</DialogTitle>
            </DialogHeader>
            <GameForm
              game={currentGame}
              tournaments={tournaments}
              lockTournament={(currentGame.events?.length ?? 0) > 0}
              onSubmit={(values) => {
                onGameUpdate(buildGameMetadataPatch(currentGame, values));
                setIsEditDialogOpen(false);
              }}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <EventEditDialog
          event={editEvent}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open && !relocatingShot) {
              setEditEvent(null);
            }
          }}
          homeTeam={currentGame.homeTeam}
          awayTeam={currentGame.awayTeam}
          events={currentGame.events}
          onSave={handleSaveEventEdit}
          onRequestRelocate={handleRequestShotRelocate}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this game?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this game and all stats recorded so far. Teams you
                created during setup for this game will be removed, including every player on those
                teams. Players you added to an existing team during setup will also be removed.
                Saved teams you picked from your roster are kept. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  onDeleteGame();
                }}
              >
                Delete game
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DesktopOnlyGuard>
  );
}
