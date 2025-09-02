import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Player, Team, Game, GameStats, Tournament } from '../App';
import { MetricsCalculator, AdvancedMetrics } from './MetricsCalculator';
import { 
  ArrowLeft,
  User, 
  BarChart3, 
  Calendar,
  Trophy,
  Target,
  Activity,
  TrendingUp,
  Ruler,
  Weight,
  MapPin,
  Star,
  Medal,
  Crown
} from 'lucide-react';

interface PlayerPageProps {
  player: Player;
  team: Team;
  games: Game[];
  tournaments: Tournament[];
  activeTab: 'overview' | 'gamelog' | 'advanced';
  onTabChange: (tab: 'overview' | 'gamelog' | 'advanced') => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onNavigateToTournament: (tournamentId: string) => void;
}

export function PlayerPage({ 
  player, 
  team,
  games, 
  tournaments,
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToTeam,
  onNavigateToGame,
  onNavigateToTournament
}: PlayerPageProps) {
  
  // Get player games and stats
  const playerGames = games.filter(game => 
    game.gameStats.some(stat => stat.playerId === player.id)
  );
  
  const playerGameStats = playerGames.map(game => {
    const stats = game.gameStats.find(stat => stat.playerId === player.id);
    return {
      game,
      stats: stats || MetricsCalculator.getEmptyStats(player.id)
    };
  });
  
  // Calculate season totals and averages
  const calculateSeasonStats = () => {
    if (playerGameStats.length === 0) {
      return {
        totals: MetricsCalculator.getEmptyStats(player.id),
        averages: MetricsCalculator.getEmptyStats(player.id),
        gamesPlayed: 0
      };
    }
    
    const totals = playerGameStats.reduce((acc, { stats }) => {
      Object.keys(stats).forEach(key => {
        if (key !== 'playerId' && typeof stats[key as keyof GameStats] === 'number') {
          (acc as any)[key] += (stats as any)[key];
        }
      });
      return acc;
    }, MetricsCalculator.getEmptyStats(player.id));
    
    const gamesPlayed = playerGameStats.length;
    const averages = { ...totals };
    
    // Calculate averages
    Object.keys(averages).forEach(key => {
      if (key !== 'playerId' && typeof averages[key as keyof GameStats] === 'number') {
        (averages as any)[key] = (averages as any)[key] / gamesPlayed;
      }
    });
    
    return { totals, averages, gamesPlayed };
  };
  
  // Get recent performance
  const getRecentPerformance = () => {
    return playerGameStats.slice().reverse().slice(0, 5);
  };
  
  // Calculate advanced metrics
  const { totals, averages, gamesPlayed } = calculateSeasonStats();
  const advanced = MetricsCalculator.calculateAdvancedMetrics(totals, gamesPlayed);
  const recentGames = getRecentPerformance();
  
  // Get current tournament
  const currentTournament = team.currentTournamentId 
    ? tournaments.find(t => t.id === team.currentTournamentId)
    : null;
  
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Player Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="text-2xl">
                {player.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{player.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <span>#{player.number}</span>
                <span>{player.position}</span>
                {player.height && (
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3 h-3" />
                    {player.height}
                  </span>
                )}
                {player.weight && (
                  <span className="flex items-center gap-1">
                    <Weight className="w-3 h-3" />
                    {player.weight}
                  </span>
                )}
                {player.age && <span>{player.age} years old</span>}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Badge 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={() => onNavigateToTeam(team.id)}
                >
                  {team.name}
                </Badge>
                {currentTournament && (
                  <Badge 
                    variant="default" 
                    className="cursor-pointer"
                    onClick={() => onNavigateToTournament(currentTournament.id)}
                  >
                    <Trophy className="w-3 h-3 mr-1" />
                    {currentTournament.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Season Stats Overview */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{gamesPlayed}</div>
            <div className="text-sm text-muted-foreground mt-1">Games</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{averages.points.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-1">PPG</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{(averages.orb + averages.drb).toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-1">RPG</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{averages.assists.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-1">APG</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{advanced.fieldGoalPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground mt-1">FG%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{advanced.threePointPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground mt-1">3P%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{advanced.freeThrowPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground mt-1">FT%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-3 text-center flex flex-col items-center justify-center">
            <div className="text-2xl font-bold leading-none">{(advanced.gameScore / (gamesPlayed || 1)).toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-1">GmSc</div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Efficiency (EFF)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{advanced.efficiency.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Points + Rebounds + Assists + Steals + Blocks - Misses - Turnovers
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Medal className="w-4 h-4" />
              Game Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{advanced.gameScore.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Hollinger's comprehensive performance metric
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Index of Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{advanced.indexOfSuccess.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              European-style comprehensive index
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Games */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Performance
            </div>
            <Button variant="ghost" size="sm" onClick={() => onTabChange('gamelog')}>
              View All Games
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentGames.map(({ game, stats }) => {
              const isHome = game.homeTeamId === team.id;
              const opponent = isHome ? game.awayTeam : game.homeTeam;
              const gameAdvanced = MetricsCalculator.calculateAdvancedMetrics(stats);
              
              return (
                <div 
                  key={game.id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onNavigateToGame(game.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">
                        {new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs">
                        {isHome ? 'vs' : '@'} {opponent.name.substring(0, 8)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold">{stats.points}</div>
                      <div className="text-xs text-muted-foreground">PTS</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{stats.orb + stats.drb}</div>
                      <div className="text-xs text-muted-foreground">REB</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{stats.assists}</div>
                      <div className="text-xs text-muted-foreground">AST</div>
                    </div>
                    <div className="text-center">
                      <Badge variant={gameAdvanced.efficiency >= 15 ? "default" : "secondary"} className="text-xs">
                        {gameAdvanced.efficiency.toFixed(0)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">EFF</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const GameLogTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Opponent</TableHead>
                <TableHead className="text-center">MIN</TableHead>
                <TableHead className="text-center">PTS</TableHead>
                <TableHead className="text-center">REB</TableHead>
                <TableHead className="text-center">AST</TableHead>
                <TableHead className="text-center">STL</TableHead>
                <TableHead className="text-center">BLK</TableHead>
                <TableHead className="text-center">TO</TableHead>
                <TableHead className="text-center">FG%</TableHead>
                <TableHead className="text-center">3P%</TableHead>
                <TableHead className="text-center">FT%</TableHead>
                <TableHead className="text-center">+/-</TableHead>
                <TableHead className="text-center">EFF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playerGameStats.slice().reverse().map(({ game, stats }) => {
                const isHome = game.homeTeamId === team.id;
                const opponent = isHome ? game.awayTeam : game.homeTeam;
                const gameAdvanced = MetricsCalculator.calculateAdvancedMetrics(stats);
                const tournament = game.tournamentId ? tournaments.find(t => t.id === game.tournamentId) : null;
                
                return (
                  <TableRow 
                    key={game.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onNavigateToGame(game.id)}
                  >
                    <TableCell>
                      <div>
                        <div className="text-sm">{new Date(game.date).toLocaleDateString()}</div>
                        {tournament && (
                          <div className="text-xs text-muted-foreground">{tournament.name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isHome ? 'vs' : '@'} {opponent.name}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {Math.floor(stats.minutes_played)}:{((stats.minutes_played % 1) * 60).toFixed(0).padStart(2, '0')}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">{stats.points}</TableCell>
                    <TableCell className="text-center font-mono">{stats.orb + stats.drb}</TableCell>
                    <TableCell className="text-center font-mono">{stats.assists}</TableCell>
                    <TableCell className="text-center font-mono">{stats.steals}</TableCell>
                    <TableCell className="text-center font-mono">{stats.blocks}</TableCell>
                    <TableCell className="text-center font-mono">{stats.turnovers}</TableCell>
                    <TableCell className="text-center font-mono">
                      {gameAdvanced.fieldGoalPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {gameAdvanced.threePointPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {gameAdvanced.freeThrowPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge variant={stats.plus_minus >= 0 ? "default" : "destructive"} className="text-xs">
                        {stats.plus_minus >= 0 ? '+' : ''}{stats.plus_minus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge variant={gameAdvanced.efficiency >= 15 ? "default" : "secondary"} className="text-xs">
                        {gameAdvanced.efficiency.toFixed(0)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const AdvancedTab = () => (
    <div className="space-y-6">
      {/* Shooting Splits */}
      <Card>
        <CardHeader>
          <CardTitle>Shooting Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Field Goals</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Made/Attempted</span>
                  <span className="text-sm font-mono">{totals.fg_made.toFixed(0)}/{totals.fg_attempted.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Percentage</span>
                  <span className="text-sm font-mono">{advanced.fieldGoalPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Per Game</span>
                  <span className="text-sm font-mono">{averages.fg_made.toFixed(1)}/{averages.fg_attempted.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Three-Pointers</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Made/Attempted</span>
                  <span className="text-sm font-mono">{totals.three_made.toFixed(0)}/{totals.three_attempted.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Percentage</span>
                  <span className="text-sm font-mono">{advanced.threePointPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Per Game</span>
                  <span className="text-sm font-mono">{averages.three_made.toFixed(1)}/{averages.three_attempted.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Free Throws</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Made/Attempted</span>
                  <span className="text-sm font-mono">{totals.ft_made.toFixed(0)}/{totals.ft_attempted.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Percentage</span>
                  <span className="text-sm font-mono">{advanced.freeThrowPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Per Game</span>
                  <span className="text-sm font-mono">{averages.ft_made.toFixed(1)}/{averages.ft_attempted.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Efficiency Metrics</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Efficiency (EFF)</span>
                  <Badge variant={advanced.efficiency >= 15 ? "default" : "secondary"}>
                    {advanced.efficiency.toFixed(1)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Game Score (GmSc)</span>
                  <Badge variant={advanced.gameScore >= 15 ? "default" : "secondary"}>
                    {advanced.gameScore.toFixed(1)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Index of Success (IoS)</span>
                  <Badge variant={advanced.indexOfSuccess >= 15 ? "default" : "secondary"}>
                    {advanced.indexOfSuccess.toFixed(1)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Per Game Averages</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Minutes</span>
                  <span className="text-sm font-mono">{averages.minutes_played.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Plus/Minus</span>
                  <span className="text-sm font-mono">
                    {averages.plus_minus >= 0 ? '+' : ''}{averages.plus_minus.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Turnovers</span>
                  <span className="text-sm font-mono">{averages.turnovers.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Personal Fouls</span>
                  <span className="text-sm font-mono">{averages.fouls.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Defensive Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Defensive & Physical Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{averages.steals.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Steals per game</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{averages.blocks.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Blocks per game</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{averages.fouls_drawn.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Fouls drawn per game</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{averages.blocks_received.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Shots blocked per game</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarFallback>
              {player.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <p className="text-sm text-muted-foreground">
              #{player.number} • {player.position} • {team.name}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gamelog">Game Log</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="gamelog">
          <GameLogTab />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}