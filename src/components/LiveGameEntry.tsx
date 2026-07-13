import React from 'react';
import type { Game, Team, Tournament } from '../App';
import type { TournamentRosterEntry } from '../../utils/tournamentRosters';
import { LiveGameWorkspace } from './live/LiveGameWorkspace';

interface LiveGameEntryProps {
  game: Game;
  teams: Team[];
  tournaments: Tournament[];
  tournamentRosters: TournamentRosterEntry[];
  onGameUpdate: (game: Game) => void;
  onGameComplete: (game: Game) => void;
  onDeleteGame: () => void;
}

export function LiveGameEntry({
  game,
  teams,
  tournaments,
  tournamentRosters,
  onGameUpdate,
  onGameComplete,
  onDeleteGame,
}: LiveGameEntryProps) {
  return (
    <LiveGameWorkspace
      game={game}
      teams={teams}
      tournaments={tournaments}
      tournamentRosters={tournamentRosters}
      onGameUpdate={onGameUpdate}
      onGameComplete={onGameComplete}
      onDeleteGame={onDeleteGame}
    />
  );
}
