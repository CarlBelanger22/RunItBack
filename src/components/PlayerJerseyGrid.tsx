import React, { useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from './ui/utils';
import { JerseyIcon } from './JerseyIcon';
import type { Team } from '../App';
import {
  groupJerseyEntriesByNumber,
  jerseyGroupAriaLabel,
} from '../utils/playerJerseyGroups';

export interface PlayerJerseyEntry {
  team: Team;
  number: number;
}

interface PlayerJerseyGridProps {
  entries: PlayerJerseyEntry[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function JerseyTooltipContent({
  number,
  teams,
}: {
  number: number;
  teams: Team[];
}) {
  return (
    <div className="space-y-1 leading-snug">
      <p>#{number}</p>
      <ul className="space-y-0.5">
        {teams.map((team) => (
          <li key={team.id}>{team.name}</li>
        ))}
      </ul>
    </div>
  );
}

export function PlayerJerseyGrid({
  entries,
  size = 'md',
  className,
}: PlayerJerseyGridProps) {
  const groups = useMemo(() => groupJerseyEntriesByNumber(entries), [entries]);

  if (groups.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex flex-wrap gap-0.5 justify-end content-start', className)}>
        {groups.map((group) => (
          <Tooltip key={group.number}>
            <TooltipTrigger asChild>
              <span
                className="rounded-md p-0.5 cursor-default"
                aria-label={jerseyGroupAriaLabel(group)}
              >
                <JerseyIcon number={group.number} size={size} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <JerseyTooltipContent number={group.number} teams={group.teams} />
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
