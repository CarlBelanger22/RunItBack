import React from 'react';
import type { Game } from '../../App';
import { Button } from '../ui/button';
import { LIVE_TEAM_HEX } from './liveEntryTheme';

interface LiveOpeningJumpBallOverlayProps {
  game: Game;
  onSelectWinner: (teamId: string) => void;
}

export function LiveOpeningJumpBallOverlay({
  game,
  onSelectWinner,
}: LiveOpeningJumpBallOverlayProps) {
  const homeColor = LIVE_TEAM_HEX.home;
  const awayColor = LIVE_TEAM_HEX.away;

  return (
    <div className="live-opening-jumpball-overlay" role="dialog" aria-modal="true" aria-label="Opening jump ball">
      <div className="live-opening-jumpball-card">
        <h2 className="live-font-condensed live-opening-jumpball-title">JUMP BALL</h2>
        <p className="live-font-mono live-opening-jumpball-subtitle">Who won the opening tip?</p>
        <div className="live-opening-jumpball-buttons">
          <Button
            size="lg"
            className="live-opening-jumpball-btn"
            style={{
              borderColor: homeColor,
              color: homeColor,
            }}
            onClick={() => onSelectWinner(game.homeTeamId)}
          >
            {game.homeTeam.abbreviation}
          </Button>
          <Button
            size="lg"
            className="live-opening-jumpball-btn"
            style={{
              borderColor: awayColor,
              color: awayColor,
            }}
            onClick={() => onSelectWinner(game.awayTeamId)}
          >
            {game.awayTeam.abbreviation}
          </Button>
        </div>
      </div>
    </div>
  );
}
