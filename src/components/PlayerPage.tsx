import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Player, Team, Game, GameStats, Tournament } from '../App';
import { MetricsCalculator, AdvancedMetrics } from './MetricsCalculator';
import { PlayerShotChart } from './PlayerShotChart';
import { PlayerForm } from './forms/PlayerForm';
import { formatHeightForDisplay, formatWeightForDisplay } from '../lib/playerMeasurements';
import { sortGamesByDateDesc } from '../utils/gameDisplay';
import { sortTournamentsByDateDesc } from '../utils/tournamentSort';
import {
  buildPlayerTournamentSeasonRows,
  getFoulStatCoverage,
  getShotDataCoverage,
} from '../utils/playerSeasonStats';
import { getPlayerParticipatedTournaments } from '../utils/teamTournaments';
import {
  getPlayerRosterEntries,
  resolvePlayerTeamInGame,
} from '../utils/rosterPlayers';
import { getPlayerAgeAsOfToday, resolvePlayerAge } from '../utils/playerAge';
import { PlayerStatsTable } from './PlayerStatsTable';
import { PlayerJerseyGrid } from './PlayerJerseyGrid';
import { PlayerJerseyNumbersEditor } from './PlayerJerseyNumbersEditor';
import { PlayerTeamBadges } from './PlayerTeamBadges';
import { ParticipatedTournamentBadges } from './ParticipatedTournamentBadges';
import { ErrorBoundary } from './ErrorBoundary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  ArrowLeft,
  User, 
  BarChart3, 
  Calendar,
  Target,
  Activity,
  TrendingUp,
  Star,
  Medal,
  Crown,
  Filter,
  Edit
} from 'lucide-react';

interface PlayerPageProps {
  player: Player;
  team: Team;
  teams: Team[];
  games: Game[];
  tournaments: Tournament[];
  activeTab: 'overview' | 'gamelog' | 'stats' | 'advanced';
  onTabChange: (tab: 'overview' | 'gamelog' | 'stats' | 'advanced') => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onNavigateToTournament: (tournamentId: string) => void;
  onUpdatePlayerProfile: (
    playerId: string,
    profilePatch: Pick<
      Player,
      | 'name'
      | 'position'
      | 'secondaryPosition'
      | 'height'
      | 'weight'
      | 'age'
      | 'dateOfBirth'
    >,
    jerseyByTeamId: Record<string, number>
  ) => void;
}

export const formatPlayerPositionLabel = (primaryPosition: string, secondaryPosition?: string): string => {
  const primary = primaryPosition?.trim() || '';
  const secondary = secondaryPosition?.trim();

  if (!secondary || secondary === primary) {
    return primary;
  }

  return `${primary}/${secondary}`;
};

