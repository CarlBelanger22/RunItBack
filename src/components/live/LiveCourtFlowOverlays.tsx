import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import type { LiveEntryAction, LiveEntryPhase, PendingShot } from '../../liveEntry/liveEntryStateMachine';
import type { FoulCommitParams } from '../../liveEntry/foulFlow';
import { ftCountOptionsForCategory } from '../../liveEntry/foulFlow';
import { LiveCourtOverlayShell, overlayClick } from './LiveCourtOverlayShell';
import { LiveCourtTipPanel } from './LiveCourtTipPanel';

interface LiveCourtFlowOverlaysProps {
  phase: LiveEntryPhase;
  pending: PendingShot | null;
  pendingReboundType: string | null;
  turnoverPlayerId: string | undefined;
  trackBoth: boolean;
  fastbreak: boolean;
  offenseTeamId: string;
  defenseTeamId: string;
  homeTeamId: string;
  awayTeamId: string;
  reboundShootingTeamId: string | null;
  reboundDefendingTeamId: string | null;
  possessionArrowTeamId: string | null;
  onFastbreakChange: (value: boolean) => void;
  onPendingReboundTypeChange: (value: string | null) => void;
  onTurnoverPlayerIdChange: (value: string | undefined) => void;
  onAndOneFoul: (shotPayload: PendingShot) => void;
  dispatch: React.Dispatch<LiveEntryAction>;
  commitShot: (pending: PendingShot, and1?: boolean) => void;
  commitRebound: (reboundType: string, playerId?: string) => void;
  commitTurnover: (
    playerId: string | undefined,
    isTeam: boolean,
    stolenBy?: string | null
  ) => void;
  commitFoul: (params: FoulCommitParams) => void;
  commitJumpBallWithStats: (
    turnoverPlayerId?: string,
    stealPlayerId?: string
  ) => void;
  /** Opp make and-1: picking home fouler — do not show Opp foul overlay. */
  and1OppTeamFt?: boolean;
}

