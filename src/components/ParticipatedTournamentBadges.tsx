import React from 'react';
import { Badge } from './ui/badge';
import type { Tournament } from '../App';
import { TournamentBadge } from './TournamentBadge';

interface ParticipatedTournamentBadgesProps {
  tournaments: Tournament[];
  onNavigateToTournament: (tournamentId: string) => void;
  layout?: 'wrap' | 'rail';
}

export function ParticipatedTournamentBadges({
  tournaments,
  onNavigateToTournament,
  layout = 'wrap',
}: ParticipatedTournamentBadgesProps) {
  if (tournaments.length === 0) {
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
      {tournaments.map((tournament) => (
        <Badge
          key={tournament.id}
          variant="default"
          className="cursor-pointer gap-1.5 pl-1.5"
          onClick={() => onNavigateToTournament(tournament.id)}
        >
          <TournamentBadge
            tournament={tournament}
            tournamentId={tournament.id}
            size="xs"
            className="rounded-sm"
          />
          {tournament.name}
        </Badge>
      ))}
    </div>
  );
}