export function PlayerPage({ 
  player, 
  team,
  teams = [],
  games, 
  tournaments,
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToTeam,
  onNavigateToGame,
  onNavigateToTournament,
  onUpdatePlayerProfile,
}: PlayerPageProps) {
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [jerseyDraft, setJerseyDraft] = useState<Record<string, string>>({});

  const playerRosterEntries = useMemo(
    () => getPlayerRosterEntries(player.id, teams),
    [player.id, teams]
  );
  const isMultiTeam = playerRosterEntries.length > 1;
  const jerseyGridEntries = useMemo(
    () =>
      playerRosterEntries.map(({ team: rosterTeam, player: rosterPlayer }) => ({
        team: rosterTeam,
        number: rosterPlayer.number,
      })),
    [playerRosterEntries]
  );
  const rosterTeams = useMemo(
    () => playerRosterEntries.map(({ team: rosterTeam }) => rosterTeam),
    [playerRosterEntries]
  );

  useEffect(() => {
    if (!isEditDialogOpen) return;
    const draft: Record<string, string> = {};
    for (const { team: rosterTeam, player: rosterPlayer } of playerRosterEntries) {
      draft[rosterTeam.id] = String(rosterPlayer.number ?? '');
    }
    setJerseyDraft(draft);
  }, [isEditDialogOpen, playerRosterEntries]);

  const sortedTournaments = useMemo(
    () => sortTournamentsByDateDesc(tournaments),
    [tournaments]
  );
  
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  const jerseyEditorRows = useMemo(
    () =>
      playerRosterEntries.map(({ team: rosterTeam, player: rosterPlayer }) => ({
        teamId: rosterTeam.id,
        teamName: rosterTeam.name,
        teamAbbreviation: rosterTeam.abbreviation,
        team: rosterTeam,
        number: jerseyDraft[rosterTeam.id] ?? String(rosterPlayer.number ?? ''),
      })),
    [playerRosterEntries, jerseyDraft]
  );

  const handleUpdatePlayer = useCallback((data: { 
    name: string; 
    number: string; 
    position: string;
    secondaryPosition?: string;
    height: string;
    weight: string;
    dateOfBirth?: string;
  }) => {
    if (!player) return;

    let age = player.age || 0;
    if (data.dateOfBirth) {
      age = getPlayerAgeAsOfToday(data.dateOfBirth) ?? age;
    }

    const profilePatch = {
      name: data.name,
      position: data.position,
      secondaryPosition: data.secondaryPosition || undefined,
      height: data.height || '',
      weight: data.weight || '',
      age,
      dateOfBirth: data.dateOfBirth || undefined,
    };

    const jerseyByTeamId: Record<string, number> = {};
    for (const { team: rosterTeam, player: rosterPlayer } of playerRosterEntries) {
      const raw =
        jerseyDraft[rosterTeam.id] ?? String(rosterPlayer.number ?? '');
      const jerseyNum = parseInt(raw, 10);
      if (Number.isFinite(jerseyNum)) {
        jerseyByTeamId[rosterTeam.id] = jerseyNum;
      }
    }

    onUpdatePlayerProfile(player.id, profilePatch, jerseyByTeamId);
    setIsEditDialogOpen(false);
  }, [player, playerRosterEntries, jerseyDraft, onUpdatePlayerProfile]);
  
  // Get player games and stats
  if (!player || !team || !games) {
    return <div>Loading...</div>;
  }
  
  // Defensive checks for required properties
  if (!player.name || !player.id || !team.id || !team.players) {
    return <div>Invalid player or team data</div>;
  }
  
  const playerGames = sortGamesByDateDesc(
    games.filter(game => {
      if (!game.gameStats || !Array.isArray(game.gameStats)) return false;
      return game.gameStats.some(stat => stat.playerId === player.id);
    })
  );
  
  const playerGameStats = playerGames.map(game => {
    // Defensive check: ensure gameStats exists before finding
    const stats = game.gameStats && Array.isArray(game.gameStats) 
      ? game.gameStats.find(stat => stat.playerId === player.id)
      : null;
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
    return playerGameStats.slice(0, 5);
  };
  
  // Calculate advanced metrics
  const { totals, averages, gamesPlayed } = calculateSeasonStats();
  const advanced = MetricsCalculator.calculateAdvancedMetrics(
    totals,
    Math.max(gamesPlayed, 1)
  );
  const recentGames = getRecentPerformance();
  
  const participatedTournaments = useMemo(
    () => getPlayerParticipatedTournaments(player.id, games, tournaments),
    [player.id, games, tournaments]
  );
  const displayPosition = formatPlayerPositionLabel(
    player.position,
    player.secondaryPosition
  );
  const displayHeight = player.height ? formatHeightForDisplay(player.height) : '';
  const displayWeight = player.weight ? formatWeightForDisplay(player.weight) : '';
  const displayAge = resolvePlayerAge(player);
  
  // Get stats by tournament
  const getStatsByTournament = () => {
    const statsByTournament = new Map<string, {
      tournament: Tournament | null;
      stats: GameStats;
      games: number;
      advanced: AdvancedMetrics;
    }>();
    
    // Group games by tournament
    playerGameStats.forEach(({ game, stats }) => {
      const tournamentId = game.tournamentId || 'no-tournament';
      const tournament = game.tournamentId ? tournaments.find(t => t.id === game.tournamentId) : null;
      
      if (!statsByTournament.has(tournamentId)) {
        statsByTournament.set(tournamentId, {
          tournament,
          stats: MetricsCalculator.getEmptyStats(player.id),
          games: 0,
          advanced: MetricsCalculator.calculateAdvancedMetrics(MetricsCalculator.getEmptyStats(player.id))
        });
      }
      
      const tournamentData = statsByTournament.get(tournamentId)!;
      
      // Add stats
      Object.keys(stats).forEach(key => {
        if (key !== 'playerId' && typeof stats[key as keyof GameStats] === 'number') {
          (tournamentData.stats as any)[key] += (stats as any)[key];
        }
      });
      
      tournamentData.games++;
    });
    
    // Calculate advanced metrics for each tournament
    statsByTournament.forEach((data, tournamentId) => {
      if (data.games > 0) {
        data.advanced = MetricsCalculator.calculateAdvancedMetrics(data.stats, data.games);
      }
    });
    
    return Array.from(statsByTournament.entries()).map(([tournamentId, data]) => ({
      tournamentId,
      ...data
    }));
  };
  
  const tournamentStats = getStatsByTournament();

  const getGameTeamContext = useCallback(
    (game: Game) => {
      const playerTeam = resolvePlayerTeamInGame(player.id, game, teams) ?? team;
      const isHome = game.homeTeamId === playerTeam.id;
      const opponent = isHome ? game.awayTeam : game.homeTeam;
      return { playerTeam, isHome, opponent };
    },
    [player.id, teams, team]
  );
  
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Player Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4 sm:gap-6">
            <Avatar className="w-24 h-24 shrink-0">
              <AvatarFallback className="text-2xl">
                {player.name ? player.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold">{player.name}</h2>
                  {displayPosition && (
                    <p className="text-muted-foreground mt-1">{displayPosition}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {[displayHeight, displayWeight, displayAge !== null ? `${displayAge} years old` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <PlayerJerseyGrid
                  entries={jerseyGridEntries}
                  onTeamClick={onNavigateToTeam}
                  size="lg"
                  className="shrink-0"
                />
              </div>
              {rosterTeams.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <PlayerTeamBadges
                    teams={rosterTeams}
                    onNavigateToTeam={onNavigateToTeam}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <ParticipatedTournamentBadges
                  tournaments={participatedTournaments}
                  onNavigateToTournament={onNavigateToTournament}
                />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" />
              Efficiency (EFF)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(advanced.efficiency / (gamesPlayed || 1)).toFixed(1)}</div>
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
            <div className="text-2xl font-bold">{(advanced.gameScore / (gamesPlayed || 1)).toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Hollinger's comprehensive performance metric
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
              const { playerTeam, isHome, opponent } = getGameTeamContext(game);
              if (!opponent || !opponent.name) return null;
              const gameAdvanced = MetricsCalculator.calculateAdvancedMetrics(stats);
              
              return (
                <div 
                  key={game.id} 
                  className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onNavigateToGame(game.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">
                      {new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-sm font-medium leading-snug break-words">
                      {isMultiTeam && (
                        <span className="text-muted-foreground mr-1">
                          {playerTeam.abbreviation}:
                        </span>
                      )}
                      {isHome ? 'vs' : '@'} {opponent.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
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
                {isMultiTeam && <TableHead>Team</TableHead>}
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
              {playerGameStats.map(({ game, stats }) => {
                const { playerTeam, isHome, opponent } = getGameTeamContext(game);
                if (!opponent || !opponent.name) return null;
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
                    {isMultiTeam && (
                      <TableCell>{playerTeam.abbreviation}</TableCell>
                    )}
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

  const PlayerStatsTab = () => {
    const allRows = useMemo(
      () => buildPlayerTournamentSeasonRows(player, teams, games, tournaments),
      [player, teams, games, tournaments]
    );

    const displayRows = useMemo(() => {
      if (selectedTournament === 'all') {
        return allRows;
      }
      return allRows.filter(
        (row) => row.scopeId === selectedTournament && !row.isSummaryRow
      );
    }, [allRows, selectedTournament]);

    const showStatsTeamColumn =
      isMultiTeam ||
      new Set(allRows.filter((r) => !r.isSummaryRow).map((r) => r.team.id)).size > 1;

    const coverageGames = useMemo(() => {
      const playerCompletedGames = games.filter(
        (game) =>
          game.isCompleted &&
          (game.gameStats ?? []).some((stat) => stat.playerId === player.id)
      );
      if (selectedTournament === 'all') {
        return playerCompletedGames;
      }
      return playerCompletedGames.filter(
        (game) => game.tournamentId === selectedTournament
      );
    }, [games, player.id, selectedTournament]);

    const shotDataCoverage = getShotDataCoverage(coverageGames);
    const foulStatCoverage = getFoulStatCoverage(coverageGames);

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Tournament:</label>
                <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tournaments</SelectItem>
                    {tournamentStats.map((stat) => (
                      <SelectItem key={stat.tournamentId} value={stat.tournamentId}>
                        {stat.tournament ? stat.tournament.name : 'No Tournament'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <PlayerStatsTable
          rows={displayRows}
          layout="tournament-breakdown"
          showTeamColumn={showStatsTeamColumn}
          showAgeColumn
          disableRowNavigation
          shotDataCoverage={shotDataCoverage}
          foulStatCoverage={foulStatCoverage}
          onNavigateToTournament={onNavigateToTournament}
        />
      </div>
    );
  };

  const AdvancedTab = () => {
    // Filter stats based on selected tournament for advanced tab
    const filteredTournamentStats = selectedTournament === 'all' 
      ? tournamentStats 
      : tournamentStats.filter(stat => stat.tournamentId === selectedTournament);
    
    // Calculate filtered totals and averages
    const getFilteredStats = () => {
      if (filteredTournamentStats.length === 0) {
        return {
          totals: MetricsCalculator.getEmptyStats(player.id),
          averages: MetricsCalculator.getEmptyStats(player.id),
          gamesPlayed: 0,
          advanced: MetricsCalculator.calculateAdvancedMetrics(MetricsCalculator.getEmptyStats(player.id))
        };
      }
      
      const totals = filteredTournamentStats.reduce((acc, tournamentData) => {
        Object.keys(tournamentData.stats).forEach(key => {
          if (key !== 'playerId' && typeof tournamentData.stats[key as keyof GameStats] === 'number') {
            (acc as any)[key] += (tournamentData.stats as any)[key];
          }
        });
        return acc;
      }, MetricsCalculator.getEmptyStats(player.id));
      
      const gamesPlayed = filteredTournamentStats.reduce((sum, t) => sum + t.games, 0);
      const averages = { ...totals };
      
      // Calculate averages
      Object.keys(averages).forEach(key => {
        if (key !== 'playerId' && typeof averages[key as keyof GameStats] === 'number') {
          (averages as any)[key] = (averages as any)[key] / (gamesPlayed || 1);
        }
      });
      
      const advanced = MetricsCalculator.calculateAdvancedMetrics(totals, gamesPlayed);
      
      return { totals, averages, gamesPlayed, advanced };
    };
    
    const filteredData = getFilteredStats();
    
    return (
      <div className="space-y-6">
        {/* Tournament Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Tournament:</label>
                <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tournaments</SelectItem>
                    {sortedTournaments.map(tournament => (
                      <SelectItem key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    <span className="text-sm font-mono">{filteredData.totals.fg_made.toFixed(0)}/{filteredData.totals.fg_attempted.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Percentage</span>
                    <span className="text-sm font-mono">{filteredData.advanced.fieldGoalPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Per Game</span>
                    <span className="text-sm font-mono">{filteredData.averages.fg_made.toFixed(1)}/{filteredData.averages.fg_attempted.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Three-Pointers</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Made/Attempted</span>
                    <span className="text-sm font-mono">{filteredData.totals.three_made.toFixed(0)}/{filteredData.totals.three_attempted.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Percentage</span>
                    <span className="text-sm font-mono">{filteredData.advanced.threePointPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Per Game</span>
                    <span className="text-sm font-mono">{filteredData.averages.three_made.toFixed(1)}/{filteredData.averages.three_attempted.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Free Throws</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Made/Attempted</span>
                    <span className="text-sm font-mono">{filteredData.totals.ft_made.toFixed(0)}/{filteredData.totals.ft_attempted.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Percentage</span>
                    <span className="text-sm font-mono">{filteredData.advanced.freeThrowPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Per Game</span>
                    <span className="text-sm font-mono">{filteredData.averages.ft_made.toFixed(1)}/{filteredData.averages.ft_attempted.toFixed(1)}</span>
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
                    <Badge variant={filteredData.advanced.efficiency >= 15 ? "default" : "secondary"}>
                      {(filteredData.advanced.efficiency / (filteredData.gamesPlayed || 1)).toFixed(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Game Score (GmSc)</span>
                    <Badge variant={filteredData.advanced.gameScore >= 15 ? "default" : "secondary"}>
                      {(filteredData.advanced.gameScore / (filteredData.gamesPlayed || 1)).toFixed(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Plus/Minus</span>
                    <Badge variant={filteredData.averages.plus_minus >= 0 ? "default" : "destructive"}>
                      {filteredData.averages.plus_minus >= 0 ? '+' : ''}{filteredData.averages.plus_minus.toFixed(1)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Per Game Averages</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Games Played</span>
                    <span className="text-sm font-mono">{filteredData.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Minutes</span>
                    <span className="text-sm font-mono">{filteredData.averages.minutes_played.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Turnovers</span>
                    <span className="text-sm font-mono">{filteredData.averages.turnovers.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Personal Fouls</span>
                    <span className="text-sm font-mono">{filteredData.averages.fouls.toFixed(1)}</span>
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
                <div className="text-2xl font-bold">{filteredData.averages.steals.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Steals per game</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{filteredData.averages.blocks.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Blocks per game</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{filteredData.averages.fouls_drawn.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Fouls drawn per game</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{filteredData.averages.blocks_received.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Blocks against per game</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shot Chart */}
        <PlayerShotChart 
          player={player}
          team={team}
          games={games}
          selectedTournament={selectedTournament}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarFallback>
                {player.name ? player.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{player.name}</h1>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsEditDialogOpen(true)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Player
        </Button>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Player Details</DialogTitle>
              <DialogDescription>
                Update player information and details.
              </DialogDescription>
            </DialogHeader>
            <ErrorBoundary>
              {playerRosterEntries.length > 0 && (
                <PlayerJerseyNumbersEditor
                  rows={jerseyEditorRows}
                  onNumberChange={(teamId, value) =>
                    setJerseyDraft((prev) => ({ ...prev, [teamId]: value }))
                  }
                />
              )}
              <PlayerForm
                key={String(isEditDialogOpen)}
                initialData={{
                  name: player.name || '',
                  number: '',
                  position: player.position || '',
                  secondaryPosition: player.secondaryPosition || '',
                  height: player.height || '',
                  weight: player.weight || '',
                  dateOfBirth: player.dateOfBirth || ''
                }}
                selectedTeam={team}
                positions={positions}
                hideJerseyNumber={playerRosterEntries.length > 0}
                onSubmit={handleUpdatePlayer}
                onCancel={() => setIsEditDialogOpen(false)}
              />
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gamelog">Game Log</TabsTrigger>
          <TabsTrigger value="stats">Player Stats</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="gamelog">
          <GameLogTab />
        </TabsContent>

        <TabsContent value="stats">
          <PlayerStatsTab />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}