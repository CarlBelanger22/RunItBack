import React from 'react';
import { Card } from './ui/card';
import type { Game } from '../App';
import {
  formatGameLeader,
  getGameLeaders,
} from '../utils/gameDisplay';

interface GameLeadersSectionProps {
  game: Game;
}

export function GameLeadersSection({ game }: GameLeadersSectionProps) {
  const points = getGameLeaders(game, 'points');
  const assists = getGameLeaders(game, 'assists');
  const rebounds = getGameLeaders(game, 'rebounds');
  const efficiency = getGameLeaders(game, 'efficiency');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Leading Scorer</div>
        <div className="font-medium text-sm mt-1">
          {formatGameLeader(points, 'pts')}
        </div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Most Assists</div>
        <div className="font-medium text-sm mt-1">
          {formatGameLeader(assists, '')}
        </div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Most Rebounds</div>
        <div className="font-medium text-sm mt-1">
          {formatGameLeader(rebounds, '')}
        </div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Best Efficiency</div>
        <div className="font-medium text-sm mt-1">
          {formatGameLeader(efficiency, '', 0)}
        </div>
      </Card>
    </div>
  );
}
