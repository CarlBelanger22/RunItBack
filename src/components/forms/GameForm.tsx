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

export interface GameFormValues {
  date: string;
  startTime?: string;
  tournamentId: string;
  finalScoreHome?: number;
  finalScoreAway?: number;
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

  const sortedTournaments = useMemo(
    () => sortTournamentsByDateDesc(tournaments),
    [tournaments]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const date = dateRef.current?.value.trim();
      if (!date || !tournamentId) return;

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
        tournamentId,
        finalScoreHome: Number.isFinite(finalScoreHome) ? finalScoreHome : undefined,
        finalScoreAway: Number.isFinite(finalScoreAway) ? finalScoreAway : undefined,
      });
    },
    [onSubmit, tournamentId, isCompleted]
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
        <Select
          value={tournamentId}
          onValueChange={setTournamentId}
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
      </div>

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
