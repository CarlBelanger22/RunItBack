import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
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
import { DesktopOnlyGuard } from './DesktopOnlyGuard';
import { paths } from '../../routing/paths';
import { getLiveTeamColor, liveTeamTint } from './liveEntryTheme';
import type { LiveEntryPhase, PendingShot } from '../../liveEntry/liveEntryStateMachine';

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
  pending: PendingShot | null,
  pendingReboundType: string | null,
  turnoverPlayerId: string | undefined,
  trackBoth: boolean,
  handlers: {
    dispatch: ReturnType<typeof useLiveGameSession>['dispatch'];
    commitShot: ReturnType<typeof useLiveGameSession>['commitShot'];
    commitRebound: ReturnType<typeof useLiveGameSession>['commitRebound'];
    commitTurnover: ReturnType<typeof useLiveGameSession>['commitTurnover'];
    commitFoul: ReturnType<typeof useLiveGameSession>['commitFoul'];
    setPendingReboundType: (v: string | null) => void;
    setTurnoverPlayerId: (v: string | undefined) => void;
    and1RecipientId: string | null;
    setAnd1RecipientId: (v: string | null) => void;
  }
): ColumnPick | null {
  const { dispatch, commitShot, commitRebound, commitTurnover, commitFoul } = handlers;

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
      hint: 'Select assister (optional — use panel for no assist)',
      excludeId: pending.shooterId,
      onSelect: (p) => dispatch({ type: 'PICK_ASSIST', playerId: p.id }),
    };
  }

  if (
    phase.kind === 'rebound' &&
    pendingReboundType &&
    (pendingReboundType === 'offensive' || pendingReboundType === 'defensive')
  ) {
    const teamId = pendingReboundType === 'offensive' ? offenseTeamId : defenseTeamId;
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
      hint: 'Select turnover player (or use panel for team TO)',
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

  if (phase.kind === 'foul' && phase.step === 'committer') {
    return {
      side: teamSide(game, defenseTeamId),
      hint: 'Foul committed by',
      onSelect: (p) => {
        if (handlers.and1RecipientId) {
          commitFoul(
            p.id,
            handlers.and1RecipientId,
            phase.foulCategory ?? 'personal',
            1,
            handlers.and1RecipientId
          );
          handlers.setAnd1RecipientId(null);
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
  } = session;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [fastbreak, setFastbreak] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subOut, setSubOut] = useState<string[]>([]);
  const [subIn, setSubIn] = useState<string[]>([]);
  const [subTeamId, setSubTeamId] = useState<string>(game.homeTeamId);
  const [and1RecipientId, setAnd1RecipientId] = useState<string | null>(null);
  const [pendingReboundType, setPendingReboundType] = useState<string | null>(null);
  const [turnoverPlayerId, setTurnoverPlayerId] = useState<string | undefined>();
  const [editEvent, setEditEvent] = useState<GameEvent | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const homeScore = currentGame.teamStats.home.total_points;
  const awayScore = currentGame.teamStats.away.total_points;
  const phase = entryState.phase;
  const pending = entryState.ctx.pendingShot;
  const trackBoth = currentGame.trackBothTeams;

  const columnPick = useMemo(
    () =>
      resolveColumnPick(
        currentGame,
        phase,
        offenseTeamId,
        defenseTeamId,
        pending,
        pendingReboundType,
        turnoverPlayerId,
        trackBoth,
        {
          dispatch,
          commitShot,
          commitRebound,
          commitTurnover,
          commitFoul,
          setPendingReboundType,
          setTurnoverPlayerId,
          and1RecipientId,
          setAnd1RecipientId,
        }
      ),
    [
      currentGame,
      phase,
      offenseTeamId,
      defenseTeamId,
      pending,
      pendingReboundType,
      turnoverPlayerId,
      trackBoth,
      dispatch,
      commitShot,
      commitRebound,
      commitTurnover,
      commitFoul,
      and1RecipientId,
    ]
  );

  const showShotOverlay =
    phase.kind === 'shot' && phase.step === 'await_outcome' && pending;

  const renderFlowPanel = () => {
    if (columnPick) {
      return (
        <p className="text-center text-sm text-primary font-medium py-1">
          {columnPick.hint}
        </p>
      );
    }

    if (phase.kind === 'shot' && phase.step === 'pick_blocker' && !trackBoth) {
      return (
        <Card className="border-primary/50 max-w-md mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Blocked shot</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => dispatch({ type: 'SKIP_BLOCKER' })}>
              Opponent block (no individual)
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'shot' && phase.step === 'pick_assist' && pending) {
      return (
        <Card className="border-primary/50 max-w-md mx-auto">
          <CardContent className="pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => dispatch({ type: 'PICK_ASSIST', playerId: null })}
            >
              No assist
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'shot' && phase.step === 'fastbreak' && pending) {
      const shotPayload = {
        ...pending,
        isTransition: fastbreak,
        assistId: pending.assistId ?? null,
      };
      return (
        <Card className="border-primary/50 max-w-md mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Confirm make</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fastbreak?</Label>
              <Switch checked={fastbreak} onCheckedChange={setFastbreak} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  commitShot(shotPayload);
                  setFastbreak(false);
                }}
              >
                Commit
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (pending.shooterId) setAnd1RecipientId(pending.shooterId);
                  commitShot(shotPayload);
                  setFastbreak(false);
                  dispatch({ type: 'FOUL_CATEGORY', category: 'personal' });
                }}
              >
                + Foul
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'rebound' && phase.step === 'pick_type') {
      if (
        pendingReboundType &&
        pendingReboundType !== 'offensive' &&
        pendingReboundType !== 'defensive'
      ) {
        return null;
      }
      if (!pendingReboundType) {
        return (
          <Card className="border-orange-500/50 max-w-md mx-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rebound type</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button onClick={() => setPendingReboundType('offensive')}>ORB</Button>
              <Button onClick={() => setPendingReboundType('defensive')}>DRB</Button>
              <Button variant="outline" onClick={() => commitRebound('team_offensive')}>
                Team ORB
              </Button>
              <Button variant="outline" onClick={() => commitRebound('team_defensive')}>
                Team DRB
              </Button>
              <Button variant="ghost" className="col-span-2" onClick={() => dispatch({ type: 'RESET' })}>
                Skip
              </Button>
            </CardContent>
          </Card>
        );
      }
      return (
        <Button variant="ghost" size="sm" className="mx-auto block" onClick={() => setPendingReboundType(null)}>
          Back to rebound type
        </Button>
      );
    }

    if (phase.kind === 'turnover' && phase.step === 'entity') {
      return (
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-4 space-y-2">
            <Button variant="outline" className="w-full" onClick={() => commitTurnover(undefined, true)}>
              Team turnover
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => dispatch({ type: 'TURNOVER_STEAL', hasSteal: true })}
            >
              Turnover + steal
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => dispatch({ type: 'RESET' })}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'turnover' && phase.step === 'pick_stealer' && turnoverPlayerId && !trackBoth) {
      return (
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-4">
            <Button
              className="w-full"
              onClick={() => {
                commitTurnover(turnoverPlayerId, false, 'team');
                setTurnoverPlayerId(undefined);
              }}
            >
              Team steal
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'foul' && phase.step === 'category') {
      return (
        <Card className="max-w-md mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Foul category</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button onClick={() => dispatch({ type: 'FOUL_CATEGORY', category: 'personal' })}>Personal</Button>
            <Button onClick={() => dispatch({ type: 'FOUL_CATEGORY', category: 'technical' })}>Technical</Button>
            <Button onClick={() => dispatch({ type: 'FOUL_CATEGORY', category: 'unsportsmanlike' })}>
              Unsportsmanlike
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: 'RESET' })}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'foul' && phase.step === 'ft_count' && phase.recipientId) {
      return (
        <Card className="max-w-md mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Free throws</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap justify-center">
            {[0, 1, 2, 3].map((n) => (
              <Button
                key={n}
                variant="outline"
                onClick={() => {
                  commitFoul(
                    phase.committerId!,
                    phase.recipientId,
                    phase.foulCategory ?? 'personal',
                    n,
                    n > 0 ? phase.recipientId : undefined
                  );
                }}
              >
                {n} FT{n !== 1 ? 's' : ''}
              </Button>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (phase.kind === 'free_throw' && ftSession) {
      return (
        <Card className="border-primary/50 max-w-xs mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              FT {ftSession.ftIndex} of {ftSession.ftTotal}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => commitFreeThrow(true)}>
              Make
            </Button>
            <Button variant="destructive" onClick={() => commitFreeThrow(false)}>
              Miss
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  const openSub = () => {
    setSubTeamId(offenseTeamId);
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
  const flowPanel = renderFlowPanel();
  const tournament = tournaments.find((t) => t.id === currentGame.tournamentId);
  const actionBarDisabled = phase.kind !== 'idle' && phase.kind !== 'shot';

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
          offenseTeamId={offenseTeamId}
          clockRunning={entryState.ctx.clockRunning}
          onToggleClock={toggleClock}
          onUndo={undo}
          onEndPeriod={endPeriod}
          onEdit={() => setIsEditDialogOpen(true)}
          onDelete={() => setDeleteDialogOpen(true)}
          canUndo={currentGame.events.length > 0}
          onBack={() => navigate(paths.home)}
          tournamentName={tournament?.name}
        />

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
                  ) : showShotOverlay ? (
                    <span className="live-font-mono text-[10px] text-muted-foreground">
                      Tap court — make / miss / block
                    </span>
                  ) : (
                    <span className="live-font-mono text-[10px] text-muted-foreground">
                      ← Select a player to begin logging
                    </span>
                  )}
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
                        phase.kind === 'idle' ||
                        (phase.kind === 'shot' && phase.step === 'await_outcome')
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
                    </HorizontalFullCourtCanvas>
                  </div>
                </div>

                {flowPanel && !columnPick && (
                  <div className="flex shrink-0 justify-center px-3 pb-1">
                    <div className="max-w-md w-full">{flowPanel}</div>
                  </div>
                )}

                <LiveActionBar
                  variant="dark"
                  onFoul={() => dispatch({ type: 'START_FOUL' })}
                  onTurnover={() => dispatch({ type: 'START_TURNOVER' })}
                  onSubstitution={openSub}
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
              <DialogTitle>Substitution</DialogTitle>
            </DialogHeader>
            <Tabs value={subTeamId} onValueChange={setSubTeamId}>
              <TabsList className="w-full">
                <TabsTrigger value={currentGame.homeTeamId} className="flex-1">
                  {currentGame.homeTeam.abbreviation}
                </TabsTrigger>
                <TabsTrigger value={currentGame.awayTeamId} className="flex-1">
                  {currentGame.awayTeam.abbreviation}
                </TabsTrigger>
              </TabsList>
            </Tabs>
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
