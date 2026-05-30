import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Game } from '../App';
import { MetricsCalculator } from './MetricsCalculator';
import {
  getOptionalAdvancedStatValue,
  getPersistedTeamStats,
  getPlayerFirstName,
  getPlayersWhoPlayed,
  hasAwayTeamContent,
  isScoreOnlyTeam,
  resolveSideScore,
  resolveTeamTotals,
  teamHasPlayerBoxScore,
  type TeamSide,
  type OptionalAdvancedTeamStatKey,
} from '../utils/gameDisplay';
import { NoStatRecorded, OptionalStatBadge, OptionalStatText } from './StatDisplay';
import { BarChart3, TrendingUp, Users, Award, Target, Activity } from 'lucide-react';

interface TeamStatsProps {
  game: Game;
}

interface TeamDisplayStats {
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  rebounds: number;
  drb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  assistToTurnoverRatio: number;
  effectiveFieldGoalPercentage: number;
  trueShootingPercentage: number;
  scoreOnly: boolean;
}

function buildTeamDisplayStats(game: Game, side: TeamSide): TeamDisplayStats {
  const totals = resolveTeamTotals(game, side);
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  const fromPlayers = teamHasPlayerBoxScore(game, team);

  const rebounds = totals.scoreOnly
    ? 0
    : fromPlayers
      ? totals.orb + totals.drb
      : getPersistedTeamStats(game, side)?.total_rebounds ?? totals.orb + totals.drb;
  const drb = totals.drb;

  const assistToTurnoverRatio =
    totals.turnovers > 0 ? totals.assists / totals.turnovers : totals.assists;
  const effectiveFieldGoalPercentage =
    totals.fg_attempted > 0
      ? ((totals.fg_made + 0.5 * totals.three_made) / totals.fg_attempted) * 100
      : 0;
  const trueShootingPercentage =
    totals.fg_attempted + 0.44 * totals.ft_attempted > 0
      ? (totals.points / (2 * (totals.fg_attempted + 0.44 * totals.ft_attempted))) * 100
      : 0;

  return {
    points: resolveSideScore(game, side),
    fg_made: totals.fg_made,
    fg_attempted: totals.fg_attempted,
    three_made: totals.three_made,
    three_attempted: totals.three_attempted,
    ft_made: totals.ft_made,
    ft_attempted: totals.ft_attempted,
    rebounds,
    drb,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: totals.fouls,
    assistToTurnoverRatio,
    effectiveFieldGoalPercentage,
    trueShootingPercentage,
    scoreOnly: totals.scoreOnly,
  };
}

