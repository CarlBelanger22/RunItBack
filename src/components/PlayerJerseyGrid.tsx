import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from './ui/utils';
import { JerseyIcon } from './JerseyIcon';
import type { Team } from '../App';

export interface PlayerJerseyEntry {
  team: Team;
  number: number;
}

interface PlayerJerseyGridProps {
  entries: PlayerJerseyEntry[];
  onTeamClick?: (teamId: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlayerJerseyGrid({
  entries,
  onTeamClick,
  size = 'md',
  className,
}: PlayerJerseyGridProps) {
  if (entries.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex flex-wrap gap-0.5 justify-end content-start', className)}>
        {entries.map(({ team, number }) => (
          <Tooltip key={team.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-md p-0.5 hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onTeamClick?.(team.id)}
                aria-label={`${team.name}, number ${number}`}
              >
                <JerseyIcon number={number} size={size} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="font-medium">{team.name}</p>
              <p className="text-xs text-muted-foreground">#{number}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
