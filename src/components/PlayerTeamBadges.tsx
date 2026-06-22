import React from 'react';
import { Badge } from './ui/badge';
import type { Team } from '../App';
import { TeamBadge } from './TeamBadge';

interface PlayerTeamBadgesProps {
  teams: Team[];
  onNavigateToTeam: (teamId: string) => void;
  layout?: 'wrap' | 'rail';
}

export function PlayerTeamBadges({
  teams,
  onNavigateToTeam,
  layout = 'wrap',
}: PlayerTeamBadgesProps) {
  if (teams.length === 0) {
    return null;
  }

  return (
    <div
      className={
        layout === 'rail'
          ? 'flex w-max flex-nowrap items-center gap-2 px-0.5 py-0.5'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      {teams.map((team) => (
        <Badge
          key={team.id}
          variant="outline"
          className="cursor-pointer gap-1.5 pl-1.5"
          onClick={() => onNavigateToTeam(team.id)}
        >
          <TeamBadge team={team} teamId={team.id} size="sm" className="rounded-sm" />
          {team.name}
        </Badge>
      ))}
    </div>
  );
}
