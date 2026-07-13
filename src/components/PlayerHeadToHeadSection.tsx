import React from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { JerseyIcon } from './JerseyIcon';
import { cn } from './ui/utils';
import { ComparisonStatRow } from './ComparisonStatRow';
import type { GameHeadToHeadModel, HeadToHeadPlayer } from '../utils/gameHeadToHeadModel';

interface PlayerHeadToHeadSectionProps {
  model: GameHeadToHeadModel;
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
}

function PlayerFlank({
  player,
  side,
  onNavigateToPlayer,
}: {
  player: HeadToHeadPlayer | null;
  side: 'home' | 'away';
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
}) {
  const accent =
    side === 'home'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-amber-600 dark:text-amber-400';

  if (!player) {
    return (
      <div className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="w-full text-center text-xs font-medium">—</span>
        <Avatar className="game-h2h-avatar">
          <AvatarFallback className="text-lg">—</AvatarFallback>
        </Avatar>
        <JerseyIcon number={0} size="md" fontSize={18} fontWeight={600} className="opacity-30" />
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center gap-2">
      <span
        className={cn(
          'w-full text-center text-xs font-medium leading-tight line-clamp-2',
          accent
        )}
      >
        {player.name}
      </span>
      <Avatar className="game-h2h-avatar">
        <AvatarFallback className={cn('text-lg font-semibold', accent)}>
          {player.initials}
        </AvatarFallback>
      </Avatar>
      <JerseyIcon number={player.number} size="md" fontSize={18} fontWeight={600} />
    </div>
  );

  if (onNavigateToPlayer) {
    return (
      <button
        type="button"
        className="flex w-32 shrink-0 flex-col items-center rounded-lg p-1 transition-colors hover:bg-muted/50"
        onClick={() => onNavigateToPlayer(player.playerId, player.teamId)}
      >
        {content}
      </button>
    );
  }

  return <div className="flex w-32 shrink-0 flex-col items-center">{content}</div>;
}

export function PlayerHeadToHeadSection({
  model,
  onNavigateToPlayer,
}: PlayerHeadToHeadSectionProps) {
  return (
    <div className="grid w-full grid-cols-3 items-center">
      <div className="flex justify-center">
        <PlayerFlank
          player={model.home}
          side="home"
          onNavigateToPlayer={onNavigateToPlayer}
        />
      </div>

      <div className="flex flex-col items-center gap-1">
        {model.statRows.map((row) => (
          <ComparisonStatRow
            key={row.key}
            homeDisplay={row.homeDisplay}
            label={row.label}
            awayDisplay={row.awayDisplay}
          />
        ))}
        <ComparisonStatRow
          homeDisplay={model.gmSc.homeDisplay}
          label={model.gmSc.label}
          awayDisplay={model.gmSc.awayDisplay}
        />
      </div>

      <div className="flex justify-center">
        <PlayerFlank
          player={model.away}
          side="away"
          onNavigateToPlayer={onNavigateToPlayer}
        />
      </div>
    </div>
  );
}
