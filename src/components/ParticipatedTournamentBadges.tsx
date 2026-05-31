import React from 'react';
import { Badge } from './ui/badge';
import { Trophy } from 'lucide-react';
import type { Tournament } from '../App';

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
          className="cursor-pointer"
          onClick={() => onNavigateToTournament(tournament.id)}
        >
          <Trophy className="w-3 h-3 mr-1" />
          {tournament.name}
        </Badge>
      ))}
    </div>
  );
}
