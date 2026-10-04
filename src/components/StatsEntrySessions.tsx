import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import type { Game, Team, Tournament } from '../App';
import { CalendarDays, Pause, Play, Trash2 } from 'lucide-react';
import {
  deleteGameConfirmDescription,
  isGameInProgress,
} from '../utils/activeGame';
import { periodLabel, resolveGameClockSettings } from '../utils/gameClock';
import { resolveGameMetaLabel } from '../utils/friendlyGame';
import { resolveTeamScore } from '../utils/gameDisplay';
import { resolveGameTeam } from '../utils/gameTeams';
import { TeamBadge } from './TeamBadge';
import { listStatsEntrySessions } from '../utils/statsEntrySessions';

interface StatsEntrySessionsProps {
  games: Game[];
  teams: Team[];
  tournaments: Tournament[];
  onResume: (gameId: string) => void;
  onPause: (game: Game) => void;
  onDelete: (gameId: string) => void;
}

export function StatsEntrySessions({
  games,
  teams,
  tournaments,
  onResume,
  onPause,
  onDelete,
}: StatsEntrySessionsProps) {
  const sessions = listStatsEntrySessions(games);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const deleteTarget = deleteTargetId
    ? sessions.find((g) => g.id === deleteTargetId)
    : undefined;

  if (sessions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        In progress
      </h2>
      {sessions.map((game) => {
        const live = isGameInProgress(game);
        const homeTeam = resolveGameTeam(teams, game, 'home');
        const awayTeam = resolveGameTeam(teams, game, 'away');
        const homeScore = resolveTeamScore(game, homeTeam.id);
        const awayScore = resolveTeamScore(game, awayTeam.id);
        const tournament = tournaments.find((t) => t.id === game.tournamentId);
        const metaLabel = resolveGameMetaLabel(game, tournament?.name);
        const clock = resolveGameClockSettings(game);
        const period = periodLabel(game.currentPeriod ?? 1, clock);
        const tip = (game.currentGameTime ?? '').trim();

        return (
          <Card
            key={game.id}
            className={
              live
                ? 'shadow-lg rounded-2xl border-primary/30'
                : 'shadow-md rounded-2xl'
            }
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {live ? (
                  <Badge>Live</Badge>
                ) : (
                  <Badge variant="secondary">Paused</Badge>
                )}
                <span className="font-medium">
                  {homeTeam.abbreviation || homeTeam.name} vs{' '}
                  {awayTeam.abbreviation || awayTeam.name}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <TeamBadge team={homeTeam} teamId={homeTeam.id} size="md" />
                  <span className="font-medium truncate">{homeTeam.name}</span>
                </div>
                <div className="text-2xl font-bold tabular-nums shrink-0">
                  {homeScore} – {awayScore}
                </div>
                <div className="flex items-center gap-2 min-w-0 justify-end">
                  <span className="font-medium truncate text-right">
                    {awayTeam.name}
                  </span>
                  <TeamBadge team={awayTeam} teamId={awayTeam.id} size="md" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {period}
                  {tip ? ` · ${tip}` : ''}
                </span>
                {game.date ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-4 h-4" />
                    {game.date}
                  </span>
                ) : null}
                {metaLabel ? <span>{metaLabel}</span> : null}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => onResume(game.id)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                {live ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => onPause(game)}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                ) : null}
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-destructive hover:text-destructive"
                  onClick={() => setDeleteTargetId(game.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this game?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? deleteGameConfirmDescription(deleteTarget)
                : 'This permanently removes the game and all stats. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) onDelete(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Delete game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
