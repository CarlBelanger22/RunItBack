import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Game, GameEvent, Player, Tournament } from '../../App';
import { GameForm } from '../forms/GameForm';
import { buildGameMetadataPatch } from '../../utils/gameMetadata';
import { useLiveGameSession } from '../../liveEntry/useLiveGameSession';
import { HorizontalFullCourtCanvas } from './HorizontalFullCourtCanvas';
import { OnCourtColumn } from './OnCourtColumn';
import { LiveGameHeader } from './LiveGameHeader';
import { LiveActionBar } from './LiveActionBar';
import { LivePlayByPlayRail } from './LivePlayByPlayRail';
import { LiveBoxScorePanel } from './LiveBoxScorePanel';
import { EventEditDialog } from './EventEditDialog';
import { ShotOutcomeOverlay } from './ShotOutcomeOverlay';
import { LiveCourtFlowOverlays } from './LiveCourtFlowOverlays';
import { LiveOpeningJumpBallOverlay } from './LiveOpeningJumpBallOverlay';
import { DesktopOnlyGuard } from './DesktopOnlyGuard';
import { paths } from '../../routing/paths';
import { getLiveTeamColor, liveTeamTint } from './liveEntryTheme';
import type { LiveEntryAction, LiveEntryPhase, PendingShot } from '../../liveEntry/liveEntryStateMachine';

interface LiveGameWorkspaceProps {
  game: Game;
  tournaments: Tournament[];
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
    const shootingTeam = reboundShootingTeamId ?? offenseTeamId;
    const defendingTeam = reboundDefendingTeamId ?? defenseTeamId;
    const teamId = pendingReboundType === 'offensive' ? shootingTeam : defendingTeam;
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
    const foulingTeamId =
      handlers.and1RecipientId && handlers.and1FoulingTeamId
        ? handlers.and1FoulingTeamId
        : defenseTeamId;

    return {
      side: teamSide(game, foulingTeamId),
      hint: 'Foul committed by',
      onSelect: (p) => {
        if (handlers.and1RecipientId) {
          commitFoul(
            p.id,
            handlers.and1RecipientId,
            phase.foulCategory ?? 'personal',
            1,
            handlers.and1RecipientId,
            handlers.and1FoulingTeamId ?? undefined
          );
          handlers.clearAnd1Session();
        } else {
          dispatch({ type: 'PICK_FOUL_COMMITTER', playerId: p.id });
        }
      },
    };
  }

  if (phase.kind === 'foul' && phase.step === 'recipient') {
    return {
      side: teamSide(game, offenseTeamId),
      hint: 'Fouled player',
      onSelect: (p) => dispatch({ type: 'PICK_FOUL_RECIPIENT', playerId: p.id }),
    };
  }

  return null;
}

