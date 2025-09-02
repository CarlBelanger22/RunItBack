import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Game, GameStats, TeamStats } from '../App';
import { MetricsCalculator, AdvancedMetrics } from './MetricsCalculator';
import { TrendingUp, Users, Calculator, Download, Trophy, Target, Activity } from 'lucide-react';

interface BoxScoreProps {
  game: Game;
}

interface PlayerBoxScore extends GameStats {
  name: string;
  number: number;
  position: string;
  advanced: AdvancedMetrics;
}

export function BoxScore({ game }: BoxScoreProps) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [view, setView] = useState<'traditional' | 'advanced' | 'team'>('traditional');

  const getPlayerBoxScore = (playerId: string): GameStats => {
    const stats = game.gameStats.find(s => s.playerId === playerId);
    return stats || MetricsCalculator.getEmptyStats(playerId);
  };

  const getTeamBoxScore = (teamType: 'home' | 'away'): PlayerBoxScore[] => {
    const team = teamType === 'home' ? game.homeTeam : game.awayTeam;
    
    return team.players.map(player => {
      const stats = getPlayerBoxScore(player.id);
      const advanced = MetricsCalculator.calculateAdvancedMetrics(stats);
      
      return {
        ...stats,
        name: player.name,
        number: player.number,
        position: player.position,
        advanced
      };
    });
  };

  const getTeamTotals = (teamType: 'home' | 'away') => {
    const boxScore = getTeamBoxScore(teamType);
    
    return boxScore.reduce((totals, player) => ({
      points: totals.points + player.points,
      fg_made: totals.fg_made + player.fg_made,
      fg_attempted: totals.fg_attempted + player.fg_attempted,
      three_made: totals.three_made + player.three_made,
      three_attempted: totals.three_attempted + player.three_attempted,
      ft_made: totals.ft_made + player.ft_made,
      ft_attempted: totals.ft_attempted + player.ft_attempted,
      orb: totals.orb + player.orb,
      drb: totals.drb + player.drb,
      assists: totals.assists + player.assists,
      steals: totals.steals + player.steals,
      blocks: totals.blocks + player.blocks,
      turnovers: totals.turnovers + player.turnovers,
      fouls: totals.fouls + player.fouls,
      tech_fouls: totals.tech_fouls + player.tech_fouls,
      unsportsmanlike_fouls: totals.unsportsmanlike_fouls + player.unsportsmanlike_fouls,
      fouls_drawn: totals.fouls_drawn + player.fouls_drawn,
      blocks_received: totals.blocks_received + player.blocks_received,
      plus_minus: totals.plus_minus + player.plus_minus,
      minutes_played: totals.minutes_played + player.minutes_played,
    }), MetricsCalculator.getEmptyStats('team-total'));
  };

  const formatPercentage = (value: number) => {
    return value > 0 ? `${value.toFixed(1)}%` : '0.0%';
  };

  const formatStat = (value: number, decimals: number = 1) => {
    return value > 0 ? value.toFixed(decimals) : '0';
  };

  const formatTime = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const homeBoxScore = getTeamBoxScore('home');
  const awayBoxScore = getTeamBoxScore('away');
  const homeTotals = getTeamTotals('home');
  const awayTotals = getTeamTotals('away');

  const TraditionalStatsTable = ({ players, teamName }: { players: PlayerBoxScore[], teamName: string }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{teamName}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {players.reduce((sum, p) => sum + p.points, 0)} PTS
          </Badge>
          <Button size="sm" variant="ghost">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-32">Player</TableHead>
              <TableHead className="text-center w-16">Min</TableHead>
              <TableHead className="text-center w-12">PTS</TableHead>
              <TableHead className="text-center w-20">FG</TableHead>
              <TableHead className="text-center w-16">FG%</TableHead>
              <TableHead className="text-center w-20">3P</TableHead>
              <TableHead className="text-center w-16">3P%</TableHead>
              <TableHead className="text-center w-20">FT</TableHead>
              <TableHead className="text-center w-16">FT%</TableHead>
              <TableHead className="text-center w-12">ORB</TableHead>
              <TableHead className="text-center w-12">DRB</TableHead>
              <TableHead className="text-center w-12">REB</TableHead>
              <TableHead className="text-center w-12">AST</TableHead>
              <TableHead className="text-center w-12">STL</TableHead>
              <TableHead className="text-center w-12">BLK</TableHead>
              <TableHead className="text-center w-12">TO</TableHead>
              <TableHead className="text-center w-12">PF</TableHead>
              <TableHead className="text-center w-12">+/-</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.playerId} className="text-sm">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">#{player.number}</Badge>
                    <div>
                      <div className="font-medium text-sm">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono">{formatTime(player.minutes_played)}</TableCell>
                <TableCell className="text-center font-mono font-medium">{player.points}</TableCell>
                <TableCell className="text-center font-mono">{player.fg_made}/{player.fg_attempted}</TableCell>
                <TableCell className="text-center font-mono">{formatPercentage(player.advanced.fieldGoalPercentage)}</TableCell>
                <TableCell className="text-center font-mono">{player.three_made}/{player.three_attempted}</TableCell>
                <TableCell className="text-center font-mono">{formatPercentage(player.advanced.threePointPercentage)}</TableCell>
                <TableCell className="text-center font-mono">{player.ft_made}/{player.ft_attempted}</TableCell>
                <TableCell className="text-center font-mono">{formatPercentage(player.advanced.freeThrowPercentage)}</TableCell>
                <TableCell className="text-center font-mono">{player.orb}</TableCell>
                <TableCell className="text-center font-mono">{player.drb}</TableCell>
                <TableCell className="text-center font-mono font-medium">{player.advanced.totalRebounds}</TableCell>
                <TableCell className="text-center font-mono">{player.assists}</TableCell>
                <TableCell className="text-center font-mono">{player.steals}</TableCell>
                <TableCell className="text-center font-mono">{player.blocks}</TableCell>
                <TableCell className="text-center font-mono">{player.turnovers}</TableCell>
                <TableCell className="text-center font-mono">{player.fouls}</TableCell>
                <TableCell className="text-center font-mono">
                  <Badge variant={player.plus_minus >= 0 ? "default" : "destructive"} className="text-xs">
                    {player.plus_minus >= 0 ? '+' : ''}{player.plus_minus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            
            {/* Totals Row */}
            <TableRow className="font-medium bg-muted/50 text-sm border-t-2">
              <TableCell>TEAM TOTALS</TableCell>
              <TableCell className="text-center font-mono">{formatTime(homeTotals.minutes_played)}</TableCell>
              <TableCell className="text-center font-mono font-bold">{homeTotals.points}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.fg_made}/{homeTotals.fg_attempted}</TableCell>
              <TableCell className="text-center font-mono">
                {formatPercentage(homeTotals.fg_attempted > 0 ? (homeTotals.fg_made / homeTotals.fg_attempted) * 100 : 0)}
              </TableCell>
              <TableCell className="text-center font-mono">{homeTotals.three_made}/{homeTotals.three_attempted}</TableCell>
              <TableCell className="text-center font-mono">
                {formatPercentage(homeTotals.three_attempted > 0 ? (homeTotals.three_made / homeTotals.three_attempted) * 100 : 0)}
              </TableCell>
              <TableCell className="text-center font-mono">{homeTotals.ft_made}/{homeTotals.ft_attempted}</TableCell>
              <TableCell className="text-center font-mono">
                {formatPercentage(homeTotals.ft_attempted > 0 ? (homeTotals.ft_made / homeTotals.ft_attempted) * 100 : 0)}
              </TableCell>
              <TableCell className="text-center font-mono">{homeTotals.orb}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.drb}</TableCell>
              <TableCell className="text-center font-mono font-bold">{homeTotals.orb + homeTotals.drb}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.assists}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.steals}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.blocks}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.turnovers}</TableCell>
              <TableCell className="text-center font-mono">{homeTotals.fouls}</TableCell>
              <TableCell className="text-center font-mono">
                <Badge variant={homeTotals.plus_minus >= 0 ? "default" : "destructive"} className="text-xs">
                  {homeTotals.plus_minus >= 0 ? '+' : ''}{homeTotals.plus_minus}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const AdvancedStatsTable = ({ players, teamName }: { players: PlayerBoxScore[], teamName: string }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{teamName} - Advanced Metrics</h3>
        <Badge variant="secondary" className="text-xs">EFF • GmSc • IoS</Badge>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-32">Player</TableHead>
              <TableHead className="text-center w-16">Min</TableHead>
              <TableHead className="text-center w-16">EFF</TableHead>
              <TableHead className="text-center w-16">GmSc</TableHead>
              <TableHead className="text-center w-16">IoS</TableHead>
              <TableHead className="text-center w-16">2P%</TableHead>
              <TableHead className="text-center w-20">2P</TableHead>
              <TableHead className="text-center w-16">FD</TableHead>
              <TableHead className="text-center w-16">BR</TableHead>
              <TableHead className="text-center w-16">TF</TableHead>
              <TableHead className="text-center w-16">UF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.playerId} className="text-sm">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">#{player.number}</Badge>
                    <div>
                      <div className="font-medium text-sm">{player.name}</div>
                      <div className="text-xs text-muted-foreground">{player.position}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono">{formatTime(player.minutes_played)}</TableCell>
                <TableCell className="text-center font-mono">
                  <Badge variant={player.advanced.efficiency >= 15 ? "default" : player.advanced.efficiency >= 10 ? "secondary" : "outline"} className="text-xs">
                    {formatStat(player.advanced.efficiency, 0)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono">
                  <Badge variant={player.advanced.gameScore >= 15 ? "default" : player.advanced.gameScore >= 10 ? "secondary" : "outline"} className="text-xs">
                    {formatStat(player.advanced.gameScore)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono">
                  <Badge variant={player.advanced.indexOfSuccess >= 15 ? "default" : player.advanced.indexOfSuccess >= 10 ? "secondary" : "outline"} className="text-xs">
                    {formatStat(player.advanced.indexOfSuccess, 0)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono">{formatPercentage(player.advanced.twoPointPercentage)}</TableCell>
                <TableCell className="text-center font-mono">{player.advanced.twoPointMade}/{player.advanced.twoPointAttempted}</TableCell>
                <TableCell className="text-center font-mono">{player.fouls_drawn}</TableCell>
                <TableCell className="text-center font-mono">{player.blocks_received}</TableCell>
                <TableCell className="text-center font-mono">{player.tech_fouls}</TableCell>
                <TableCell className="text-center font-mono">{player.unsportsmanlike_fouls}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const TeamStatsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Home Team Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              {game.homeTeam.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {game.teamStats?.home && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Points Off Turnovers</div>
                  <div className="font-bold text-lg">{game.teamStats.home.points_off_turnovers}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Points in Paint</div>
                  <div className="font-bold text-lg">{game.teamStats.home.points_in_paint}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Second Chance Points</div>
                  <div className="font-bold text-lg">{game.teamStats.home.second_chance_points}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Fastbreak Points</div>
                  <div className="font-bold text-lg">{game.teamStats.home.fastbreak_points}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bench Points</div>
                  <div className="font-bold text-lg">{game.teamStats.home.bench_points}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Biggest Lead</div>
                  <div className="font-bold text-lg">{game.teamStats.home.biggest_lead}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Biggest Run</div>
                  <div className="font-bold text-lg">{game.teamStats.home.biggest_scoring_run}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Team Rebounds</div>
                  <div className="font-bold text-lg">{game.teamStats.home.team_rebounds}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Away Team Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              {game.awayTeam.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {game.teamStats?.away && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Points Off Turnovers</div>
                  <div className="font-bold text-lg">{game.teamStats.away.points_off_turnovers}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Points in Paint</div>
                  <div className="font-bold text-lg">{game.teamStats.away.points_in_paint}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Second Chance Points</div>
                  <div className="font-bold text-lg">{game.teamStats.away.second_chance_points}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Fastbreak Points</div>
                  <div className="font-bold text-lg">{game.teamStats.away.fastbreak_points}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bench Points</div>
                  <div className="font-bold text-lg">{game.teamStats.away.bench_points}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Biggest Lead</div>
                  <div className="font-bold text-lg">{game.teamStats.away.biggest_lead}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Biggest Run</div>
                  <div className="font-bold text-lg">{game.teamStats.away.biggest_scoring_run}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Team Rebounds</div>
                  <div className="font-bold text-lg">{game.teamStats.away.team_rebounds}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Game Summary */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Box Score - {new Date(game.date).toLocaleDateString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <h3 className="font-medium text-lg">{game.homeTeam.name}</h3>
              <div className="text-3xl font-bold text-primary mt-2">{homeTotals.points}</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-muted-foreground">vs</div>
            </div>
            <div>
              <h3 className="font-medium text-lg">{game.awayTeam.name}</h3>
              <div className="text-3xl font-bold text-primary mt-2">{awayTotals.points}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button 
          variant={view === 'traditional' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setView('traditional')}
        >
          <Target className="w-4 h-4 mr-2" />
          Traditional
        </Button>
        <Button 
          variant={view === 'advanced' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setView('advanced')}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Advanced
        </Button>
        <Button 
          variant={view === 'team' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setView('team')}
        >
          <Activity className="w-4 h-4 mr-2" />
          Team Stats
        </Button>
      </div>

      {view === 'team' ? (
        <TeamStatsView />
      ) : (
        <Tabs value={selectedTeam} onValueChange={(value) => setSelectedTeam(value as 'home' | 'away')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="home" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {game.homeTeam.name}
            </TabsTrigger>
            <TabsTrigger value="away" disabled={game.awayTeam.players.length === 0} className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {game.awayTeam.name}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <Card className="shadow-lg rounded-2xl">
              <CardContent className="p-6">
                {view === 'traditional' ? (
                  <TraditionalStatsTable players={homeBoxScore} teamName={game.homeTeam.name} />
                ) : (
                  <AdvancedStatsTable players={homeBoxScore} teamName={game.homeTeam.name} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="away">
            <Card className="shadow-lg rounded-2xl">
              <CardContent className="p-6">
                {view === 'traditional' ? (
                  <TraditionalStatsTable players={awayBoxScore} teamName={game.awayTeam.name} />
                ) : (
                  <AdvancedStatsTable players={awayBoxScore} teamName={game.awayTeam.name} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Leading Scorer</div>
          <div className="font-medium">
            {homeBoxScore.length > 0 && 
              (() => {
                const topScorer = [...homeBoxScore, ...awayBoxScore].reduce((max, player) => 
                  player.points > max.points ? player : max
                );
                return `${topScorer.name} (${topScorer.points}pts)`;
              })()
            }
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Most Assists</div>
          <div className="font-medium">
            {homeBoxScore.length > 0 && 
              (() => {
                const topAssists = [...homeBoxScore, ...awayBoxScore].reduce((max, player) => 
                  player.assists > max.assists ? player : max
                );
                return `${topAssists.name} (${topAssists.assists})`;
              })()
            }
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Most Rebounds</div>
          <div className="font-medium">
            {homeBoxScore.length > 0 && 
              (() => {
                const topRebounds = [...homeBoxScore, ...awayBoxScore].reduce((max, player) => 
                  player.advanced.totalRebounds > max.advanced.totalRebounds ? player : max
                );
                return `${topRebounds.name} (${topRebounds.advanced.totalRebounds})`;
              })()
            }
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-sm text-muted-foreground">Best Efficiency</div>
          <div className="font-medium">
            {homeBoxScore.length > 0 && 
              (() => {
                const topEff = [...homeBoxScore, ...awayBoxScore].reduce((max, player) => 
                  player.advanced.efficiency > max.advanced.efficiency ? player : max
                );
                return `${topEff.name} (${topEff.advanced.efficiency.toFixed(0)})`;
              })()
            }
          </div>
        </Card>
      </div>
    </div>
  );
}