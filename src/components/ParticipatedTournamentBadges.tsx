import React from 'react';
import { Badge } from './ui/badge';
import type { Tournament } from '../App';
import { TournamentBadge } from './TournamentBadge';

interface ParticipatedTournamentBadgesProps {
  tournaments: Tournament[];
  onNavigateToTournament: (tournamentId: string) => void;
}

export function ParticipatedTournamentBadges({
  tournaments,
  onNavigateToTournament,
}: ParticipatedTournamentBadgesProps) {
  if (tournaments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
