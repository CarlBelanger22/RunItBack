import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Game } from '../App';
import { 
  Calendar, 
  Search, 
  Filter, 
  Trophy, 
  TrendingUp, 
  Users, 
  Target,
  Clock,
  ChevronRight,
  Download,
  Archive
} from 'lucide-react';

interface SeasonHistoryProps {
  games: Game[];
  onGameSelect: (game: Game) => void;
}

export function SeasonHistory({ games, onGameSelect }: SeasonHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  // Get unique teams from all games
  const allTeams = Array.from(new Set([
    ...games.map(g => g.homeTeam.name),
    ...games.map(g => g.awayTeam.name)
  ])).filter(Boolean);

  // Filter games based on search and filters
  const filteredGames = games.filter(game => {
    const matchesSearch = searchTerm === '' || 
      game.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = teamFilter === 'all' || 
      game.homeTeam.name === teamFilter || 
      game.awayTeam.name === teamFilter;

    return matchesSearch && matchesTeam;
  });

  // Calculate game totals
  const getGameTotals = (game: Game) => {
    const homeTotal = game.gameStats
      .filter(stat => game.homeTeam.players.some(p => p.id === stat.playerId))
      .reduce((sum, stat) => sum + stat.points, 0);
    
    const awayTotal = game.gameStats
      .filter(stat => game.awayTeam.players.some(p => p.id === stat.playerId))
      .reduce((sum, stat) => sum + stat.points, 0);

    return { homeTotal, awayTotal };
  };

  // Calculate season averages
  const calculateSeasonAverages = () => {
    if (games.length === 0) return null;

    const totalStats = games.reduce((acc, game) => {
      const gameStats = game.gameStats.reduce((gameAcc, stat) => ({
        points: gameAcc.points + stat.points,
        rebounds: gameAcc.rebounds + stat.rebounds,
        assists: gameAcc.assists + stat.assists,
        steals: gameAcc.steals + stat.steals,
        blocks: gameAcc.blocks + stat.blocks,
        turnovers: gameAcc.turnovers + stat.turnovers,
        fg_made: gameAcc.fg_made + stat.fg_made,
        fg_attempted: gameAcc.fg_attempted + stat.fg_attempted
      }), {
        points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, 
        turnovers: 0, fg_made: 0, fg_attempted: 0
      });

      return {
        points: acc.points + gameStats.points,
        rebounds: acc.rebounds + gameStats.rebounds,
        assists: acc.assists + gameStats.assists,
        steals: acc.steals + gameStats.steals,
        blocks: acc.blocks + gameStats.blocks,
        turnovers: acc.turnovers + gameStats.turnovers,
        fg_made: acc.fg_made + gameStats.fg_made,
        fg_attempted: acc.fg_attempted + gameStats.fg_attempted
      };
    }, {
      points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, 
      turnovers: 0, fg_made: 0, fg_attempted: 0
    });

    return {
      pointsPerGame: totalStats.points / games.length,
      reboundsPerGame: totalStats.rebounds / games.length,
      assistsPerGame: totalStats.assists / games.length,
      stealsPerGame: totalStats.steals / games.length,
      blocksPerGame: totalStats.blocks / games.length,
      turnoversPerGame: totalStats.turnovers / games.length,
      fieldGoalPercentage: totalStats.fg_attempted > 0 ? (totalStats.fg_made / totalStats.fg_attempted) * 100 : 0
    };
  };

  const seasonAverages = calculateSeasonAverages();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Season Overview */}
      {seasonAverages && (
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Season Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{games.length}</div>
                <div className="text-sm text-muted-foreground">Games</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{seasonAverages.pointsPerGame.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">PPG</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{seasonAverages.reboundsPerGame.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">RPG</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{seasonAverages.assistsPerGame.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">APG</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{seasonAverages.stealsPerGame.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">SPG</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{seasonAverages.blocksPerGame.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">BPG</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {seasonAverages.fieldGoalPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">FG%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Game History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Games</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by team name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Team</label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {allTeams.map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Games List */}
      {filteredGames.length === 0 ? (
        <Card className="shadow-lg rounded-2xl">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No Games Found</h3>
            <p className="text-sm text-muted-foreground">
              {games.length === 0 
                ? "You haven't played any games yet. Start by setting up a new game!"
                : "No games match your current search criteria."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg rounded-2xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead className="text-center w-24">Score</TableHead>
                    <TableHead className="text-center w-20">Status</TableHead>
                    <TableHead className="text-center w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGames.map((game) => {
                    const { homeTotal, awayTotal } = getGameTotals(game);
                    const winner = homeTotal > awayTotal ? 'home' : awayTotal > homeTotal ? 'away' : 'tie';
                    
                    return (
                      <TableRow key={game.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {formatDate(game.date)}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="text-sm">
                              <span className={winner === 'home' ? 'font-medium' : ''}>{game.homeTeam.name}</span>
                              <span className="text-muted-foreground mx-2">vs</span>
                              <span className={winner === 'away' ? 'font-medium' : ''}>{game.awayTeam.name}</span>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center font-mono">
                          <div className="flex items-center justify-center gap-2">
                            <span className={winner === 'home' ? 'font-bold text-green-600' : ''}>{homeTotal}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className={winner === 'away' ? 'font-bold text-green-600' : ''}>{awayTotal}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <Badge variant={game.isActive ? "default" : "secondary"}>
                            {game.isActive ? 'Live' : 'Final'}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onGameSelect(game)}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Games Quick Stats */}
      {filteredGames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5" />
                Recent Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredGames.slice(-5).reverse().map((game) => {
                  const { homeTotal, awayTotal } = getGameTotals(game);
                  return (
                    <div key={game.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="text-sm">
                        <div className="font-medium">{game.homeTeam.name} vs {game.awayTeam.name}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(game.date)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{homeTotal} - {awayTotal}</div>
                        <Badge variant="outline" className="text-xs">
                          {homeTotal > awayTotal ? 'W' : homeTotal < awayTotal ? 'L' : 'T'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  // Get all player stats across all games
                  const allPlayerStats = games.flatMap(game => 
                    game.gameStats.map(stat => {
                      const player = [...game.homeTeam.players, ...game.awayTeam.players]
                        .find(p => p.id === stat.playerId);
                      return {
                        ...stat,
                        name: player?.name || 'Unknown',
                        number: player?.number || 0,
                        gameDate: game.date
                      };
                    })
                  );

                  // Group by player and calculate totals
                  const playerTotals = allPlayerStats.reduce((acc, stat) => {
                    const key = `${stat.name}-${stat.number}`;
                    if (!acc[key]) {
                      acc[key] = { name: stat.name, number: stat.number, points: 0, games: 0 };
                    }
                    acc[key].points += stat.points;
                    acc[key].games += 1;
                    return acc;
                  }, {} as Record<string, { name: string; number: number; points: number; games: number }>);

                  // Get top 5 scorers
                  return Object.values(playerTotals)
                    .sort((a, b) => (b.points / b.games) - (a.points / a.games))
                    .slice(0, 5)
                    .map((player, index) => (
                      <div key={`${player.name}-${player.number}`} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                          <div>
                            <div className="text-sm font-medium">#{player.number} {player.name}</div>
                            <div className="text-xs text-muted-foreground">{player.games} games</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{(player.points / player.games).toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">PPG</div>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" />
                Game Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Win Rate</span>
                    <span className="font-medium">
                      {(() => {
                        const wins = games.filter(game => {
                          const { homeTotal, awayTotal } = getGameTotals(game);
                          return homeTotal > awayTotal;
                        }).length;
                        return games.length > 0 ? `${((wins / games.length) * 100).toFixed(0)}%` : '0%';
                      })()}
                    </span>
                  </div>
                  <Progress 
                    value={games.length > 0 ? (games.filter(game => {
                      const { homeTotal, awayTotal } = getGameTotals(game);
                      return homeTotal > awayTotal;
                    }).length / games.length) * 100 : 0}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Avg Points</span>
                    <span className="font-medium">{seasonAverages.pointsPerGame.toFixed(1)}</span>
                  </div>
                  <Progress 
                    value={Math.min(100, (seasonAverages.pointsPerGame / 100) * 100)}
                    className="h-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Field Goal %</span>
                    <span className="font-medium">{seasonAverages.fieldGoalPercentage.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={seasonAverages.fieldGoalPercentage}
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}