export function TeamStats({ game }: TeamStatsProps) {
  const homeStats = buildTeamDisplayStats(game, 'home');
  const awayStats = buildTeamDisplayStats(game, 'away');

  const comparisonData = [
    { category: 'Points', home: homeStats.points, away: awayStats.points },
    {
      category: 'FG%',
      home: homeStats.fg_attempted > 0 ? (homeStats.fg_made / homeStats.fg_attempted) * 100 : 0,
      away: awayStats.fg_attempted > 0 ? (awayStats.fg_made / awayStats.fg_attempted) * 100 : 0,
    },
    { category: 'Rebounds', home: homeStats.rebounds, away: awayStats.rebounds },
    { category: 'Assists', home: homeStats.assists, away: awayStats.assists },
    { category: 'Steals', home: homeStats.steals, away: awayStats.steals },
    { category: 'Blocks', home: homeStats.blocks, away: awayStats.blocks },
    { category: 'Turnovers', home: homeStats.turnovers, away: awayStats.turnovers },
  ];

  const buildDistribution = (stats: TeamDisplayStats) => [
    { name: '2PT', value: (stats.fg_made - stats.three_made) * 2, color: '#3b82f6' },
    { name: '3PT', value: stats.three_made * 3, color: '#8b5cf6' },
    { name: 'FT', value: stats.ft_made, color: '#10b981' },
  ];

  const homeDistribution = buildDistribution(homeStats);
  const awayDistribution = buildDistribution(awayStats);

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-lg">{value}</div>
          <div className="text-sm text-muted-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );

  const AdvancedStatRow = ({
    label,
    side,
    statKey,
    numericValue,
    numericSuffix = '',
    decimals,
  }: {
    label: string;
    side: TeamSide;
    statKey?: OptionalAdvancedTeamStatKey;
    numericValue?: number;
    numericSuffix?: string;
    decimals?: number;
  }) => {
    const scoreOnly = isScoreOnlyTeam(game, side);
    const persisted = getPersistedTeamStats(game, side);

    if (statKey != null) {
      const value = getOptionalAdvancedStatValue(persisted, statKey, scoreOnly);
      return (
        <div className="flex justify-between">
          <span className="text-sm">{label}</span>
          <OptionalStatBadge value={value} />
        </div>
      );
    }

    if (scoreOnly) {
      return (
        <div className="flex justify-between">
          <span className="text-sm">{label}</span>
          <OptionalStatBadge value={null} />
        </div>
      );
    }

    return (
      <div className="flex justify-between">
        <span className="text-sm">{label}</span>
        <Badge variant="outline">
          <OptionalStatText
            value={numericValue ?? null}
            suffix={numericSuffix}
            decimals={decimals}
          />
        </Badge>
      </div>
    );
  };

  const TeamDetailView = ({
    side,
    stats,
    teamName,
  }: {
    side: TeamSide;
    stats: TeamDisplayStats;
    teamName: string;
  }) => {
    const team = side === 'home' ? game.homeTeam : game.awayTeam;
    const playedPlayers = getPlayersWhoPlayed(game, team);
    const chartData = playedPlayers
      .map((player) => {
        const stat =
          game.gameStats.find((s) => s.playerId === player.id) ??
          MetricsCalculator.getEmptyStats(player.id);
        return {
          name: getPlayerFirstName(player.name),
          fullName: player.name,
          points: stat.points,
          rebounds: stat.orb + stat.drb,
          assists: stat.assists,
          minutes_played: stat.minutes_played,
        };
      })
      .sort(
        (a, b) =>
          b.minutes_played - a.minutes_played ||
          a.fullName.localeCompare(b.fullName)
      );

    if (stats.scoreOnly) {
      return (
        <Card className="shadow-lg rounded-2xl">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">{teamName}</h3>
            <div className="text-4xl font-bold text-primary mb-4">{stats.points}</div>
            <p className="text-sm text-muted-foreground">
              No detailed stats recorded for this team.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Points" value={stats.points} icon={Target} />
          <StatCard
            title="Field Goal %"
            value={`${stats.fg_attempted > 0 ? ((stats.fg_made / stats.fg_attempted) * 100).toFixed(1) : '0.0'}%`}
            subtitle={`${stats.fg_made}/${stats.fg_attempted}`}
            icon={TrendingUp}
          />
          <StatCard
            title="Assist/TO Ratio"
            value={stats.assistToTurnoverRatio.toFixed(1)}
            subtitle={`${stats.assists} AST / ${stats.turnovers} TO`}
            icon={Activity}
          />
          <StatCard
            title="True Shooting %"
            value={`${stats.trueShootingPercentage.toFixed(1)}%`}
            subtitle="Efficiency"
            icon={Award}
          />
        </div>

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
                  <AdvancedStatRow side={side} label="Points in Paint" statKey="points_in_paint" />
                  <AdvancedStatRow side={side} label="Fast Break Points" statKey="fastbreak_points" />
                  <AdvancedStatRow side={side} label="Second Chance Points" statKey="second_chance_points" />
                  <AdvancedStatRow side={side} label="Bench Points" statKey="bench_points" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Defense</h4>
                <div className="space-y-3">
                  <AdvancedStatRow side={side} label="Points off Turnovers" statKey="points_off_turnovers" />
                  <AdvancedStatRow side={side} label="Steals" numericValue={stats.steals} />
                  <AdvancedStatRow side={side} label="Blocks" numericValue={stats.blocks} />
                  <AdvancedStatRow side={side} label="Defensive Rebounds" numericValue={stats.drb} />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Shooting</h4>
                <div className="space-y-3">
                  <AdvancedStatRow
                    side={side}
                    label="Effective FG%"
                    numericValue={Number(stats.effectiveFieldGoalPercentage.toFixed(1))}
                    numericSuffix="%"
                  />
                  <AdvancedStatRow
                    side={side}
                    label="3P Percentage"
                    numericValue={
                      stats.three_attempted > 0
                        ? Number(((stats.three_made / stats.three_attempted) * 100).toFixed(1))
                        : 0
                    }
                    numericSuffix="%"
                  />
                  <AdvancedStatRow
                    side={side}
                    label="FT Percentage"
                    numericValue={
                      stats.ft_attempted > 0
                        ? Number(((stats.ft_made / stats.ft_attempted) * 100).toFixed(1))
                        : 0
                    }
                    numericSuffix="%"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {chartData.length > 0 && (
          <Card className="shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>Player Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { fullName?: string })?.fullName ??
                        String(payload?.[0]?.payload?.name ?? '')
                      }
                    />
                    <Bar dataKey="points" fill="#3b82f6" />
                    <Bar dataKey="rebounds" fill="#10b981" />
                    <Bar dataKey="assists" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const ScoringPie = ({
    teamName,
    distribution,
    scoreOnly,
    points,
  }: {
    teamName: string;
    distribution: { name: string; value: number; color: string }[];
    scoreOnly: boolean;
    points: number;
  }) => (
    <Card className="shadow-lg rounded-2xl">
      <CardHeader>
        <CardTitle className="text-center">{teamName} Scoring</CardTitle>
      </CardHeader>
      <CardContent>
        {scoreOnly ? (
          <div className="py-8 text-center">
            <div className="text-3xl font-bold mb-2">{points}</div>
            <NoStatRecorded />
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {distribution.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="text-lg font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="comparison" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">Team Comparison</TabsTrigger>
          <TabsTrigger value="home">{game.homeTeam.name}</TabsTrigger>
          <TabsTrigger value="away" disabled={!hasAwayTeamContent(game)}>
            {game.awayTeam.name}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison">
          <div className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScoringPie
                teamName={game.homeTeam.name}
                distribution={homeDistribution}
                scoreOnly={homeStats.scoreOnly}
                points={homeStats.points}
              />
              <ScoringPie
                teamName={game.awayTeam.name}
                distribution={awayDistribution}
                scoreOnly={awayStats.scoreOnly}
                points={awayStats.points}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="home">
          <TeamDetailView side="home" stats={homeStats} teamName={game.homeTeam.name} />
        </TabsContent>

        <TabsContent value="away">
          <TeamDetailView side="away" stats={awayStats} teamName={game.awayTeam.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
