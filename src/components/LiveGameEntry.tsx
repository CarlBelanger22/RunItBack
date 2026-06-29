import React from 'react';
import type { Game, Tournament } from '../App';
import { LiveGameWorkspace } from './live/LiveGameWorkspace';

interface LiveGameEntryProps {
  game: Game;
  tournaments: Tournament[];
  onGameUpdate: (game: Game) => void;
  onGameComplete: (game: Game) => void;
  onDeleteGame: () => void;
}

export function LiveGameEntry({
  game,
  tournaments,
  onGameUpdate,
  onGameComplete,
  onDeleteGame,
}: LiveGameEntryProps) {
  return (
    <LiveGameWorkspace
      game={game}
      tournaments={tournaments}
      onGameUpdate={onGameUpdate}
      onGameComplete={onGameComplete}
      onDeleteGame={onDeleteGame}
    />
  );
}