export function LiveGameWorkspace({
  game,
  tournaments,
  onGameUpdate,
  onGameComplete,
  onDeleteGame,
}: LiveGameWorkspaceProps) {
  const navigate = useNavigate();
  const session = useLiveGameSession(game, onGameUpdate);
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
    undo,
    replayEvents,
    endPeriod,
    getTeamPlayers,
    getOnCourtIds,
    offenseTeamId,
    defenseTeamId,
    possessionArrowTeamId,
    ftSession,
  } = session;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [fastbreak, setFastbreak] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subOut, setSubOut] = useState<string[]>([]);
  const [subIn, setSubIn] = useState<string[]>([]);
  const [subTeamId, setSubTeamId] = useState<string>(game.homeTeamId);
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
      commitShot(shotPayload);
      setFastbreak(false);
      dispatch({ type: 'FOUL_CATEGORY', category: 'personal' });
    },
    [commitShot, defenseTeamId, dispatch]
  );

  const [pendingReboundType, setPendingReboundType] = useState<string | null>(null);
  const [turnoverPlayerId, setTurnoverPlayerId] = useState<string | undefined>();
  const [editEvent, setEditEvent] = useState<GameEvent | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const homeScore = currentGame.teamStats.home.total_points;
  const awayScore = currentGame.teamStats.away.total_points;
  const phase = entryState.phase;
  const pending = entryState.ctx.pendingShot;
  const trackBoth = currentGame.trackBothTeams;

  useEffect(() => {
    if (phase.kind === 'idle') {
      clearAnd1Session();
    }
  }, [phase.kind, clearAnd1Session]);

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

  const contextHint = useMemo(() => {
    if (columnPick) return null;
    if (showShotOverlay) return 'Tap court — make / miss / block';
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
    if (phase.kind === 'foul' && phase.step === 'category') return 'Choose foul category on court overlay';
    if (phase.kind === 'foul' && phase.step === 'committer') return 'Select foul committer on roster';
    if (phase.kind === 'foul' && phase.step === 'recipient') return 'Select fouled player on roster';
    if (phase.kind === 'foul' && phase.step === 'ft_count') return 'Choose free throws on court overlay';
    if (phase.kind === 'free_throw') return 'Free throw — make / miss on court overlay';
    return '← Tap court to log a shot';
  }, [columnPick, showShotOverlay, phase, pendingReboundType, turnoverPlayerId]);

  const openSubForTeam = (teamId: string) => {
    setSubTeamId(teamId);
    setSubOut([]);
    setSubIn([]);
    setSubOpen(true);
  };

  const benchPlayers = (teamId: string) => {
    const all = getTeamPlayers(teamId);
    const onCourt = new Set(getOnCourtIds(teamId));
    return all.filter((p) => !onCourt.has(p.id));
  };

  const toggleSub = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSaveEventEdit = (updated: GameEvent) => {
    const idx = currentGame.events.findIndex((e) => e.id === updated.id);
    if (idx < 0) return;
    const next = [...currentGame.events];
    next[idx] = updated;
    replayEvents(next);
  };

  const homeIsOffense = offenseTeamId === currentGame.homeTeamId;
  const tournament = tournaments.find((t) => t.id === currentGame.tournamentId);
  const isOpeningJumpBall = phase.kind === 'jumpball' && phase.step === 'opening';
  const actionBarDisabled =
    isOpeningJumpBall || (phase.kind !== 'idle' && phase.kind !== 'shot');

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
          onEndPeriod={endPeriod}
          onEdit={() => setIsEditDialogOpen(true)}
          onDelete={() => setDeleteDialogOpen(true)}
          onBack={() => navigate(paths.home)}
          tournamentName={tournament?.name}
        />

        {isOpeningJumpBall && (
          <LiveOpeningJumpBallOverlay game={currentGame} onSelectWinner={commitOpeningTip} />
        )}

        <div className="live-entry-main">
          <div className="live-play-band">
            <div className="live-play-flex">
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
                  pickMode={columnPick?.side === 'home'}
                  onSelect={columnPick?.side === 'home' ? columnPick.onSelect : undefined}
                  excludeId={columnPick?.side === 'home' ? columnPick.excludeId : undefined}
                  onSubstitution={() => openSubForTeam(currentGame.homeTeamId)}
                  subDisabled={actionBarDisabled}
                />
              </section>

              <section className="live-play-center">
                <div className="live-context-bar">
                  {columnPick ? (
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
                  <div className="live-court-frame">
                    <HorizontalFullCourtCanvas
                      className="h-full w-full"
                      game={currentGame}
                      homeTeamId={currentGame.homeTeamId}
                      offenseTeamId={offenseTeamId}
                      onPointClick={handleCourtPoint}
                      sessionMarkers={entryState.ctx.markers}
                      shots={currentGame.shots}
                      shotMode={showShotOverlay}
                      interactive={
                        !isOpeningJumpBall &&
                        (phase.kind === 'idle' ||
                          (phase.kind === 'shot' && phase.step === 'await_outcome'))
                      }
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
                      <LiveCourtFlowOverlays
                        phase={phase}
                        pending={pending}
                        pendingReboundType={pendingReboundType}
                        turnoverPlayerId={turnoverPlayerId}
                        trackBoth={trackBoth}
                        fastbreak={fastbreak}
                        ftSession={ftSession}
                        onFastbreakChange={setFastbreak}
                        onPendingReboundTypeChange={setPendingReboundType}
                        onTurnoverPlayerIdChange={setTurnoverPlayerId}
                        onAndOneFoul={handleAndOneFoul}
                        dispatch={dispatch}
                        commitShot={commitShot}
                        commitRebound={commitRebound}
                        commitTurnover={commitTurnover}
                        commitFoul={commitFoul}
                        commitFreeThrow={commitFreeThrow}
                      />
                    </HorizontalFullCourtCanvas>
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
                  pickMode={columnPick?.side === 'away'}
                  onSelect={columnPick?.side === 'away' ? columnPick.onSelect : undefined}
                  excludeId={columnPick?.side === 'away' ? columnPick.excludeId : undefined}
                  onSubstitution={() => openSubForTeam(currentGame.awayTeamId)}
                  subDisabled={actionBarDisabled}
                />
              </section>
            </div>
          </div>

          <LivePlayByPlayRail
            events={currentGame.events}
            homeTeam={currentGame.homeTeam}
            awayTeam={currentGame.awayTeam}
            onEventDoubleClick={(event) => {
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

        <Dialog open={subOpen} onOpenChange={setSubOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Substitution —{' '}
                {subTeamId === currentGame.homeTeamId
                  ? currentGame.homeTeam.abbreviation
                  : currentGame.awayTeam.abbreviation}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Label>Out</Label>
                <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {getTeamPlayers(subTeamId)
                    .filter((p) => getOnCourtIds(subTeamId).includes(p.id))
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
                    ))}
                </div>
              </div>
              <div>
                <Label>In</Label>
                <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                  {benchPlayers(subTeamId).map((p) => (
                    <Button
                      key={p.id}
                      variant={subIn.includes(p.id) ? 'default' : 'outline'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => toggleSub(p.id, subIn, setSubIn)}
                    >
                      #{p.number} {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!subOut.length || subOut.length !== subIn.length}
              onClick={() => {
                commitSubstitution(subTeamId, subOut, subIn);
                setSubOpen(false);
              }}
            >
              Confirm substitution
            </Button>
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
          onOpenChange={setEditDialogOpen}
          homeTeam={currentGame.homeTeam}
          awayTeam={currentGame.awayTeam}
          onSave={handleSaveEventEdit}
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
