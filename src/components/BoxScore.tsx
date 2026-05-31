import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Game, GameStats } from '../App';
import { MetricsCalculator, AdvancedMetrics } from './MetricsCalculator';
import { PlayerIdentity } from './PlayerIdentity';
import { GameTeamLink } from './GameTeamLink';
import {
  NoStatRecorded,
  OptionalStatTableCell,
  StatTooltipHead,
} from './StatDisplay';
import {
  getPlayerPaintAndFastbreakPoints,
  hasAwayTeamContent,
  isScoreOnlyTeam,
  playerPlayedInGame,
  resolveSideScore,
  resolveTeamTotals,
  type ResolvedTeamTotals,
} from '../utils/gameDisplay';
import {
  orderBoxScorePlayers,
  type OrderedBoxScoreRow,
} from '../utils/boxScoreOrder';
import { TrendingUp, Users, Calculator, Download, Target } from 'lucide-react';

interface BoxScoreProps {
  game: Game;
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
  onNavigateToTeam?: (teamId: string) => void;
}

interface PlayerBoxScore extends GameStats {
  name: string;
  number: number;
  position: string;
  advanced: AdvancedMetrics;
}

export function BoxScore({ game, onNavigateToPlayer, onNavigateToTeam }: BoxScoreProps) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [view, setView] = useState<'traditional' | 'advanced'>('traditional');

  const getPlayerBoxScore = (playerId: string): GameStats => {
    const stats = game.gameStats.find(s => s.playerId === playerId);
    return stats || MetricsCalculator.getEmptyStats(playerId);
  };

  const getTeamBoxScore = (teamType: 'home' | 'away'): PlayerBoxScore[] => {
    const team = teamType === 'home' ? game.homeTeam : game.awayTeam;

    return team.players
      .filter((player) => playerPlayedInGame(game, player.id))
      .map((player) => {
        const stats = getPlayerBoxScore(player.id);
        const advanced = MetricsCalculator.calculateAdvancedMetrics(stats);

        return {
          ...stats,
          name: player.name,
          number: player.number,
          position: player.position,
          advanced,
        };
      });
  };

  const getOrderedTeamBoxScore = (
    teamType: 'home' | 'away'
  ): OrderedBoxScoreRow<PlayerBoxScore>[] => {
    const players = getTeamBoxScore(teamType);
    const starterIds =
      teamType === 'home' ? game.homeStarters : game.awayStarters;
    return orderBoxScorePlayers(players, starterIds ?? []);
  };

  const homeBoxScore = getOrderedTeamBoxScore('home');
  const awayBoxScore = getOrderedTeamBoxScore('away');
  const homeTotals = resolveTeamTotals(game, 'home');
  const awayTotals = resolveTeamTotals(game, 'away');
  const homeScore = resolveSideScore(game, 'home');
  const awayScore = resolveSideScore(game, 'away');
  const awayScoreOnly = isScoreOnlyTeam(game, 'away');

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

  const TraditionalStatsTable = ({
    rows,
    teamName,
    teamId,
    totals,
  }: {
    rows: OrderedBoxScoreRow<PlayerBoxScore>[];
    teamName: string;
    teamId: string;
    totals: ResolvedTeamTotals;
  }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <GameTeamLink
          teamId={teamId}
          teamName={teamName}
          onNavigateToTeam={onNavigateToTeam}
          className="font-medium"
        />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {totals.points} PTS
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
              <TableHead className="w-32">Starters</TableHead>
              <StatTooltipHead label="Min" tooltip="Minutes Played" className="text-center w-16" />
              <StatTooltipHead label="PTS" tooltip="Points" className="text-center w-12" />
              <StatTooltipHead label="FG" tooltip="Field Goals Made/Attempted" className="text-center w-20" />
              <StatTooltipHead label="FG%" tooltip="Field Goal Percentage" className="text-center w-16" />
              <StatTooltipHead label="3P" tooltip="Three-Pointers Made/Attempted" className="text-center w-20" />
              <StatTooltipHead label="3P%" tooltip="Three-Point Percentage" className="text-center w-16" />
              <StatTooltipHead label="FT" tooltip="Free Throws Made/Attempted" className="text-center w-20" />
              <StatTooltipHead label="FT%" tooltip="Free Throw Percentage" className="text-center w-16" />
              <StatTooltipHead label="ORB" tooltip="Offensive Rebounds" className="text-center w-12" />
              <StatTooltipHead label="DRB" tooltip="Defensive Rebounds" className="text-center w-12" />
              <StatTooltipHead label="REB" tooltip="Total Rebounds" className="text-center w-12" />
              <StatTooltipHead label="AST" tooltip="Assists" className="text-center w-12" />
              <StatTooltipHead label="STL" tooltip="Steals" className="text-center w-12" />
              <StatTooltipHead label="BLK" tooltip="Blocks" className="text-center w-12" />
              <StatTooltipHead label="TO" tooltip="Turnovers" className="text-center w-12" />
              <StatTooltipHead label="PF" tooltip="Personal Fouls" className="text-center w-12" />
              <StatTooltipHead label="+/-" tooltip="Plus/Minus (not recorded for team totals)" className="text-center w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              if (row.kind === 'divider') {
                return (
                  <TableRow key={`bench-divider-${index}`} className="bg-muted/30">
                    <TableCell
                      colSpan={18}
                      className="py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      Bench
                    </TableCell>
                  </TableRow>
                );
              }

              const player = row.player!;
              return (
              <TableRow
                key={player.playerId}
                className={`text-sm ${onNavigateToPlayer ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                onClick={() =>
                  onNavigateToPlayer?.(player.playerId, teamId)
                }
              >
                <TableCell className="font-medium">
                  <PlayerIdentity
                    name={player.name}
                    number={player.number}
                    position={player.position}
                    size="sm"
                    showNumberBadge
                  />
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
              );
            })}
            
            {/* Totals Row */}
            <TableRow className="font-medium bg-muted/50 text-sm border-t-2">
              <TableCell>TEAM TOTALS</TableCell>
              <TableCell className="text-center font-mono">{formatTime(totals.minutes_played)}</TableCell>
              <TableCell className="text-center font-mono font-bold">{totals.points}</TableCell>
              <TableCell className="text-center font-mono">{totals.fg_made}/{totals.fg_attempted}</TableCell>
              <TableCell className="text-center font-mono">
                {formatPercentage(totals.fg_attempted > 0 ? (totals.fg_made / totals.fg_attempted) * 100 : 0)}
              </TableCell>
              <TableCell className="text-center font-mono">{totals.three_made}/{totals.three_attempted}</TableCell>
              <TableCell className="text-center font-mono">
                {formatPercentage(totals.three_attempted > 0 ? (totals.three_made / totals.three_attempted) * 100 : 0)}
              </TableCell>
              <TableCell className="text-center font-mono">{totals.ft_made}/{totals.ft_attempted}</TableCell>
              <TableCell className="text-center font-mono">
                {formatPercentage(totals.ft_attempted > 0 ? (totals.ft_made / totals.ft_attempted) * 100 : 0)}
              </TableCell>
              <TableCell className="text-center font-mono">{totals.orb}</TableCell>
              <TableCell className="text-center font-mono">{totals.drb}</TableCell>
              <TableCell className="text-center font-mono font-bold">{totals.orb + totals.drb}</TableCell>
              <TableCell className="text-center font-mono">{totals.assists}</TableCell>
              <TableCell className="text-center font-mono">{totals.steals}</TableCell>
              <TableCell className="text-center font-mono">{totals.blocks}</TableCell>
              <TableCell className="text-center font-mono">{totals.turnovers}</TableCell>
              <TableCell className="text-center font-mono">{totals.fouls}</TableCell>
              <TableCell className="text-center font-mono">
                <NoStatRecorded />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const AdvancedStatsTable = ({
    rows,
    teamName,
    teamId,
  }: {
    rows: OrderedBoxScoreRow<PlayerBoxScore>[];
    teamName: string;
    teamId: string;
  }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          <GameTeamLink
            teamId={teamId}
            teamName={teamName}
            onNavigateToTeam={onNavigateToTeam}
          />
          {' '}- Advanced Metrics
        </h3>
        <Badge variant="secondary" className="text-xs">EFF • GmSc</Badge>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-32">Starters</TableHead>
              <StatTooltipHead label="Min" tooltip="Minutes Played" className="text-center w-16" />
              <StatTooltipHead label="EFF" tooltip="Efficiency Rating" className="text-center w-16" />
              <StatTooltipHead label="GmSc" tooltip="Game Score" className="text-center w-16" />
              <StatTooltipHead label="2P%" tooltip="Two-Point Percentage" className="text-center w-16" />
              <StatTooltipHead label="2P" tooltip="Two-Pointers Made/Attempted" className="text-center w-20" />
              <StatTooltipHead label="Paint" tooltip="Points in Paint" className="text-center w-16" />
              <StatTooltipHead label="FB" tooltip="Fast Break Points" className="text-center w-16" />
              <StatTooltipHead label="FD" tooltip="Fouls Drawn" className="text-center w-16" />
              <StatTooltipHead label="BA" tooltip="Blocks Against" className="text-center w-16" />
              <StatTooltipHead label="TF" tooltip="Technical Fouls" className="text-center w-16" />
              <StatTooltipHead label="UF" tooltip="Unsportsmanlike Fouls" className="text-center w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              if (row.kind === 'divider') {
                return (
                  <TableRow key={`bench-divider-adv-${index}`} className="bg-muted/30">
                    <TableCell
                      colSpan={12}
                      className="py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      Bench
                    </TableCell>
                  </TableRow>
                );
              }

              const player = row.player!;
              const { paintPoints, fastbreakPoints } = getPlayerPaintAndFastbreakPoints(
                game,
                player.playerId
              );

              return (
              <TableRow
                key={player.playerId}
                className={`text-sm ${onNavigateToPlayer ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                onClick={() =>
                  onNavigateToPlayer?.(player.playerId, teamId)
                }
              >
                <TableCell className="font-medium">
                  <PlayerIdentity
                    name={player.name}
                    number={player.number}
                    position={player.position}
                    size="sm"
                    showNumberBadge
                  />
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
                <TableCell className="text-center font-mono">{formatPercentage(player.advanced.twoPointPercentage)}</TableCell>
                <TableCell className="text-center font-mono">{player.advanced.twoPointMade}/{player.advanced.twoPointAttempted}</TableCell>
                <OptionalStatTableCell value={paintPoints} />
                <OptionalStatTableCell value={fastbreakPoints} />
                <TableCell className="text-center font-mono">{player.fouls_drawn}</TableCell>
                <TableCell className="text-center font-mono">{player.blocks_received}</TableCell>
                <TableCell className="text-center font-mono">{player.tech_fouls}</TableCell>
                <TableCell className="text-center font-mono">{player.unsportsmanlike_fouls}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
              <GameTeamLink
                teamId={game.homeTeam.id}
                teamName={game.homeTeam.name}
                onNavigateToTeam={onNavigateToTeam}
                className="font-medium text-lg block"
              />
              <div className="text-3xl font-bold text-primary mt-2">{homeScore}</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-muted-foreground">vs</div>
            </div>
            <div>
              <GameTeamLink
                teamId={game.awayTeam.id}
                teamName={game.awayTeam.name}
                onNavigateToTeam={onNavigateToTeam}
                className="font-medium text-lg block"
              />
              <div className="text-3xl font-bold text-primary mt-2">{awayScore}</div>
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
      </div>

      <Tabs value={selectedTeam} onValueChange={(value) => setSelectedTeam(value as 'home' | 'away')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="home" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {game.homeTeam.name}
            </TabsTrigger>
            <TabsTrigger value="away" disabled={!hasAwayTeamContent(game)} className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {game.awayTeam.name}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <Card className="shadow-lg rounded-2xl">
              <CardContent className="p-6">
                {view === 'traditional' ? (
                  <TraditionalStatsTable
                    rows={homeBoxScore}
                    teamName={game.homeTeam.name}
                    teamId={game.homeTeam.id}
                    totals={homeTotals}
                  />
                ) : (
                  <AdvancedStatsTable
                    rows={homeBoxScore}
                    teamName={game.homeTeam.name}
                    teamId={game.homeTeam.id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="away">
            <Card className="shadow-lg rounded-2xl">
              <CardContent className="p-6">
                {awayScoreOnly ? (
                  <div className="text-center py-12">
                    <GameTeamLink
                      teamId={game.awayTeam.id}
                      teamName={game.awayTeam.name}
                      onNavigateToTeam={onNavigateToTeam}
                      className="font-medium text-lg mb-2 block"
                    />
                    <div className="text-4xl font-bold text-primary mb-4">{awayScore}</div>
                    <p className="text-sm text-muted-foreground">
                      No player box score recorded for this team.
                    </p>
                  </div>
                ) : view === 'traditional' ? (
                  <TraditionalStatsTable
                    rows={awayBoxScore}
                    teamName={game.awayTeam.name}
                    teamId={game.awayTeam.id}
                    totals={awayTotals}
                  />
                ) : (
                  <AdvancedStatsTable
                    rows={awayBoxScore}
                    teamName={game.awayTeam.name}
                    teamId={game.awayTeam.id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}