import React, { useState, useEffect, useMemo } from 'react';
import type { GameEvent, Team, Player } from '../../App';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { canEditShotFields } from '../../liveEntry/eventEditGuards';

const NONE = '__none__';
const TEAM_ORB = '__team_orb__';
const TEAM_DRB = '__team_drb__';

export interface ShotEditReboundAfter {
  teamId: string;
  playerId?: string;
  reboundType: 'offensive' | 'defensive' | 'team_offensive' | 'team_defensive';
}

/** Result of saving an event edit — may also insert/update/remove a following rebound. */
export interface EventEditSaveResult {
  event: GameEvent;
  /** Upsert a rebound immediately after this shot (make→miss or miss rebound change). */
  reboundAfter?: ShotEditReboundAfter;
  /** Remove the rebound immediately after this shot (miss→make). */
  removeFollowingRebound?: boolean;
}

interface EventEditDialogProps {
  event: GameEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeTeam: Team;
  awayTeam: Team;
  /** Full event list — used to find a rebound that follows a missed shot. */
  events?: GameEvent[];
  onSave: (result: EventEditSaveResult) => void;
  /**
   * Shot relocate: stash current form into a draft event (+ rebound key) and
   * close so the user can re-tap the main court.
   */
  onRequestRelocate?: (draft: GameEvent, reboundKey: string) => void;
}

