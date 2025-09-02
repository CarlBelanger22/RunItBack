import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Team, Game, Player, GameStats, Tournament } from '../App';
import { MetricsCalculator } from './MetricsCalculator';
import { 
  ArrowLeft,
  Users, 
  BarChart3, 
  Calendar,
  User,
  Trophy,
  Target,
  Activity,
  TrendingUp,
  Medal,
  Crown,
  Star,
  MapPin
} from 'lucide-react';

interface TeamPageProps {
  team: Team;
  games: Game[];
  tournaments: Tournament[];
  activeTab: 'overview' | 'roster' | 'stats' | 'games';
  onTabChange: (tab: 'overview' | 'roster' | 'stats' | 'games') => void;
  onBack: () => void;
  onNavigateToPlayer: (playerId: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onNavigateToTournament: (tournamentId: string) => void;
}

export function TeamPage({ 
  team, 
  games, 
  tournaments,
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToPlayer,
  onNavigateToGame,
  onNavigateToTournament
}: TeamPageProps) {
  
  // Get team games
  const teamGames = games.filter(game => 
    game.homeTeamId === team.id || game.awayTeamId === team.id
  );
  
  // Get current tournament
  const currentTournament = team.currentTournamentId 
    ? tournaments.find(t => t.id === team.currentTournamentId)
    : null;
  
  // Calculate team record
  const calculateRecord = () => {
    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    
    teamGames.forEach(game => {
      if (!game.finalScore) return;
      
      const isHome = game.homeTeamId === team.id;
      const teamScore = isHome ? game.finalScore.home : game.finalScore.away;
      const opponentScore = isHome ? game.finalScore.away : game.finalScore.home;
      
      pointsFor += teamScore;
      pointsAgainst += opponentScore;
      
      if (teamScore > opponentScore) wins++;
      else losses++;
    });
    
    const gamesPlayed = wins + losses;
    const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
    const pointsDiff = gamesPlayed > 0 ? (pointsFor - pointsAgainst) / gamesPlayed : 0;
    
    return {
      wins,
      losses,
      gamesPlayed,
      winPercentage,
      pointsFor,
      pointsAgainst,
      pointsDiff,
      ppg: gamesPlayed > 0 ? pointsFor / gamesPlayed : 0,
      papg: gamesPlayed > 0 ? pointsAgainst / gamesPlayed : 0
    };
  };
  
  // Get team leaders
  const getTeamLeaders = () => {
    const playerTotals = new Map<string, { 
      player: Player; 
      totalStats: GameStats; 
      gamesPlayed: number; 
    }>();
    
    teamGames.forEach(game => {
      game.gameStats.forEach(stat => {
        const player = team.players.find(p => p.id === stat.playerId);
        if (!player) return;
        
        const existing = playerTotals.get(player.id);
        if (existing) {
          // Aggregate stats
          Object.keys(stat).forEach(key => {
            if (key !== 'playerId' && typeof stat[key as keyof GameStats] === 'number') {
              (existing.totalStats as any)[key] += (stat as any)[key];
            }
          });
          existing.gamesPlayed++;
        } else {
          playerTotals.set(player.id, {
            player,
            totalStats: { ...stat },
            gamesPlayed: 1
          });
        }
      });
    });
    
    const playersArray = Array.from(playerTotals.values());
    
    return {
      points: playersArray.sort((a, b) => (b.totalStats.points / b.gamesPlayed) - (a.totalStats.points / a.gamesPlayed))[0],
      rebounds: playersArray.sort((a, b) => ((b.totalStats.orb + b.totalStats.drb) / b.gamesPlayed) - ((a.totalStats.orb + a.totalStats.drb) / a.gamesPlayed))[0],
      assists: playersArray.sort((a, b) => (b.totalStats.assists / b.gamesPlayed) - (a.totalStats.assists / a.gamesPlayed))[0],
      steals: playersArray.sort((a, b) => (b.totalStats.steals / b.gamesPlayed) - (a.totalStats.steals / a.gamesPlayed))[0],
      blocks: playersArray.sort((a, b) => (b.totalStats.blocks / b.gamesPlayed) - (a.totalStats.blocks / a.gamesPlayed))[0],
    };
  };
  
  // Calculate aggregate team stats
  const calculateTeamStats = () => {
    const totalStats = teamGames.reduce((acc, game) => {
      const teamStats = game.homeTeamId === team.id ? game.teamStats.home : game.teamStats.away;
      
      return {
        fg_made: acc.fg_made + teamStats.fg_made,
        fg_attempted: acc.fg_attempted + teamStats.fg_attempted,
        three_made: acc.three_made + teamStats.three_made,
        three_attempted: acc.three_attempted + teamStats.three_attempted,
        ft_made: acc.ft_made + teamStats.ft_made,
        ft_attempted: acc.ft_attempted + teamStats.ft_attempted,
        orb: acc.orb + teamStats.orb,
        drb: acc.drb + teamStats.drb,
        assists: acc.assists + teamStats.assists,
        steals: acc.steals + teamStats.steals,
        blocks: acc.blocks + teamStats.blocks,
        turnovers: acc.turnovers + teamStats.turnovers,
        fouls: acc.fouls + teamStats.fouls,
        points_off_turnovers: acc.points_off_turnovers + teamStats.points_off_turnovers,
        points_in_paint: acc.points_in_paint + teamStats.points_in_paint,
        second_chance_points: acc.second_chance_points + teamStats.second_chance_points,
        fastbreak_points: acc.fastbreak_points + teamStats.fastbreak_points,
        bench_points: acc.bench_points + teamStats.bench_points,
      };
    }, {
      fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
      ft_made: 0, ft_attempted: 0, orb: 0, drb: 0, assists: 0,
      steals: 0, blocks: 0, turnovers: 0, fouls: 0,
      points_off_turnovers: 0, points_in_paint: 0, second_chance_points: 0,
      fastbreak_points: 0, bench_points: 0
    });
    
    const gamesPlayed = teamGames.filter(g => g.isCompleted).length;
    if (gamesPlayed === 0) return totalStats;
    
    // Calculate averages
    Object.keys(totalStats).forEach(key => {
      (totalStats as any)[key] = (totalStats as any)[key] / gamesPlayed;
    });
    
    return totalStats;
  };
  
  const record = calculateRecord();
  const leaders = getTeamLeaders();
  const teamStats = calculateTeamStats();
  
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Team Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="text-2xl">
                {team.icon || team.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{team.name}</h2>
              {team.description && (
                <p className="text-muted-foreground mt-1">{team.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="outline">
                  {team.players.length} Players
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

      {/* Current Season Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{record.wins}-{record.losses}</div>
            <div className="text-sm text-muted-foreground">Record</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{record.winPercentage.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Win %</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{record.ppg.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">PPG</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{record.papg.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">PAPG</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {record.pointsDiff >= 0 ? '+' : ''}{record.pointsDiff.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Point Diff</div>
          </CardContent>
        </Card>
      </div>

      {/* Team Leaders */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { title: 'Points Leader', player: leaders.points, stat: 'points', icon: Target },
          { title: 'Rebounds Leader', player: leaders.rebounds, stat: 'rebounds', icon: Activity },
          { title: 'Assists Leader', player: leaders.assists, stat: 'assists', icon: Users },
          { title: 'Steals Leader', player: leaders.steals, stat: 'steals', icon: TrendingUp },
          { title: 'Blocks Leader', player: leaders.blocks, stat: 'blocks', icon: Crown }
        ].map(({ title, player, stat, icon: Icon }) => (
          <Card key={title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => player && onNavigateToPlayer(player.player.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {player ? (
                <div>
                  <div className="font-medium text-sm">{player.player.name}</div>
                  <div className="text-xs text-muted-foreground">#{player.player.number}</div>
                  <div className="text-lg font-bold mt-1">
                    {stat === 'points' ? (player.totalStats.points / player.gamesPlayed).toFixed(1) :
                     stat === 'rebounds' ? ((player.totalStats.orb + player.totalStats.drb) / player.gamesPlayed).toFixed(1) :
                     stat === 'assists' ? (player.totalStats.assists / player.gamesPlayed).toFixed(1) :
                     stat === 'steals' ? (player.totalStats.steals / player.gamesPlayed).toFixed(1) :
                     (player.totalStats.blocks / player.gamesPlayed).toFixed(1)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Games */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Games
            </div>
            <Button variant="ghost" size="sm" onClick={() => onTabChange('games')}>
              View All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {teamGames.slice().reverse().slice(0, 5).map(game => {
              const isHome = game.homeTeamId === team.id;
              const opponent = isHome ? game.awayTeam : game.homeTeam;
              const teamScore = game.finalScore && (isHome ? game.finalScore.home : game.finalScore.away);
              const opponentScore = game.finalScore && (isHome ? game.finalScore.away : game.finalScore.home);
              const won = teamScore && opponentScore && teamScore > opponentScore;
              
              return (
                <div 
                  key={game.id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onNavigateToGame(game.id)}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={won ? "default" : "destructive"} className="w-6 h-6 p-0 text-xs">
                      {won ? 'W' : 'L'}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {isHome ? 'vs' : '@'} {opponent.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(game.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {game.finalScore && (
                    <Badge variant="outline" className="font-mono">
                      {teamScore}-{opponentScore}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const RosterTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Team Roster</h3>
        <Badge variant="secondary">{team.players.length} Players</Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.players.map(player => {
          // Get player stats for this team
          const playerGameStats = teamGames.flatMap(game => 
            game.gameStats.filter(stat => stat.playerId === player.id)
          );
          
          const gamesPlayed = playerGameStats.length;
          const avgPoints = gamesPlayed > 0 ? 
            playerGameStats.reduce((sum, stat) => sum + stat.points, 0) / gamesPlayed : 0;
          const avgRebounds = gamesPlayed > 0 ? 
            playerGameStats.reduce((sum, stat) => sum + stat.orb + stat.drb, 0) / gamesPlayed : 0;
          const avgAssists = gamesPlayed > 0 ? 
            playerGameStats.reduce((sum, stat) => sum + stat.assists, 0) / gamesPlayed : 0;
          
          return (
            <Card 
              key={player.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigateToPlayer(player.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {player.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-xs text-muted-foreground">
                      #{player.number} • {player.position}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="font-bold">{avgPoints.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">PPG</div>
                  </div>
                  <div>
                    <div className="font-bold">{avgRebounds.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">RPG</div>
                  </div>
                  <div>
                    <div className="font-bold">{avgAssists.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">APG</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const StatsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Shooting</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">FG%</span>
                  <span className="text-sm font-mono">
                    {teamStats.fg_attempted > 0 ? 
                      ((teamStats.fg_made / teamStats.fg_attempted) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">3P%</span>
                  <span className="text-sm font-mono">
                    {teamStats.three_attempted > 0 ? 
                      ((teamStats.three_made / teamStats.three_attempted) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">FT%</span>
                  <span className="text-sm font-mono">
                    {teamStats.ft_attempted > 0 ? 
                      ((teamStats.ft_made / teamStats.ft_attempted) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Rebounds</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">ORB</span>
                  <span className="text-sm font-mono">{teamStats.orb.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">DRB</span>
                  <span className="text-sm font-mono">{teamStats.drb.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total</span>
                  <span className="text-sm font-mono">{(teamStats.orb + teamStats.drb).toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Defense</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Steals</span>
                  <span className="text-sm font-mono">{teamStats.steals.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Blocks</span>
                  <span className="text-sm font-mono">{teamStats.blocks.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Fouls</span>
                  <span className="text-sm font-mono">{teamStats.fouls.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Advanced</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Paint Pts</span>
                  <span className="text-sm font-mono">{teamStats.points_in_paint.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Fastbreak</span>
                  <span className="text-sm font-mono">{teamStats.fastbreak_points.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">2nd Chance</span>
                  <span className="text-sm font-mono">{teamStats.second_chance_points.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const GamesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Opponent</TableHead>
                <TableHead className="text-center">Result</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Tournament</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamGames.slice().reverse().map(game => {
                const isHome = game.homeTeamId === team.id;
                const opponent = isHome ? game.awayTeam : game.homeTeam;
                const teamScore = game.finalScore && (isHome ? game.finalScore.home : game.finalScore.away);
                const opponentScore = game.finalScore && (isHome ? game.finalScore.away : game.finalScore.home);
                const won = teamScore && opponentScore && teamScore > opponentScore;
                const tournament = game.tournamentId ? tournaments.find(t => t.id === game.tournamentId) : null;
                
                return (
                  <TableRow 
                    key={game.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onNavigateToGame(game.id)}
                  >
                    <TableCell>{new Date(game.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {isHome ? 'vs' : '@'} {opponent.name}
                    </TableCell>
                    <TableCell className="text-center">
                      {game.finalScore ? (
                        <Badge variant={won ? "default" : "destructive"}>
                          {won ? 'W' : 'L'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">In Progress</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {game.finalScore ? `${teamScore}-${opponentScore}` : '-'}
                    </TableCell>
                    <TableCell>
                      {tournament ? (
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToTournament(tournament.id);
                          }}
                        >
                          {tournament.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
              {team.icon || team.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <p className="text-sm text-muted-foreground">
              {record.wins}-{record.losses} • {team.players.length} Players
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="stats">Team Stats</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="roster">
          <RosterTab />
        </TabsContent>

        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>

        <TabsContent value="games">
          <GamesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}