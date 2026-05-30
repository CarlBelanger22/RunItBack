import React from 'react';
import { Badge } from '../ui/badge';
import { TeamAvatar } from '../TeamAvatar';
import type { Game } from '../../App';
import { resolveTeamScore } from '../../utils/gameDisplay';

interface DashboardGamePreviewProps {
  game: Game;
  tournamentName?: string;
  onClick: () => void;
}

export function DashboardGamePreview({
  game,
  tournamentName,
  onClick,
}: DashboardGamePreviewProps) {
  const homeScore = resolveTeamScore(game, game.homeTeam.id);
  const awayScore = resolveTeamScore(game, game.awayTeam.id);
  const dateLabel = new Date(game.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 text-xs text-muted-foreground leading-snug">
          <p>{dateLabel}</p>
          {tournamentName && <p className="mt-0.5">{tournamentName}</p>}
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          Final
        </Badge>
      </div>

      <div className="flex items-start gap-4 sm:gap-6">
        <div className="flex flex-1 min-w-0 items-start justify-end gap-3">
          <div className="text-right min-w-0">
            <p className="text-sm sm:text-base font-semibold leading-snug break-words">
              {game.homeTeam.name}
            </p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{homeScore}</p>
          </div>
          <TeamAvatar team={game.homeTeam} size="md" />
        </div>

        <div className="flex flex-1 min-w-0 items-start gap-3">
          <TeamAvatar team={game.awayTeam} size="md" />
          <div className="text-left min-w-0">
            <p className="text-sm sm:text-base font-semibold leading-snug break-words">
              {game.awayTeam.name}
            </p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{awayScore}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