function PlayerSelect({
  label,
  value,
  onValueChange,
  players,
  allowNone,
  placeholder = 'Select player',
  extraItems,
}: {
  label: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  players: Player[];
  allowNone?: boolean;
  placeholder?: string;
  extraItems?: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value ?? (allowNone ? NONE : undefined)} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>None</SelectItem>}
          {extraItems?.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              #{p.number} {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Rebound immediately after a shot (next event in the list). */
export function findFollowingRebound(
  events: GameEvent[],
  shot: GameEvent
): GameEvent | null {
  const idx = events.findIndex((e) => e.id === shot.id);
  if (idx < 0) return null;
  const next = events[idx + 1];
  if (!next || next.type !== 'rebound') return null;
  return next;
}

export function resolveReboundFromPicker(
  shootingTeamId: string,
  defendingTeamId: string,
  homeTeam: Team,
  awayTeam: Team,
  reboundKey: string
): ShotEditReboundAfter | null {
  if (reboundKey === TEAM_ORB) {
    return {
      teamId: shootingTeamId,
      reboundType: 'team_offensive',
    };
  }
  if (reboundKey === TEAM_DRB) {
    return {
      teamId: defendingTeamId,
      reboundType: 'team_defensive',
    };
  }
  if (reboundKey === NONE || !reboundKey) return null;

  const onHome = homeTeam.players.some((p) => p.id === reboundKey);
  const onAway = awayTeam.players.some((p) => p.id === reboundKey);
  if (!onHome && !onAway) return null;

  const playerTeamId = onHome ? homeTeam.id : awayTeam.id;
  const isOffensive = playerTeamId === shootingTeamId;
  return {
    teamId: playerTeamId,
    playerId: reboundKey,
    reboundType: isOffensive ? 'offensive' : 'defensive',
  };
}

function reboundKeyFromEvent(reb: GameEvent): string {
  const rt = reb.details.reboundType as string;
  if (rt === 'team_offensive') return TEAM_ORB;
  if (rt === 'team_defensive') return TEAM_DRB;
  return reb.playerId ?? NONE;
}

function teamIdForPlayer(homeTeam: Team, awayTeam: Team, playerId?: string): string | null {
  if (!playerId) return null;
  if (homeTeam.players.some((p) => p.id === playerId)) return homeTeam.id;
  if (awayTeam.players.some((p) => p.id === playerId)) return awayTeam.id;
  return null;
}

function opponentOf(homeTeam: Team, awayTeam: Team, teamId: string): Team {
  return teamId === homeTeam.id ? awayTeam : homeTeam;
}

function buildShotDraft(
  event: GameEvent,
  homeTeam: Team,
  awayTeam: Team,
  fields: {
    playerId?: string;
    made: boolean;
    assistedBy: string;
    blockedBy: string;
    isTransition: boolean;
  }
): GameEvent {
  const details: Record<string, any> = {
    ...event.details,
    made: fields.made,
    isTransition: fields.isTransition,
  };
  if (fields.made) {
    details.assistedBy = fields.assistedBy === NONE ? undefined : fields.assistedBy;
    details.blockedBy = undefined;
  } else {
    details.blockedBy = fields.blockedBy === NONE ? undefined : fields.blockedBy;
    details.assistedBy = undefined;
  }
  const nextPlayerId = fields.playerId ?? event.playerId;
  return {
    ...event,
    playerId: nextPlayerId,
    teamId: teamIdForPlayer(homeTeam, awayTeam, nextPlayerId) ?? event.teamId,
    details,
  };
}

type ReboundTypeOption = 'offensive' | 'defensive' | 'team_offensive' | 'team_defensive';

export function EventEditDialog({
  event,
  open,
  onOpenChange,
  homeTeam,
  awayTeam,
  events = [],
  onSave,
  onRequestRelocate,
}: EventEditDialogProps) {
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [made, setMade] = useState(false);
  const [assistedBy, setAssistedBy] = useState<string>(NONE);
  const [blockedBy, setBlockedBy] = useState<string>(NONE);
  const [isTransition, setIsTransition] = useState(false);
  const [reboundKey, setReboundKey] = useState<string>(NONE);

  // Foul
  const [drawnBy, setDrawnBy] = useState<string>(NONE);

  // Rebound (standalone)
  const [reboundType, setReboundType] = useState<ReboundTypeOption>('defensive');

  // Turnover
  const [isTeamTurnover, setIsTeamTurnover] = useState(false);
  const [stolenBy, setStolenBy] = useState<string>(NONE);
  const [guardError, setGuardError] = useState<string | null>(null);

  const followingRebound = useMemo(() => {
    if (!event || event.type !== 'shot_attempt') return null;
    return findFollowingRebound(events, event);
  }, [event, events]);

  useEffect(() => {
    if (!event || !open) return;
    setGuardError(null);
    setPlayerId(event.playerId);

    if (event.type === 'shot_attempt') {
      const wasMade = !!event.details.made;
      setMade(wasMade);
      setAssistedBy(event.details.assistedBy ?? NONE);
      setBlockedBy(event.details.blockedBy ?? NONE);
      setIsTransition(!!event.details.isTransition);
      const storedKey = (event.details as { _editReboundKey?: string })._editReboundKey;
      if (storedKey) {
        setReboundKey(storedKey);
      } else if (!wasMade && followingRebound) {
        setReboundKey(reboundKeyFromEvent(followingRebound));
      } else {
        setReboundKey(NONE);
      }
    }

    if (event.type === 'foul') {
      setDrawnBy(event.details.drawnBy ?? NONE);
    }

    if (event.type === 'rebound') {
      const rt = (event.details.reboundType as ReboundTypeOption) ?? 'defensive';
      setReboundType(rt);
    }

    if (event.type === 'turnover') {
      setIsTeamTurnover(!!event.details.isTeamTurnover);
      setStolenBy(event.details.stolenBy ?? NONE);
    }

    if (event.type === 'free_throw') {
      setMade(!!event.details.made);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-init on open / event identity
  }, [event?.id, open]);

  if (!event) return null;

  const team = event.teamId === homeTeam.id ? homeTeam : awayTeam;
  const opponent = opponentOf(homeTeam, awayTeam, event.teamId);
  const allPlayers: Player[] = [...homeTeam.players, ...awayTeam.players];

  const isShot = event.type === 'shot_attempt';
  const isFoul = event.type === 'foul';
  const isRebound = event.type === 'rebound';
  const isTurnover = event.type === 'turnover';
  const isFreeThrow = event.type === 'free_throw';
  const isEditableType = isShot || isFoul || isRebound || isTurnover || isFreeThrow;

  const isTeamFoul = isFoul && !!event.details.isTeamFoul;
  const isCoachFoul = isFoul && !!event.details.isCoachFoul;

  const foulCommitterTeamId = playerId
    ? teamIdForPlayer(homeTeam, awayTeam, playerId) ?? event.teamId
    : event.teamId;
  const foulDrawnByTeam = opponentOf(homeTeam, awayTeam, foulCommitterTeamId);

  const shootingTeamId = event.teamId;
  const defendingTeamId = opponent.id;
  const assistOptions = team.players.filter((p) => p.id !== playerId);

  const reboundRequired = isShot && !made;
  const reboundValid = !reboundRequired || (reboundKey !== NONE && reboundKey !== '');

  const isThree = !!event.details.isThree;
  const inPaint = !!event.details.inPaint;
  const locationLabel = isThree ? '3PT' : inPaint ? '2PT (paint)' : '2PT';

  const foulCategory =
    (event.details.foulCategory as string) ||
    (event.details.foulType as string) ||
    'personal';

  const canSave =
    isEditableType &&
    reboundValid &&
    (isShot ||
      isFreeThrow ||
      isRebound ||
      (isFoul && (isTeamFoul || isCoachFoul || !!playerId)) ||
      (isTurnover && (isTeamTurnover || !!playerId)));

  const handleSave = () => {
    setGuardError(null);
    if (isShot) {
      const updated = buildShotDraft(event, homeTeam, awayTeam, {
        playerId,
        made,
        assistedBy,
        blockedBy,
        isTransition,
      });
      const { _editReboundKey: _, ...cleanDetails } = updated.details as Record<string, any>;
      const cleaned = { ...updated, details: cleanDetails };

      const guard = canEditShotFields(event, cleaned, events);
      if (!guard.ok) {
        setGuardError(guard.reason ?? 'This edit is not allowed.');
        return;
      }

      if (made) {
        onSave({ event: cleaned, removeFollowingRebound: true });
      } else {
        const reboundAfter = resolveReboundFromPicker(
          shootingTeamId,
          defendingTeamId,
          homeTeam,
          awayTeam,
          reboundKey
        );
        if (!reboundAfter) return;
        onSave({ event: cleaned, reboundAfter });
      }
      onOpenChange(false);
      return;
    }

    if (isFreeThrow) {
      const nextPlayerId = playerId ?? event.playerId;
      onSave({
        event: {
          ...event,
          playerId: nextPlayerId,
          teamId: teamIdForPlayer(homeTeam, awayTeam, nextPlayerId) ?? event.teamId,
          details: { ...event.details, made },
        },
      });
      onOpenChange(false);
      return;
    }

    if (isFoul) {
      const nextTeamId =
        isTeamFoul || isCoachFoul
          ? event.teamId
          : teamIdForPlayer(homeTeam, awayTeam, playerId) ?? event.teamId;
      onSave({
        event: {
          ...event,
          playerId: isTeamFoul || isCoachFoul ? undefined : playerId,
          teamId: nextTeamId,
          details: {
            ...event.details,
            drawnBy: drawnBy === NONE ? undefined : drawnBy,
          },
        },
      });
      onOpenChange(false);
      return;
    }

    if (isRebound) {
      const isTeamReb = reboundType === 'team_offensive' || reboundType === 'team_defensive';
      let nextTeamId = event.teamId;
      let nextPlayerId: string | undefined = playerId;
      if (isTeamReb) {
        nextPlayerId = undefined;
        // Keep teamId — operator can change type; team stays unless they pick a player type.
      } else if (playerId) {
        nextTeamId = teamIdForPlayer(homeTeam, awayTeam, playerId) ?? event.teamId;
      }
      onSave({
        event: {
          ...event,
          playerId: nextPlayerId,
          teamId: nextTeamId,
          details: { ...event.details, reboundType },
        },
      });
      onOpenChange(false);
      return;
    }

    if (isTurnover) {
      const nextPlayerId = isTeamTurnover ? undefined : playerId;
      const nextTeamId = isTeamTurnover
        ? event.teamId
        : teamIdForPlayer(homeTeam, awayTeam, nextPlayerId) ?? event.teamId;
      const stealTeam = opponentOf(homeTeam, awayTeam, nextTeamId);
      const nextStolenBy =
        stolenBy === NONE || stolenBy === 'team' ? null : stolenBy;
      // Stealer must be on the opposing team (or cleared).
      const stealerOk =
        !nextStolenBy || stealTeam.players.some((p) => p.id === nextStolenBy);
      onSave({
        event: {
          ...event,
          playerId: nextPlayerId,
          teamId: nextTeamId,
          details: {
            ...event.details,
            isTeamTurnover,
            stolenBy: stealerOk ? nextStolenBy : null,
          },
        },
      });
      onOpenChange(false);
      return;
    }

    onOpenChange(false);
  };

  const handleChangeLocation = () => {
    if (!onRequestRelocate || !isShot) return;
    const draft = buildShotDraft(event, homeTeam, awayTeam, {
      playerId,
      made,
      assistedBy,
      blockedBy,
      isTransition,
    });
    draft.details = { ...draft.details, _editReboundKey: reboundKey };
    onRequestRelocate(draft, reboundKey);
  };

  const periodLabel = event.period <= 4 ? `Q${event.period}` : `OT${event.period - 4}`;

  const turnoverStealTeam = opponentOf(
    homeTeam,
    awayTeam,
    isTeamTurnover
      ? event.teamId
      : teamIdForPlayer(homeTeam, awayTeam, playerId) ?? event.teamId
  );

  const reboundPlayers =
    reboundType === 'offensive' || reboundType === 'defensive' ? allPlayers : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground capitalize">
            {event.type.replace('_', ' ')} · {event.gameTime} · {periodLabel}
          </div>

          {isShot && (
            <>
              <PlayerSelect
                label="Shooter"
                value={playerId}
                onValueChange={setPlayerId}
                players={team.players}
              />

              <div className="space-y-2">
                <Label>Location</Label>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{locationLabel}</span>
                  {onRequestRelocate && (
                    <Button type="button" variant="outline" size="sm" onClick={handleChangeLocation}>
                      Change location
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Re-tap the court to change 2PT / 3PT / paint.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Made shot</Label>
                <Switch checked={made} onCheckedChange={setMade} />
              </div>

              {made && (
                <PlayerSelect
                  label="Assisted by"
                  value={assistedBy === NONE ? undefined : assistedBy}
                  onValueChange={setAssistedBy}
                  players={assistOptions}
                  allowNone
                  placeholder="No assist"
                />
              )}

              <div className="flex items-center justify-between">
                <Label>Fastbreak</Label>
                <Switch checked={isTransition} onCheckedChange={setIsTransition} />
              </div>

              {!made && (
                <>
                  <PlayerSelect
                    label="Blocked by"
                    value={blockedBy === NONE ? undefined : blockedBy}
                    onValueChange={setBlockedBy}
                    players={opponent.players}
                    allowNone
                    placeholder="No block"
                  />
                  <PlayerSelect
                    label="Rebound"
                    value={reboundKey === NONE ? undefined : reboundKey}
                    onValueChange={setReboundKey}
                    players={allPlayers}
                    placeholder="Who got the rebound?"
                    extraItems={[
                      { value: TEAM_ORB, label: 'Team ORB (offense)' },
                      { value: TEAM_DRB, label: 'Team DRB (defense)' },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Offensive/defensive is set automatically from the rebounder&apos;s team.
                  </p>
                </>
              )}
            </>
          )}

          {isFreeThrow && (
            <>
              <PlayerSelect
                label="Shooter"
                value={playerId}
                onValueChange={setPlayerId}
                players={team.players}
              />
              <div className="flex items-center justify-between">
                <Label>Made free throw</Label>
                <Switch checked={made} onCheckedChange={setMade} />
              </div>
              {event.details.ftIndex != null && event.details.ftTotal != null && (
                <p className="text-xs text-muted-foreground">
                  Attempt {event.details.ftIndex} of {event.details.ftTotal} (count cannot be
                  changed here).
                </p>
              )}
            </>
          )}

          {isFoul && (
            <>
              <p className="text-xs text-muted-foreground capitalize">
                Type: {foulCategory.replace('_', ' ')} (type cannot be changed here)
              </p>
              {isCoachFoul ? (
                <p className="text-sm">Coach foul — {team.abbreviation}</p>
              ) : isTeamFoul ? (
                <p className="text-sm">Team foul — {team.abbreviation}</p>
              ) : (
                <PlayerSelect
                  label="Committed by"
                  value={playerId}
                  onValueChange={setPlayerId}
                  players={allPlayers}
                />
              )}
              <PlayerSelect
                label="Foul drawn by"
                value={drawnBy === NONE ? undefined : drawnBy}
                onValueChange={setDrawnBy}
                players={foulDrawnByTeam.players}
                allowNone
                placeholder="No individual"
              />
            </>
          )}

          {isRebound && (
            <>
              <div className="space-y-2">
                <Label>Rebound type</Label>
                <Select
                  value={reboundType}
                  onValueChange={(v) => setReboundType(v as ReboundTypeOption)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offensive">Offensive (ORB)</SelectItem>
                    <SelectItem value="defensive">Defensive (DRB)</SelectItem>
                    <SelectItem value="team_offensive">Team ORB</SelectItem>
                    <SelectItem value="team_defensive">Team DRB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(reboundType === 'offensive' || reboundType === 'defensive') && (
                <PlayerSelect
                  label="Rebounder"
                  value={playerId}
                  onValueChange={setPlayerId}
                  players={reboundPlayers}
                />
              )}
              {(reboundType === 'team_offensive' || reboundType === 'team_defensive') && (
                <p className="text-xs text-muted-foreground">
                  Team rebound — credited to {team.abbreviation} (no player).
                </p>
              )}
            </>
          )}

          {isTurnover && (
            <>
              <div className="flex items-center justify-between">
                <Label>Team turnover</Label>
                <Switch checked={isTeamTurnover} onCheckedChange={setIsTeamTurnover} />
              </div>
              {!isTeamTurnover && (
                <PlayerSelect
                  label="Turnover by"
                  value={playerId}
                  onValueChange={setPlayerId}
                  players={allPlayers}
                />
              )}
              {isTeamTurnover && (
                <p className="text-xs text-muted-foreground">
                  Team turnover — {team.abbreviation}
                </p>
              )}
              <PlayerSelect
                label="Stolen by"
                value={stolenBy === NONE ? undefined : stolenBy}
                onValueChange={setStolenBy}
                players={turnoverStealTeam.players}
                allowNone
                placeholder="No steal"
              />
            </>
          )}

          {!isEditableType && (
            <p className="text-sm text-muted-foreground">
              This event type cannot be edited yet. Use Undo to remove it.
            </p>
          )}

          {guardError && (
            <p className="text-sm text-destructive border border-destructive/30 rounded-md p-2">
              {guardError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save &amp; recalculate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