export function LiveCourtFlowOverlays({
  phase,
  pending,
  pendingReboundType,
  turnoverPlayerId,
  trackBoth,
  fastbreak,
  offenseTeamId,
  defenseTeamId,
  homeTeamId,
  awayTeamId,
  reboundShootingTeamId,
  reboundDefendingTeamId,
  possessionArrowTeamId,
  onFastbreakChange,
  onPendingReboundTypeChange,
  onTurnoverPlayerIdChange,
  onAndOneFoul,
  dispatch,
  commitShot,
  commitRebound,
  commitTurnover,
  commitFoul,
  commitJumpBallWithStats,
  and1OppTeamFt = false,
}: LiveCourtFlowOverlaysProps) {
  if (phase.kind === 'shot' && phase.step === 'fastbreak' && pending) {
    const shotPayload: PendingShot = {
      ...pending,
      isTransition: fastbreak,
      assistId: pending.assistId ?? null,
    };

    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">
              {pending.isThree ? '3PT' : '2PT'}
              {pending.isPaint ? ' · Paint' : ''}
            </CardTitle>
            <p className="text-center text-xs text-muted-foreground">Confirm make</p>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <Label>Fastbreak?</Label>
              <Switch checked={fastbreak} onCheckedChange={onFastbreakChange} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={overlayClick(() => {
                commitShot(shotPayload);
                onFastbreakChange(false);
              })}
              >
                Commit
              </Button>
              <Button
                variant="secondary"
                onClick={overlayClick(() => {
                  onAndOneFoul(shotPayload);
                })}
              >
                + Foul
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={overlayClick(() => {
                dispatch({ type: 'RESET' });
                onFastbreakChange(false);
              })}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'shot' && phase.step === 'pick_assist' && pending) {
    return (
      <LiveCourtOverlayShell>
        <LiveCourtTipPanel
          title="Assist"
          description="Select assister on roster, or continue without"
        >
          <Button
            variant="outline"
            className="w-full"
            onClick={overlayClick(() => dispatch({ type: 'PICK_ASSIST', playerId: null }))}
          >
            No assist
          </Button>
        </LiveCourtTipPanel>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'shot' && phase.step === 'pick_blocker' && !trackBoth && !pending?.teamOnly) {
    return (
      <LiveCourtOverlayShell>
        <LiveCourtTipPanel
          title="Blocked shot"
          description="Opponent blocked — no individual credit"
        >
          <Button
            className="w-full"
            onClick={overlayClick(() => dispatch({ type: 'SKIP_BLOCKER' }))}
          >
            Continue — pick shooter
          </Button>
        </LiveCourtTipPanel>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'shot' && phase.step === 'pick_blocker' && !trackBoth && pending?.teamOnly) {
    return (
      <LiveCourtOverlayShell>
        <LiveCourtTipPanel
          title="Blocked shot"
          description="Select home blocker on roster"
        />
      </LiveCourtOverlayShell>
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

    if (pendingReboundType === 'offensive' || pendingReboundType === 'defensive') {
      return (
        <LiveCourtOverlayShell>
          <LiveCourtTipPanel
            tone="orange"
            title={
              pendingReboundType === 'offensive' ? 'Offensive rebound' : 'Defensive rebound'
            }
            description="Select player on roster"
          >
            <Button
              variant="ghost"
              className="w-full"
              onClick={overlayClick(() => onPendingReboundTypeChange(null))}
            >
              Back to rebound type
            </Button>
          </LiveCourtTipPanel>
        </LiveCourtOverlayShell>
      );
    }

    // Single-team: Opp is a unit — label buttons by side; Opp rebounds are one-click team.
    if (!trackBoth) {
      const shootingIsHome = reboundShootingTeamId === homeTeamId;
      const shootingIsOpp = reboundShootingTeamId === awayTeamId;
      return (
        <LiveCourtOverlayShell>
          <Card className="border-orange-500/50 shadow-xl w-[min(90%,320px)]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-center text-base">Rebound</CardTitle>
              <p className="text-center text-xs text-muted-foreground">
                {shootingIsOpp
                  ? 'Opp missed — home DRB or Opp ORB'
                  : shootingIsHome
                    ? 'Your miss — home ORB or Opp DRB'
                    : 'Who got the rebound?'}
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pb-4">
              {shootingIsHome ? (
                <>
                  <Button onClick={overlayClick(() => onPendingReboundTypeChange('offensive'))}>
                    Home ORB
                  </Button>
                  <Button
                    variant="outline"
                    onClick={overlayClick(() => commitRebound('team_offensive'))}
                  >
                    Home Team ORB
                  </Button>
                  <Button
                    className="col-span-2"
                    variant="secondary"
                    onClick={overlayClick(() => commitRebound('team_defensive'))}
                  >
                    Opp DRB
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={overlayClick(() => onPendingReboundTypeChange('defensive'))}>
                    Home DRB
                  </Button>
                  <Button
                    variant="outline"
                    onClick={overlayClick(() => commitRebound('team_defensive'))}
                  >
                    Home Team DRB
                  </Button>
                  <Button
                    className="col-span-2"
                    variant="secondary"
                    onClick={overlayClick(() => commitRebound('team_offensive'))}
                  >
                    Opp ORB
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                className="col-span-2"
                onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
              >
                Skip
              </Button>
            </CardContent>
          </Card>
        </LiveCourtOverlayShell>
      );
    }

    return (
      <LiveCourtOverlayShell>
        <Card className="border-orange-500/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Rebound type</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pb-4">
            <Button onClick={overlayClick(() => onPendingReboundTypeChange('offensive'))}>ORB</Button>
            <Button onClick={overlayClick(() => onPendingReboundTypeChange('defensive'))}>DRB</Button>
            <Button variant="outline" onClick={overlayClick(() => commitRebound('team_offensive'))}>
              Team ORB
            </Button>
            <Button variant="outline" onClick={overlayClick(() => commitRebound('team_defensive'))}>
              Team DRB
            </Button>
            <Button
              variant="ghost"
              className="col-span-2"
              onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
            >
              Skip
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'turnover' && phase.step === 'entity') {
    const oppOffense = !trackBoth && offenseTeamId === awayTeamId;
    const homeOffenseSingle = !trackBoth && offenseTeamId === homeTeamId;
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Turnover</CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              {oppOffense
                ? 'Opponent turnover'
                : homeOffenseSingle
                  ? 'Select player on roster, or team TO'
                  : 'Select player on roster, or choose below'}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={overlayClick(() => commitTurnover(undefined, true))}
            >
              {oppOffense ? 'Opponent turnover' : 'Team turnover'}
            </Button>
            {homeOffenseSingle ? null : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={overlayClick(() => dispatch({ type: 'TURNOVER_STEAL', hasSteal: true }))}
              >
                {oppOffense ? 'Opp TO + home steal' : 'Turnover + steal'}
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'turnover' && phase.step === 'pick_stealer' && !trackBoth && offenseTeamId === awayTeamId) {
    return (
      <LiveCourtOverlayShell>
        <LiveCourtTipPanel
          title="Steal"
          description="Select home stealer on roster"
        />
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'foul' && phase.step === 'entity') {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[272px] max-w-[95%] gap-0">
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-center text-sm font-medium whitespace-nowrap">
              Foul — who committed?
            </p>
            <Button
              className="flex w-full"
              onClick={overlayClick(() => dispatch({ type: 'FOUL_ENTITY', entity: 'player' }))}
            >
              Player
            </Button>
            <Button
              className="flex w-full"
              onClick={overlayClick(() => dispatch({ type: 'FOUL_ENTITY', entity: 'team' }))}
            >
              Team
            </Button>
            <Button
              variant="outline"
              className="flex w-full"
              onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'foul' && phase.step === 'category') {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Foul category</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pb-4">
            <Button
              className="col-span-2"
              onClick={overlayClick(() => dispatch({ type: 'FOUL_CATEGORY', category: 'personal' }))}
            >
              Personal
            </Button>
            {phase.foulEntity === 'player' ? (
              <>
                <Button
                  onClick={overlayClick(() =>
                    dispatch({ type: 'FOUL_CATEGORY', category: 'offensive' })
                  )}
                >
                  Offensive
                </Button>
                <Button
                  onClick={overlayClick(() => dispatch({ type: 'FOUL_CATEGORY', category: 'technical' }))}
                >
                  Technical
                </Button>
              </>
            ) : (
              <div className="col-span-2 flex justify-center">
                <Button
                  className="w-[calc(50%-4px)]"
                  onClick={overlayClick(() => dispatch({ type: 'FOUL_CATEGORY', category: 'technical' }))}
                >
                  Technical
                </Button>
              </div>
            )}
            <Button
              onClick={overlayClick(() =>
                dispatch({ type: 'FOUL_CATEGORY', category: 'unsportsmanlike' })
              )}
            >
              Unsportsmanlike
            </Button>
            <Button
              onClick={overlayClick(() => dispatch({ type: 'FOUL_CATEGORY', category: 'double' }))}
            >
              Double foul
            </Button>
            <Button variant="outline" className="col-span-2" onClick={overlayClick(() => dispatch({ type: 'RESET' }))}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (
    phase.kind === 'foul' &&
    phase.step === 'committer' &&
    phase.foulEntity === 'team' &&
    phase.foulCategory === 'personal'
  ) {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Team foul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            <Button
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'PICK_FOUL_TEAM', teamId: defenseTeamId }))}
            >
              Record team foul (defense)
            </Button>
            <Button variant="outline" className="w-full" onClick={overlayClick(() => dispatch({ type: 'RESET' }))}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'foul' && phase.step === 'committer' && phase.foulCategory === 'technical') {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,360px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Technical foul</CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              {trackBoth
                ? 'Select player on either roster, or coach below'
                : 'Select home player on roster, or coach below'}
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pb-4">
            <Button
              variant="outline"
              onClick={overlayClick(() => dispatch({ type: 'PICK_FOUL_COACH', teamId: homeTeamId }))}
            >
              Home coach
            </Button>
            <Button
              variant="outline"
              onClick={overlayClick(() => dispatch({ type: 'PICK_FOUL_COACH', teamId: awayTeamId }))}
            >
              {trackBoth ? 'Away coach' : 'Opp coach'}
            </Button>
            {!trackBoth ? (
              <Button
                className="col-span-2"
                onClick={overlayClick(() =>
                  dispatch({ type: 'PICK_FOUL_COMMITTER', teamId: awayTeamId })
                )}
              >
                Opponent technical
              </Button>
            ) : null}
            <Button variant="ghost" className="col-span-2" onClick={overlayClick(() => dispatch({ type: 'RESET' }))}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  // Single-team: Opp unit as foul committer (personal / unsportsmanlike / offensive / and-1 on home make).
  // Skip when Opp-make and-1 is active (home fouler via on-court column).
  if (
    phase.kind === 'foul' &&
    phase.step === 'committer' &&
    !trackBoth &&
    !and1OppTeamFt &&
    phase.foulCategory !== 'technical' &&
    phase.foulEntity !== 'team'
  ) {
    const isOffensive = phase.foulCategory === 'offensive';
    const foulingIsOpp =
      isOffensive
        ? offenseTeamId === awayTeamId
        : defenseTeamId === awayTeamId;
    if (foulingIsOpp) {
      return (
        <LiveCourtOverlayShell>
          <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-center text-base">
                {isOffensive ? 'Opponent offensive foul' : 'Opponent foul'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <Button
                className="w-full"
                onClick={overlayClick(() =>
                  dispatch({
                    type: 'PICK_FOUL_COMMITTER',
                    teamId: awayTeamId,
                  })
                )}
              >
                Confirm Opponent
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </LiveCourtOverlayShell>
      );
    }
  }

  if (phase.kind === 'foul' && phase.step === 'ft_count' && phase.foulCategory === 'double') {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Double foul</CardTitle>
            <p className="text-center text-xs text-muted-foreground">No free throws — possession unchanged</p>
          </CardHeader>
          <CardContent className="pb-4">
            <Button
              className="w-full"
              onClick={overlayClick(() =>
                commitFoul({
                  foulingTeamId: phase.committerTeamId ?? offenseTeamId,
                  foulCategory: 'double',
                  foulEntity: 'player',
                  committerId: phase.committerId,
                  doublePartnerPlayerId: phase.doublePartnerId,
                  doublePartnerTeamId: defenseTeamId,
                  ftCount: 0,
                  retainPossession: false,
                  offendedTeamId: offenseTeamId,
                })
              )}
            >
              Confirm double foul
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'foul' && phase.step === 'ft_count') {
    const category = phase.foulCategory ?? 'personal';
    const ftOptions =
      phase.foulEntity === 'team' ? [0] : ftCountOptionsForCategory(category);
    const foulingTeamId = phase.committerTeamId ?? defenseTeamId;
    const offendedTeamId = phase.committerTeamId
      ? phase.committerTeamId === homeTeamId
        ? awayTeamId
        : homeTeamId
      : phase.offendedTeamId ?? offenseTeamId;
    const oppShootsFts = !trackBoth && offendedTeamId === awayTeamId;
    const homeShootsFts = offendedTeamId === homeTeamId;

    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Free throws</CardTitle>
            {oppShootsFts ? (
              <p className="text-center text-xs text-muted-foreground">Opponent team FTs</p>
            ) : null}
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap justify-center pb-4">
            {ftOptions.map((n) => (
              <Button
                key={n}
                variant="outline"
                onClick={overlayClick(() => {
                  const shooterId =
                    n > 0 && homeShootsFts ? phase.recipientId : undefined;
                  commitFoul({
                    foulingTeamId,
                    foulCategory: category,
                    foulEntity: phase.foulEntity ?? 'player',
                    committerId: phase.committerId,
                    recipientId: phase.recipientId,
                    isCoachFoul: phase.isCoachFoul,
                    ftCount: n,
                    ftShooterId: shooterId,
                    ftShootingTeamId: n > 0 && oppShootsFts ? awayTeamId : undefined,
                    retainPossession: phase.retainPossession ?? false,
                    offendedTeamId,
                  });
                })}
                disabled={n > 0 && homeShootsFts && !phase.recipientId}
              >
                {n} FT{n !== 1 ? 's' : ''}
              </Button>
            ))}
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  // Single-team jump ball: Opp unit as turnover or recovering side.
  if (phase.kind === 'jumpball' && phase.step === 'pick_to' && !trackBoth && offenseTeamId === awayTeamId) {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Jump ball</CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              Opponent loses possession (team turnover)
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            <Button
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'JUMPBALL_PICK_TO' }))}
            >
              Opp turnover — pick home stealer
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'jumpball' && phase.step === 'pick_steal' && !trackBoth) {
    const arrowTeamId = possessionArrowTeamId ?? defenseTeamId;
    if (arrowTeamId === awayTeamId) {
      return (
        <LiveCourtOverlayShell>
          <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-center text-base">Jump ball</CardTitle>
              <p className="text-center text-xs text-muted-foreground">
                Arrow awards possession to Opponent
              </p>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <Button
                className="w-full"
                onClick={overlayClick(() =>
                  commitJumpBallWithStats(phase.turnoverPlayerId, undefined)
                )}
              >
                Confirm — Opp ball
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={overlayClick(() => dispatch({ type: 'RESET' }))}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </LiveCourtOverlayShell>
      );
    }
    // Opp TO already confirmed — hint while picking home stealer
    if (offenseTeamId === awayTeamId && phase.turnoverPlayerId == null) {
      return (
        <LiveCourtOverlayShell>
          <LiveCourtTipPanel
            title="Jump ball — steal"
            description="Select home stealer on roster"
          />
        </LiveCourtOverlayShell>
      );
    }
  }

  return null;
}
