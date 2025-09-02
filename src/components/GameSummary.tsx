import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Game } from '../App';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { BoxScore } from './BoxScore';
import { ShotChart } from './ShotChart';
import { TeamStats } from './TeamStats';

interface GameSummaryProps {
  game: Game;
  onBack: () => void;
}

export function GameSummary({ game, onBack }: GameSummaryProps) {
  // Calculate team scores
  const homeScore = game.gameStats
    .filter(stat => game.homeTeam.players.some(player => player.id === stat.playerId))
    .reduce((sum, stat) => sum + stat.points, 0);
    
  const awayScore = game.gameStats
    .filter(stat => game.awayTeam.players.some(player => player.id === stat.playerId))
    .reduce((sum, stat) => sum + stat.points, 0);

  const gameDate = new Date(game.date);
  const isRecent = Date.now() - gameDate.getTime() < 7 * 24 * 60 * 60 * 1000; // Within 7 days

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        {isRecent && (
          <Badge variant="secondary" className="px-3 py-1">
            Recent Game
          </Badge>
        )}
      </div>

      {/* Game Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Game Summary</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {gameDate.toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-center space-x-8">
            {/* Away Team */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium">{game.awayTeam.name}</h3>
              <div className="text-4xl font-bold">{awayScore}</div>
              <Badge variant={awayScore > homeScore ? 'default' : 'secondary'}>
                {awayScore > homeScore ? 'Winner' : 'Loser'}
              </Badge>
            </div>
            
            {/* VS */}
            <div className="text-2xl font-light text-muted-foreground">VS</div>
            
            {/* Home Team */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium">{game.homeTeam.name}</h3>
              <div className="text-4xl font-bold">{homeScore}</div>
              <Badge variant={homeScore > awayScore ? 'default' : 'secondary'}>
                {homeScore > awayScore ? 'Winner' : 'Loser'}
              </Badge>
            </div>
          </div>
          
          {/* Game Status */}
          <div className="text-center mt-6">
            <Badge variant="outline" className="px-4 py-2">
              {game.isActive ? 'In Progress' : 'Final'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Game Details Tabs */}
      <Tabs defaultValue="box-score" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="box-score">Box Score</TabsTrigger>
          <TabsTrigger value="shot-chart">Shot Chart</TabsTrigger>
          <TabsTrigger value="team-stats">Team Stats</TabsTrigger>
        </TabsList>

        <div className="space-y-6">
          <TabsContent value="box-score" className="space-y-6">
            <BoxScore game={game} />
          </TabsContent>

          <TabsContent value="shot-chart" className="space-y-6">
            <ShotChart game={game} />
          </TabsContent>

          <TabsContent value="team-stats" className="space-y-6">
            <TeamStats game={game} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}