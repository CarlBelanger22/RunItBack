import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Game } from '../App';
import { BarChart3, TrendingUp, Users, Award, Target, Activity } from 'lucide-react';

interface TeamStatsProps {
  game: Game;
}

export function TeamStats({ game }: TeamStatsProps) {
  
  // Calculate team statistics
  const calculateTeamStats = (teamType: 'home' | 'away') => {
    const team = teamType === 'home' ? game.homeTeam : game.awayTeam;
    const teamStats = team.players.map(player => {
      return game.gameStats.find(s => s.playerId === player.id) || {
        playerId: player.id,
        points: 0, fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
        ft_made: 0, ft_attempted: 0, rebounds: 0, assists: 0, steals: 0,
        blocks: 0, turnovers: 0, fouls: 0, minutes: 0
      };
    });

    const totals = teamStats.reduce((acc, stat) => ({
      points: acc.points + stat.points,
      fg_made: acc.fg_made + stat.fg_made,
      fg_attempted: acc.fg_attempted + stat.fg_attempted,
      three_made: acc.three_made + stat.three_made,
      three_attempted: acc.three_attempted + stat.three_attempted,
      ft_made: acc.ft_made + stat.ft_made,
      ft_attempted: acc.ft_attempted + stat.ft_attempted,
      rebounds: acc.rebounds + stat.rebounds,
      assists: acc.assists + stat.assists,
      steals: acc.steals + stat.steals,
      blocks: acc.blocks + stat.blocks,
      turnovers: acc.turnovers + stat.turnovers,
      fouls: acc.fouls + stat.fouls,
      minutes: acc.minutes + stat.minutes
    }), {
      points: 0, fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
      ft_made: 0, ft_attempted: 0, rebounds: 0, assists: 0, steals: 0,
      blocks: 0, turnovers: 0, fouls: 0, minutes: 0
    });

    // Advanced metrics
    const assistToTurnoverRatio = totals.turnovers > 0 ? totals.assists / totals.turnovers : totals.assists;
    const effectiveFieldGoalPercentage = totals.fg_attempted > 0 ? 
      ((totals.fg_made + (0.5 * totals.three_made)) / totals.fg_attempted) * 100 : 0;
    const trueShootingPercentage = (totals.fg_attempted + (0.44 * totals.ft_attempted)) > 0 ?
      (totals.points / (2 * (totals.fg_attempted + (0.44 * totals.ft_attempted)))) * 100 : 0;

    // Estimated advanced stats (simplified versions)
    const pointsOffTurnovers = Math.round(totals.steals * 1.2); // Estimate
    const secondChancePoints = Math.round(totals.rebounds * 0.3); // Estimate
    const fastBreakPoints = Math.round(totals.assists * 0.4); // Estimate
    const pointsInPaint = Math.round((totals.fg_made - totals.three_made) * 0.6 * 2); // Estimate
    const benchPoints = Math.round(totals.points * 0.25); // Estimate

    return {
      ...totals,
      assistToTurnoverRatio,
      effectiveFieldGoalPercentage,
      trueShootingPercentage,
      pointsOffTurnovers,
      secondChancePoints,
      fastBreakPoints,
      pointsInPaint,
      benchPoints,
      teamStats
    };
  };

  const homeStats = calculateTeamStats('home');
  const awayStats = calculateTeamStats('away');

  // Prepare data for charts
  const comparisonData = [
    { category: 'Points', home: homeStats.points, away: awayStats.points },
    { category: 'FG%', home: homeStats.fg_attempted > 0 ? (homeStats.fg_made / homeStats.fg_attempted * 100) : 0, away: awayStats.fg_attempted > 0 ? (awayStats.fg_made / awayStats.fg_attempted * 100) : 0 },
    { category: 'Rebounds', home: homeStats.rebounds, away: awayStats.rebounds },
    { category: 'Assists', home: homeStats.assists, away: awayStats.assists },
    { category: 'Steals', home: homeStats.steals, away: awayStats.steals },
    { category: 'Blocks', home: homeStats.blocks, away: awayStats.blocks },
    { category: 'Turnovers', home: homeStats.turnovers, away: awayStats.turnovers }
  ];

  const homeDistribution = [
    { name: '2PT', value: (homeStats.fg_made - homeStats.three_made) * 2, color: '#3b82f6' },
    { name: '3PT', value: homeStats.three_made * 3, color: '#8b5cf6' },
    { name: 'FT', value: homeStats.ft_made, color: '#10b981' }
  ];

  const awayDistribution = [
    { name: '2PT', value: (awayStats.fg_made - awayStats.three_made) * 2, color: '#f59e0b' },
    { name: '3PT', value: awayStats.three_made * 3, color: '#ef4444' },
    { name: 'FT', value: awayStats.ft_made, color: '#06b6d4' }
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, color = "primary" }: { 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    icon: any; 
    color?: string;
  }) => (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}/10`}>
          <Icon className={`w-5 h-5 text-${color}`} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-lg">{value}</div>
          <div className="text-sm text-muted-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );

  const TeamComparison = () => (
    <div className="space-y-6">
      {/* Head-to-Head Comparison */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle>Team Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="home" fill="#3b82f6" name={game.homeTeam.name} />
                <Bar dataKey="away" fill="#f59e0b" name={game.awayTeam.name} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-center">{game.homeTeam.name} Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={homeDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {homeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {homeDistribution.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="text-lg font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-center">{game.awayTeam.name} Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={awayDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {awayDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {awayDistribution.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="text-lg font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const HomeTeamStats = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Points"
          value={homeStats.points}
          icon={Target}
          color="blue"
        />
        <StatCard
          title="Field Goal %"
          value={`${homeStats.fg_attempted > 0 ? ((homeStats.fg_made / homeStats.fg_attempted) * 100).toFixed(1) : '0.0'}%`}
          subtitle={`${homeStats.fg_made}/${homeStats.fg_attempted}`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Assist/TO Ratio"
          value={homeStats.assistToTurnoverRatio.toFixed(1)}
          subtitle={`${homeStats.assists} AST / ${homeStats.turnovers} TO`}
          icon={Activity}
          color="purple"
        />
        <StatCard
          title="True Shooting %"
          value={`${homeStats.trueShootingPercentage.toFixed(1)}%`}
          subtitle="Efficiency"
          icon={Award}
          color="orange"
        />
      </div>

      {/* Advanced Team Stats */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Advanced Team Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Offense</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Points in Paint</span>
                  <Badge variant="outline">{homeStats.pointsInPaint}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Fast Break Points</span>
                  <Badge variant="outline">{homeStats.fastBreakPoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Second Chance Points</span>
                  <Badge variant="outline">{homeStats.secondChancePoints}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Bench Points</span>
                  <Badge variant="outline">{homeStats.benchPoints}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Defense</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Points off Turnovers</span>
                  <Badge variant="outline">{homeStats.pointsOffTurnovers}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Steals</span>
                  <Badge variant="outline">{homeStats.steals}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Blocks</span>
                  <Badge variant="outline">{homeStats.blocks}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Defensive Rebounds</span>
                  <Badge variant="outline">{Math.round(homeStats.rebounds * 0.7)}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Shooting</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Effective FG%</span>
                  <Badge variant="outline">{homeStats.effectiveFieldGoalPercentage.toFixed(1)}%</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">3P Percentage</span>
                  <Badge variant="outline">
                    {homeStats.three_attempted > 0 ? ((homeStats.three_made / homeStats.three_attempted) * 100).toFixed(1) : '0.0'}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">FT Percentage</span>
                  <Badge variant="outline">
                    {homeStats.ft_attempted > 0 ? ((homeStats.ft_made / homeStats.ft_attempted) * 100).toFixed(1) : '0.0'}%
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Performance Chart */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle>Player Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={homeStats.teamStats.map((stat, index) => ({
                  name: game.homeTeam.players[index]?.name || `Player ${index + 1}`,
                  points: stat.points,
                  rebounds: stat.rebounds,
                  assists: stat.assists
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="points" fill="#3b82f6" />
                <Bar dataKey="rebounds" fill="#10b981" />
                <Bar dataKey="assists" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const AwayTeamStats = () => (
    <div className="space-y-6">
      {game.awayTeam.players.length === 0 ? (
        <Card className="shadow-lg rounded-2xl">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No Away Team Data</h3>
            <p className="text-sm text-muted-foreground">
              Only home team statistics are being tracked in this game.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Points"
              value={awayStats.points}
              icon={Target}
              color="blue"
            />
            <StatCard
              title="Field Goal %"
              value={`${awayStats.fg_attempted > 0 ? ((awayStats.fg_made / awayStats.fg_attempted) * 100).toFixed(1) : '0.0'}%`}
              subtitle={`${awayStats.fg_made}/${awayStats.fg_attempted}`}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Assist/TO Ratio"
              value={awayStats.assistToTurnoverRatio.toFixed(1)}
              subtitle={`${awayStats.assists} AST / ${awayStats.turnovers} TO`}
              icon={Activity}
              color="purple"
            />
            <StatCard
              title="True Shooting %"
              value={`${awayStats.trueShootingPercentage.toFixed(1)}%`}
              subtitle="Efficiency"
              icon={Award}
              color="orange"
            />
          </div>

          {/* Advanced Team Stats */}
          <Card className="shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Advanced Team Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Offense</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Points in Paint</span>
                      <Badge variant="outline">{awayStats.pointsInPaint}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Fast Break Points</span>
                      <Badge variant="outline">{awayStats.fastBreakPoints}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Second Chance Points</span>
                      <Badge variant="outline">{awayStats.secondChancePoints}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Bench Points</span>
                      <Badge variant="outline">{awayStats.benchPoints}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Defense</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Points off Turnovers</span>
                      <Badge variant="outline">{awayStats.pointsOffTurnovers}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Steals</span>
                      <Badge variant="outline">{awayStats.steals}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Blocks</span>
                      <Badge variant="outline">{awayStats.blocks}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Defensive Rebounds</span>
                      <Badge variant="outline">{Math.round(awayStats.rebounds * 0.7)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Shooting</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Effective FG%</span>
                      <Badge variant="outline">{awayStats.effectiveFieldGoalPercentage.toFixed(1)}%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">3P Percentage</span>
                      <Badge variant="outline">
                        {awayStats.three_attempted > 0 ? ((awayStats.three_made / awayStats.three_attempted) * 100).toFixed(1) : '0.0'}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">FT Percentage</span>
                      <Badge variant="outline">
                        {awayStats.ft_attempted > 0 ? ((awayStats.ft_made / awayStats.ft_attempted) * 100).toFixed(1) : '0.0'}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="comparison" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">Team Comparison</TabsTrigger>
          <TabsTrigger value="home">{game.homeTeam.name}</TabsTrigger>
          <TabsTrigger value="away" disabled={game.awayTeam.players.length === 0}>
            {game.awayTeam.name}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison">
          <TeamComparison />
        </TabsContent>

        <TabsContent value="home">
          <HomeTeamStats />
        </TabsContent>

        <TabsContent value="away">
          <AwayTeamStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}