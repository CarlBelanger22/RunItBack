import React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import type { LiveEntryAction, LiveEntryPhase, PendingShot } from '../../liveEntry/liveEntryStateMachine';
import { LiveCourtOverlayShell, overlayClick } from './LiveCourtOverlayShell';

interface LiveCourtFlowOverlaysProps {
  phase: LiveEntryPhase;
  pending: PendingShot | null;
  pendingReboundType: string | null;
  turnoverPlayerId: string | undefined;
  trackBoth: boolean;
  fastbreak: boolean;
  ftSession: { playerId: string; ftTotal: number; ftIndex: number } | null;
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
  commitFoul: (
    committerId: string,
    recipientId: string | undefined,
    foulCategory: string,
    ftCount: number,
    ftShooterId?: string,
    foulingTeamId?: string
  ) => void;
  commitFreeThrow: (made: boolean) => void;
}

export function LiveCourtFlowOverlays({
  phase,
  pending,
  pendingReboundType,
  turnoverPlayerId,
  trackBoth,
  fastbreak,
  ftSession,
  onFastbreakChange,
  onPendingReboundTypeChange,
  onTurnoverPlayerIdChange,
  onAndOneFoul,
  dispatch,
  commitShot,
  commitRebound,
  commitTurnover,
  commitFoul,
  commitFreeThrow,
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
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Assist</CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              Select assister on roster, or continue without
            </p>
          </CardHeader>
          <CardContent className="pb-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'PICK_ASSIST', playerId: null }))}
            >
              No assist
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'shot' && phase.step === 'pick_blocker' && !trackBoth) {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Blocked shot</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <Button
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'SKIP_BLOCKER' }))}
            >
              Opponent block (no individual)
            </Button>
          </CardContent>
        </Card>
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
          <Card className="border-orange-500/50 shadow-xl w-[min(90%,320px)]">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-center text-base">
                {pendingReboundType === 'offensive' ? 'Offensive rebound' : 'Defensive rebound'}
              </CardTitle>
              <p className="text-center text-xs text-muted-foreground">Select player on roster</p>
            </CardHeader>
            <CardContent className="pb-4">
              <Button
                variant="ghost"
                className="w-full"
                onClick={overlayClick(() => onPendingReboundTypeChange(null))}
              >
                Back to rebound type
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
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Turnover</CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              Select player on roster, or choose below
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={overlayClick(() => commitTurnover(undefined, true))}
            >
              Team turnover
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={overlayClick(() => dispatch({ type: 'TURNOVER_STEAL', hasSteal: true }))}
            >
              Turnover + steal
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

  if (phase.kind === 'turnover' && phase.step === 'pick_stealer' && turnoverPlayerId && !trackBoth) {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Steal credit</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <Button
              className="w-full"
              onClick={overlayClick(() => {
                commitTurnover(turnoverPlayerId, false, 'team');
                onTurnoverPlayerIdChange(undefined);
              })}
            >
              Team steal
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
            <Button onClick={overlayClick(() => dispatch({ type: 'FOUL_CATEGORY', category: 'personal' }))}>
              Personal
            </Button>
            <Button onClick={overlayClick(() => dispatch({ type: 'FOUL_CATEGORY', category: 'technical' }))}>
              Technical
            </Button>
            <Button
              onClick={overlayClick(() =>
                dispatch({ type: 'FOUL_CATEGORY', category: 'unsportsmanlike' })
              )}
            >
              Unsportsmanlike
            </Button>
            <Button variant="outline" onClick={overlayClick(() => dispatch({ type: 'RESET' }))}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'foul' && phase.step === 'ft_count' && phase.recipientId) {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">Free throws</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap justify-center pb-4">
            {[0, 1, 2, 3].map((n) => (
              <Button
                key={n}
                variant="outline"
                onClick={overlayClick(() => {
                  commitFoul(
                    phase.committerId!,
                    phase.recipientId,
                    phase.foulCategory ?? 'personal',
                    n,
                    n > 0 ? phase.recipientId : undefined
                  );
                })}
              >
                {n} FT{n !== 1 ? 's' : ''}
              </Button>
            ))}
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  if (phase.kind === 'free_throw' && ftSession) {
    return (
      <LiveCourtOverlayShell>
        <Card className="border-primary/50 shadow-xl w-[min(90%,320px)]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-center text-base">
              FT {ftSession.ftIndex} of {ftSession.ftTotal}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pb-4">
            <Button className="live-btn-make h-12 font-bold" onClick={overlayClick(() => commitFreeThrow(true))}>
              Make
            </Button>
            <Button className="live-btn-miss h-12 font-bold" onClick={overlayClick(() => commitFreeThrow(false))}>
              Miss
            </Button>
          </CardContent>
        </Card>
      </LiveCourtOverlayShell>
    );
  }

  return null;
}
