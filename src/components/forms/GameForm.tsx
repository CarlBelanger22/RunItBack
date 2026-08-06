import React, { useCallback, useMemo, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Game, Tournament } from '../../App';
import { TeamBadge } from '../TeamBadge';
import { sortTournamentsByDateDesc } from '../../utils/tournamentSort';
import { Switch } from '../ui/switch';
import {
  FRIENDLY_GAME_META,
  isFriendlyGame,
} from '../../utils/friendlyGame';
import { GameStageTagFields } from '../GameStageTagFields';

export interface GameFormValues {
  date: string;
  startTime?: string;
  /** Omitted / empty for friendly games (no tournament). */
  tournamentId?: string;
  finalScoreHome?: number;
  finalScoreAway?: number;
  /** Visual court orientation — home on the right when true. */
  courtSidesFlipped?: boolean;
  /** LE-95 stage / group tags when tournament is structured. */
  stageId?: string;
  groupId?: string;
}

interface GameFormProps {
  game: Game;
  tournaments: Tournament[];
  isCompleted?: boolean;
  lockTournament?: boolean;
  scoreMismatchWarning?: string | null;
  onSubmit: (data: GameFormValues) => void;
  onCancel: () => void;
}

export const GameForm = React.memo(function GameForm({
  game,
  tournaments,
  isCompleted = false,
  lockTournament = false,
  scoreMismatchWarning,
  onSubmit,
  onCancel,
}: GameFormProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const finalHomeRef = useRef<HTMLInputElement>(null);
  const finalAwayRef = useRef<HTMLInputElement>(null);
  const [tournamentId, setTournamentId] = React.useState(game.tournamentId ?? '');
  const [courtSidesFlipped, setCourtSidesFlipped] = React.useState(
    !!game.courtSidesFlipped
  );
  const [stageId, setStageId] = React.useState(game.stageId);
  const [groupId, setGroupId] = React.useState(game.groupId);
  const isFriendly = isFriendlyGame(game);

  const sortedTournaments = useMemo(
    () => sortTournamentsByDateDesc(tournaments),
    [tournaments]
  );

  const selectedTournament = useMemo(
    () => sortedTournaments.find((t) => t.id === tournamentId),
    [sortedTournaments, tournamentId]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const date = dateRef.current?.value.trim();
      if (!date) return;
      // Official games need a tournament; friendlies never have one (LE-92).
      if (!isFriendly && !tournamentId) return;

      const startTimeRaw = startTimeRef.current?.value.trim();
      const finalScoreHome = isCompleted
        ? parseInt(finalHomeRef.current?.value ?? '', 10)
        : undefined;
      const finalScoreAway = isCompleted
        ? parseInt(finalAwayRef.current?.value ?? '', 10)
        : undefined;

      onSubmit({
        date,
        startTime: startTimeRaw || undefined,
        tournamentId: isFriendly ? undefined : tournamentId,
        finalScoreHome: Number.isFinite(finalScoreHome) ? finalScoreHome : undefined,
        finalScoreAway: Number.isFinite(finalScoreAway) ? finalScoreAway : undefined,
        courtSidesFlipped,
        stageId: isFriendly ? undefined : stageId,
        groupId: isFriendly ? undefined : groupId,
      });
    },
    [
      onSubmit,
      tournamentId,
      isCompleted,
      courtSidesFlipped,
      isFriendly,
      stageId,
      groupId,
    ]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
    >
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground mb-3">Teams (read-only)</p>
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 min-w-0">
            <TeamBadge team={game.homeTeam} teamId={game.homeTeam.id} size="md" />
            <span className="text-sm font-medium text-center">{game.homeTeam.name}</span>
          </div>
          <span className="text-muted-foreground text-sm">vs</span>
          <div className="flex flex-col items-center gap-2 min-w-0">
            <TeamBadge team={game.awayTeam} teamId={game.awayTeam.id} size="md" />
            <span className="text-sm font-medium text-center">{game.awayTeam.name}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1 min-w-0">
          <Label htmlFor="game-form-flip-sides">Flip court sides (camera view)</Label>
          <p className="text-xs text-muted-foreground">
            {courtSidesFlipped
              ? 'Away left / Home right — use when filming from the opposite sideline.'
              : 'Home left / Away right (default).'}{' '}
            Sides also flip automatically at half (after Q2).
          </p>
        </div>
        <Switch
          id="game-form-flip-sides"
          checked={courtSidesFlipped}
          onCheckedChange={setCourtSidesFlipped}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="game-form-date">Game date</Label>
          <Input
            ref={dateRef}
            id="game-form-date"
            type="date"
            defaultValue={game.date}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="game-form-start-time">Start time (optional)</Label>
          <Input
            ref={startTimeRef}
            id="game-form-start-time"
            type="time"
            defaultValue={game.startTime ?? ''}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="game-form-tournament">Tournament</Label>
        {isFriendly ? (
          <>
            <div
              id="game-form-tournament"
              className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground"
            >
              {FRIENDLY_GAME_META}
            </div>
            <p className="text-xs text-muted-foreground">
              Friendly games are not tied to a tournament and cannot be converted.
            </p>
          </>
        ) : (
          <>
            <Select
              value={tournamentId}
              onValueChange={(id) => {
                setTournamentId(id);
                setStageId(undefined);
                setGroupId(undefined);
              }}
              disabled={lockTournament || sortedTournaments.length === 0}
            >
              <SelectTrigger id="game-form-tournament">
                <SelectValue placeholder="Select tournament" />
              </SelectTrigger>
              <SelectContent>
                {sortedTournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockTournament && (
              <p className="text-xs text-muted-foreground">
                Tournament cannot be changed after stats have been recorded.
              </p>
            )}
          </>
        )}
      </div>

      {!isFriendly && (
        <GameStageTagFields
          tournament={selectedTournament}
          values={{ stageId, groupId }}
          onChange={(next) => {
            setStageId(next.stageId);
            setGroupId(next.groupId);
          }}
        />
      )}

      {isCompleted && (
        <div className="space-y-2">
          <Label>Final score</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="game-form-final-home" className="text-xs text-muted-foreground">
                {game.homeTeam.name}
              </Label>
              <Input
                ref={finalHomeRef}
                id="game-form-final-home"
                type="number"
                min={0}
                defaultValue={game.finalScore?.home ?? ''}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="game-form-final-away" className="text-xs text-muted-foreground">
                {game.awayTeam.name}
              </Label>
              <Input
                ref={finalAwayRef}
                id="game-form-final-away"
                type="number"
                min={0}
                defaultValue={game.finalScore?.away ?? ''}
              />
            </div>
          </div>
          {scoreMismatchWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {scoreMismatchWarning}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Update Game</Button>
      </div>
    </form>
  );
});
