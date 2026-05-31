import React from 'react';
import { Card } from './ui/card';
import type { Game } from '../App';
import {
  getGameLeaders,
  type GameLeaderResult,
} from '../utils/gameDisplay';

interface GameLeadersSectionProps {
  game: Game;
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
}

function GameLeaderContent({
  result,
  suffix,
  decimals = 0,
  onNavigateToPlayer,
}: {
  result: GameLeaderResult | null;
  suffix: string;
  decimals?: number;
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
}) {
  if (!result || result.leaders.length === 0) {
    return <>-</>;
  }

  const value =
    decimals > 0 ? result.value.toFixed(decimals) : String(result.value);

  return (
    <>
      {result.leaders.map((leader, index) => (
        <React.Fragment key={leader.playerId}>
          {index > 0 && ', '}
          {onNavigateToPlayer ? (
            <button
              type="button"
              className="hover:text-primary hover:underline cursor-pointer"
              onClick={() => onNavigateToPlayer(leader.playerId, leader.teamId)}
            >
              {leader.name}
            </button>
          ) : (
            leader.name
          )}
        </React.Fragment>
      ))}{' '}
      ({value}
      {suffix})
    </>
  );
}

export function GameLeadersSection({
  game,
  onNavigateToPlayer,
}: GameLeadersSectionProps) {
  const points = getGameLeaders(game, 'points');
  const assists = getGameLeaders(game, 'assists');
  const rebounds = getGameLeaders(game, 'rebounds');
  const efficiency = getGameLeaders(game, 'efficiency');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Leading Scorer</div>
        <div className="font-medium text-sm mt-1">
          <GameLeaderContent
            result={points}
            suffix="pts"
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Most Assists</div>
        <div className="font-medium text-sm mt-1">
          <GameLeaderContent
            result={assists}
            suffix=""
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Most Rebounds</div>
        <div className="font-medium text-sm mt-1">
          <GameLeaderContent
            result={rebounds}
            suffix=""
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-sm text-muted-foreground">Best Efficiency</div>
        <div className="font-medium text-sm mt-1">
          <GameLeaderContent
            result={efficiency}
            suffix=""
            decimals={0}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </div>
      </Card>
    </div>
  );
}
