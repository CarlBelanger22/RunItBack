import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tournament, Team, Game, CreateTeamOptions } from '../App';
import { PlayerStatsTable } from './PlayerStatsTable';
import { TeamBadge } from './TeamBadge';
import { TournamentBadge } from './TournamentBadge';
import { TeamForm } from './forms/TeamForm';
import { aggregatePlayerSeasonStats, getFoulStatCoverage, getShotDataCoverage } from '../utils/playerSeasonStats';
import { resolveGameTeam } from '../utils/gameTeams';
import { MetricsCalculator } from './MetricsCalculator';
import { 
  Trophy, 
  Users, 
  BarChart3, 
  User, 
  ArrowLeft,
  Calendar,
  Target,
  Activity,
  TrendingUp,
  Medal,
  Crown,
  Star,
  Plus,
  Shield
} from 'lucide-react';

interface TournamentPageProps {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
  activeTab: 'home' | 'teams' | 'standings' | 'players' | 'games';
  onTabChange: (tab: 'home' | 'teams' | 'standings' | 'players' | 'games') => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onCreateTeam: (teamData: Omit<Team, 'id'>, options?: CreateTeamOptions) => Team;
  onAddTeamToTournament: (teamId: string, tournamentId: string) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
}

export function TournamentPage({ 
  tournament, 
  teams, 
  games, 
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToTeam,
  onNavigateToPlayer,
  onNavigateToGame,
  onCreateTeam,
  onAddTeamToTournament,
  onUpdateTeam,
  onDeleteTeam
}: TournamentPageProps) {
  
  // Get tournament teams
  const tournamentTeams = teams.filter(team => tournament.teams.includes(team.id));
  
  // Get tournament games
  const tournamentGames = games.filter(game => tournament.games.includes(game.id));
  
  // Calculate tournament standings
  const calculateStandings = () => {
    const standings = tournamentTeams.map(team => {
      const teamGames = tournamentGames.filter(game => 
        game.homeTeamId === team.id || game.awayTeamId === team.id
      );
      
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
      const pointsDiff = pointsFor - pointsAgainst;
      const ppg = gamesPlayed > 0 ? pointsFor / gamesPlayed : 0;
      const papg = gamesPlayed > 0 ? pointsAgainst / gamesPlayed : 0;
      
      return {
        team,
        wins,
        losses,
        gamesPlayed,
        winPercentage,
        pointsFor,
        pointsAgainst,
        pointsDiff,
        ppg,
        papg
      };
    });
    
    return standings.sort((a, b) => {
      if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
      return b.pointsDiff - a.pointsDiff;
    });
  };
  
  // Get tournament leaders
  const getTournamentLeaders = () => {
    const allPlayerStats: Array<{ player: Player; team: Team; stats: GameStats }> = [];
    
    tournamentGames.forEach(game => {
      (game.gameStats ?? []).forEach(stat => {
        const playerTeam = tournamentTeams.find(team => 
          team.players.some(p => p.id === stat.playerId)
        );
        const player = playerTeam?.players.find(p => p.id === stat.playerId);
        
        if (player && playerTeam) {
          allPlayerStats.push({ player, team: playerTeam, stats: stat });
        }
      });
    });
    
    // Aggregate stats by player
    const playerTotals = new Map<string, { 
      player: Player; 
      team: Team; 
      totalStats: GameStats; 
      gamesPlayed: number; 
    }>();
    
    allPlayerStats.forEach(({ player, team, stats }) => {
      const existing = playerTotals.get(player.id);
      if (existing) {
        // Aggregate stats
        Object.keys(stats).forEach(key => {
          if (key !== 'playerId' && typeof stats[key as keyof GameStats] === 'number') {
            (existing.totalStats as any)[key] += (stats as any)[key];
          }
        });
        existing.gamesPlayed++;
      } else {
        playerTotals.set(player.id, {
          player,
          team,
          totalStats: { ...stats },
          gamesPlayed: 1
        });
      }
    });
    
    const playersArray = Array.from(playerTotals.values());
    
    return {
      points: playersArray.sort((a, b) => (b.totalStats.points / b.gamesPlayed) - (a.totalStats.points / a.gamesPlayed)).slice(0, 5),
      rebounds: playersArray.sort((a, b) => ((b.totalStats.orb + b.totalStats.drb) / b.gamesPlayed) - ((a.totalStats.orb + a.totalStats.drb) / a.gamesPlayed)).slice(0, 5),
      assists: playersArray.sort((a, b) => (b.totalStats.assists / b.gamesPlayed) - (a.totalStats.assists / a.gamesPlayed)).slice(0, 5),
      steals: playersArray.sort((a, b) => (b.totalStats.steals / b.gamesPlayed) - (a.totalStats.steals / a.gamesPlayed)).slice(0, 5),
      blocks: playersArray.sort((a, b) => (b.totalStats.blocks / b.gamesPlayed) - (a.totalStats.blocks / a.gamesPlayed)).slice(0, 5),
      threes: playersArray.sort((a, b) => (b.totalStats.three_made / b.gamesPlayed) - (a.totalStats.three_made / a.gamesPlayed)).slice(0, 5),
      efficiency: playersArray.map(p => ({
        ...p,
        eff: MetricsCalculator.calculateEfficiency(p.totalStats) / p.gamesPlayed
      })).sort((a, b) => b.eff - a.eff).slice(0, 5),
      fgPercentage: playersArray
        .filter(p => p.totalStats.fg_attempted >= p.gamesPlayed * 2) // Min 2 FGA per game
        .map(p => ({
          ...p,
          fgPct: (p.totalStats.fg_made / p.totalStats.fg_attempted) * 100
        }))
        .sort((a, b) => b.fgPct - a.fgPct)
        .slice(0, 5),
      threePercentage: playersArray
        .filter(p => p.totalStats.three_attempted >= p.gamesPlayed * 1) // Min 1 3PA per game
        .map(p => ({
          ...p,
          threePct: (p.totalStats.three_made / p.totalStats.three_attempted) * 100
        }))
        .sort((a, b) => b.threePct - a.threePct)
        .slice(0, 5),
      ftPercentage: playersArray
        .filter(p => p.totalStats.ft_attempted >= p.gamesPlayed * 1) // Min 1 FTA per game
        .map(p => ({
          ...p,
          ftPct: (p.totalStats.ft_made / p.totalStats.ft_attempted) * 100
        }))
        .sort((a, b) => b.ftPct - a.ftPct)
        .slice(0, 5),
    };
  };

  // Calculate additional team stats for standings
  const calculateStandingsWithExtendedStats = () => {
    return standings.map(standing => {
      const teamTotalStats = tournamentGames.reduce((acc, game) => {
        let teamStats = null;
        if (game.homeTeamId === standing.team.id) {
          teamStats = game.teamStats.home;
        } else if (game.awayTeamId === standing.team.id) {
          teamStats = game.teamStats.away;
        }
        
        if (teamStats) {
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
          };
        }
        return acc;
      }, {
        fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
        ft_made: 0, ft_attempted: 0, orb: 0, drb: 0, assists: 0
      });

      const rpg = standing.gamesPlayed > 0 ? (teamTotalStats.orb + teamTotalStats.drb) / standing.gamesPlayed : 0;
      const apg = standing.gamesPlayed > 0 ? teamTotalStats.assists / standing.gamesPlayed : 0;
      const fgPct = teamTotalStats.fg_attempted > 0 ? (teamTotalStats.fg_made / teamTotalStats.fg_attempted) * 100 : 0;
      const threePct = teamTotalStats.three_attempted > 0 ? (teamTotalStats.three_made / teamTotalStats.three_attempted) * 100 : 0;
      const ftPct = teamTotalStats.ft_attempted > 0 ? (teamTotalStats.ft_made / teamTotalStats.ft_attempted) * 100 : 0;

      return {
        ...standing,
        rpg,
        apg,
        fgPct,
        threePct,
        ftPct
      };
    });
  };
  
  const standings = calculateStandings();
  const leaders = getTournamentLeaders();
  const extendedStandings = calculateStandingsWithExtendedStats();
  
  // Team dialogs (hoisted outside tab components to avoid remount on keystroke)
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);

  const takenAbbreviations = teams.map((t) => t.abbreviation).filter(Boolean);

  const openCreateTeamDialog = useCallback(() => {
    setCreateFormKey((k) => k + 1);
    setIsCreateTeamDialogOpen(true);
  }, []);

  const handleTeamFormSubmit = useCallback(
    ({
      name,
      abbreviation,
      icon,
    }: {
      name: string;
      abbreviation: string;
      icon?: string;
      tournamentIds: string[];
    }) => {
      onCreateTeam(
        {
          name,
          abbreviation,
          icon,
          players: [],
          currentTournamentId: tournament.id,
        },
        { tournamentIds: [tournament.id] }
      );
      setIsCreateTeamDialogOpen(false);
    },
    [onCreateTeam, tournament.id]
  );

  const handleTeamFormCancel = useCallback(() => {
    setIsCreateTeamDialogOpen(false);
  }, []);

  // Get teams not in tournament
  const availableTeams = teams.filter(team => !tournament.teams.includes(team.id));
  
  const HomeTab = () => (
    <div className="space-y-6">
      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {tournament.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{tournamentTeams.length}</div>
              <div className="text-sm text-muted-foreground">Teams</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{tournamentGames.length}</div>
              <div className="text-sm text-muted-foreground">Games</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{tournament.year}</div>
              <div className="text-sm text-muted-foreground">{tournament.month}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tournamentGames.filter(g => g.isCompleted).length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Standings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Standings
              </div>
              <Button variant="ghost" size="sm" onClick={() => onTabChange('standings')}>
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {standings.slice(0, 5).map((standing, index) => {
                return (
                  <div key={standing.team.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => onNavigateToTeam(standing.team.id)}>
                    <div className="flex items-center gap-3">
                      <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                      <TeamBadge team={standing.team} teamId={standing.team.id} size="xs" />
                      <span className="font-medium">{standing.team.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {standing.wins}-{standing.losses}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Games */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => onTabChange('games')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tournamentGames.slice().reverse().slice(0, 5).map(game => {
                const homeTeam = resolveGameTeam(teams, game, 'home');
                const awayTeam = resolveGameTeam(teams, game, 'away');
                return (
                  <div 
                    key={game.id} 
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToGame(game.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <TeamBadge team={homeTeam} teamId={homeTeam.id} size="xs" />
                      <span className="text-sm">{homeTeam.name}</span>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <TeamBadge team={awayTeam} teamId={awayTeam.id} size="xs" />
                      <span className="text-sm">{awayTeam.name}</span>
                    </div>
                    {game.finalScore && (
                      <Badge variant="outline" className="text-xs">
                        {game.finalScore.home}-{game.finalScore.away}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaders - 3 Row Layout */}
      <div className="space-y-3">
        {/* Upper Row: PTS, REB, AST */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: 'PTS', data: leaders.points, key: 'points' },
            { title: 'REB', data: leaders.rebounds, key: 'rebounds' },
            { title: 'AST', data: leaders.assists, key: 'assists' }
          ].map(({ title, data, key }) => (
            <Card key={key} className="bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 p-3 pt-0">
                {data.slice(0, 5).map((player, index) => (
                  <div 
                    key={player.player.id}
                    className={`flex items-center justify-between cursor-pointer p-2 rounded-lg transition-colors ${
                      index === 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 
                      index === 1 ? 'bg-slate-100 dark:bg-slate-800/20' :
                      index === 2 ? 'bg-orange-50 dark:bg-orange-950/20' :
                      'hover:bg-muted/30'
                    }`}
                    onClick={() => onNavigateToPlayer(player.player.id, player.team.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-medium text-muted-foreground w-3 flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" title={player.player.name}>
                          {player.player.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {player.team.name}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold ml-2 flex-shrink-0">
                      {(key === 'points' ? player.totalStats.points / player.gamesPlayed : 
                       key === 'rebounds' ? (player.totalStats.orb + player.totalStats.drb) / player.gamesPlayed :
                       player.totalStats.assists / player.gamesPlayed).toFixed(1)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Middle Row: STL, BLK, 3PM, EFF */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { title: 'STL', data: leaders.steals, key: 'steals' },
            { title: 'BLK', data: leaders.blocks, key: 'blocks' },
            { title: '3PM', data: leaders.threes, key: 'threes' },
            { title: 'EFF', data: leaders.efficiency, key: 'efficiency' }
          ].map(({ title, data, key }) => (
            <Card key={key} className="bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 p-3 pt-0">
                {data.slice(0, 5).map((player, index) => (
                  <div 
                    key={player.player.id}
                    className={`flex items-center justify-between cursor-pointer p-2 rounded-lg transition-colors ${
                      index === 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 
                      index === 1 ? 'bg-slate-100 dark:bg-slate-800/20' :
                      index === 2 ? 'bg-orange-50 dark:bg-orange-950/20' :
                      'hover:bg-muted/30'
                    }`}
                    onClick={() => onNavigateToPlayer(player.player.id, player.team.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-medium text-muted-foreground w-3 flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" title={player.player.name}>
                          {player.player.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {player.team.name}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold ml-2 flex-shrink-0">
                      {(key === 'steals' ? player.totalStats.steals / player.gamesPlayed :
                       key === 'blocks' ? player.totalStats.blocks / player.gamesPlayed :
                       key === 'threes' ? player.totalStats.three_made / player.gamesPlayed :
                       (player as any).eff).toFixed(1)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lower Row: FG%, 3P%, FT% */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: 'FG%', data: leaders.fgPercentage, key: 'fgPercentage' },
            { title: '3P%', data: leaders.threePercentage, key: 'threePercentage' },
            { title: 'FT%', data: leaders.ftPercentage, key: 'ftPercentage' }
          ].map(({ title, data, key }) => (
            <Card key={key} className="bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 p-3 pt-0">
                {data.slice(0, 5).map((player, index) => (
                  <div 
                    key={player.player.id}
                    className={`flex items-center justify-between cursor-pointer p-2 rounded-lg transition-colors ${
                      index === 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 
                      index === 1 ? 'bg-slate-100 dark:bg-slate-800/20' :
                      index === 2 ? 'bg-orange-50 dark:bg-orange-950/20' :
                      'hover:bg-muted/30'
                    }`}
                    onClick={() => onNavigateToPlayer(player.player.id, player.team.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-medium text-muted-foreground w-3 flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" title={player.player.name}>
                          {player.player.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {player.team.name}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold ml-2 flex-shrink-0">
                      {(key === 'fgPercentage' ? (player as any).fgPct :
                       key === 'threePercentage' ? (player as any).threePct :
                       (player as any).ftPct).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const TeamsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Tournament Teams</h3>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{tournamentTeams.length} Teams</Badge>
          
          {availableTeams.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsAddTeamDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Team
            </Button>
          )}

          <Button onClick={openCreateTeamDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Team
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournamentTeams.map(team => {
          const teamStanding = standings.find(s => s.team.id === team.id);
          return (
            <Card 
              key={team.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigateToTeam(team.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3">
                  <TeamBadge team={team} teamId={team.id} size="lg" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{team.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {team.players.length} players
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamStanding && (
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <div className="font-bold">{teamStanding.wins}-{teamStanding.losses}</div>
                      <div className="text-xs text-muted-foreground">Record</div>
                    </div>
                    <div>
                      <div className="font-bold">{teamStanding.ppg.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">PPG</div>
                    </div>
                    <div>
                      <div className="font-bold">
                        {teamStanding.pointsDiff >= 0 ? '+' : ''}{teamStanding.pointsDiff}
                      </div>
                      <div className="text-xs text-muted-foreground">DIFF</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state for when no teams exist */}
      {tournamentTeams.length === 0 && (
        <Card className="text-center p-12">
          <CardContent className="space-y-4">
            <Users className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-medium">No teams in tournament</h3>
              <p className="text-muted-foreground">
                Add teams to this tournament to start tracking games and statistics.
              </p>
            </div>
            <Button onClick={openCreateTeamDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Team
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const StandingsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tournament Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">W</TableHead>
                  <TableHead className="text-center">L</TableHead>
                  <TableHead className="text-center">PPG</TableHead>
                  <TableHead className="text-center">PAPG</TableHead>
                  <TableHead className="text-center">DIFF</TableHead>
                  <TableHead className="text-center">PF</TableHead>
                  <TableHead className="text-center">PA</TableHead>
                  <TableHead className="text-center">FG%</TableHead>
                  <TableHead className="text-center">3P%</TableHead>
                  <TableHead className="text-center">FT%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extendedStandings.map((standing, index) => {
                  return (
                    <TableRow 
                      key={standing.team.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onNavigateToTeam(standing.team.id)}
                    >
                      <TableCell>
                        <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TeamBadge team={standing.team} teamId={standing.team.id} size="xs" />
                          <span className="font-medium">{standing.team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{standing.wins}</TableCell>
                      <TableCell className="text-center">{standing.losses}</TableCell>
                      <TableCell className="text-center">{standing.ppg.toFixed(1)}</TableCell>
                      <TableCell className="text-center">{standing.papg.toFixed(1)}</TableCell>
                      <TableCell className="text-center">
                        <span className={standing.pointsDiff >= 0 ? "text-green-600" : "text-red-600"}>
                          {standing.pointsDiff >= 0 ? '+' : ''}{standing.pointsDiff}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{standing.pointsFor}</TableCell>
                      <TableCell className="text-center">{standing.pointsAgainst}</TableCell>
                      <TableCell className="text-center">{standing.fgPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">{standing.threePct.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">{standing.ftPct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const PlayersTab = () => {
    const playersData = aggregatePlayerSeasonStats(tournamentGames, tournamentTeams);
    const shotDataCoverage = getShotDataCoverage(tournamentGames);
    const foulStatCoverage = getFoulStatCoverage(tournamentGames);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Player Stats</h3>
          <Badge variant="secondary">{playersData.length} Players</Badge>
        </div>

        <PlayerStatsTable
          rows={playersData}
          showTeamColumn
          shotDataCoverage={shotDataCoverage}
          foulStatCoverage={foulStatCoverage}
          onNavigateToPlayer={onNavigateToPlayer}
        />
      </div>
    );
  };

  // Games Tab - Shows all tournament games with filtering
  const GamesTab = () => {
    const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'ongoing'>('all');
    
    // Filter games based on status
    const filteredGames = tournamentGames.filter(game => {
      if (filterStatus === 'completed') return game.isCompleted;
      if (filterStatus === 'ongoing') return !game.isCompleted;
      return true;
    });

    // Sort by date (most recent first)
    const sortedGames = [...filteredGames].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
      <div className="space-y-6">
        {/* Filter Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  All Games ({tournamentGames.length})
                </Button>
                <Button
                  variant={filterStatus === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('completed')}
                >
                  Completed ({tournamentGames.filter(g => g.isCompleted).length})
                </Button>
                <Button
                  variant={filterStatus === 'ongoing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('ongoing')}
                >
                  Ongoing ({tournamentGames.filter(g => !g.isCompleted).length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Games List */}
        <div className="space-y-4">
          {sortedGames.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No {filterStatus !== 'all' && filterStatus} games found
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedGames.map((game) => {
              const homeTeam = resolveGameTeam(teams, game, 'home');
              const awayTeam = resolveGameTeam(teams, game, 'away');
              return (
                <Card 
                  key={game.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => onNavigateToGame(game.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      {/* Game Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          {/* Home Team */}
                          <div className="flex-1 flex items-center justify-end gap-2">
                            <div className="text-right">
                              <div className="font-medium">{homeTeam.name}</div>
                              <div className="text-xs text-muted-foreground">{homeTeam.abbreviation}</div>
                            </div>
                            <TeamBadge team={homeTeam} teamId={homeTeam.id} size="lg" />
                          </div>
                          
                          {/* Score */}
                          <div className="flex items-center gap-3 px-6">
                            {game.finalScore ? (
                              <>
                                <div className="text-2xl font-bold">{game.finalScore.home}</div>
                                <div className="text-muted-foreground">-</div>
                                <div className="text-2xl font-bold">{game.finalScore.away}</div>
                              </>
                            ) : (
                              <Badge variant="outline">Live</Badge>
                            )}
                          </div>
                          
                          {/* Away Team */}
                          <div className="flex-1 flex items-center gap-2">
                            <TeamBadge team={awayTeam} teamId={awayTeam.id} size="lg" />
                            <div className="text-left">
                              <div className="font-medium">{awayTeam.name}</div>
                              <div className="text-xs text-muted-foreground">{awayTeam.abbreviation}</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Date & Status */}
                        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span>{new Date(game.date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}</span>
                          {game.isCompleted && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs">Final</Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <TournamentBadge
              tournament={tournament}
              tournamentId={tournament.id}
              size="hero"
            />
            <div>
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <p className="text-muted-foreground">{tournament.month} {tournament.year}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {tournamentTeams.length} Teams • {tournamentGames.length} Games
        </Badge>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="players">Player Stats</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="space-y-6">
          <HomeTab />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <TeamsTab />
        </TabsContent>

        <TabsContent value="standings" className="space-y-6">
          <StandingsTab />
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <PlayersTab />
        </TabsContent>

        <TabsContent value="games" className="space-y-6">
          <GamesTab />
        </TabsContent>
      </Tabs>

      <Dialog open={isAddTeamDialogOpen} onOpenChange={setIsAddTeamDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team to Tournament</DialogTitle>
            <DialogDescription>
              Select an existing team to add to this tournament.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {availableTeams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  onAddTeamToTournament(team.id, tournament.id);
                  setIsAddTeamDialogOpen(false);
                }}
              >
                <div className="flex items-center gap-3">
                  <TeamBadge team={team} teamId={team.id} size="md" />
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {team.players.length} players
                    </div>
                  </div>
                </div>
                <Button size="sm">Add</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Create a new team for {tournament.name}. You can add players after creating the team.
            </DialogDescription>
          </DialogHeader>
          <TeamForm
            key={createFormKey}
            takenAbbreviations={takenAbbreviations}
            tournaments={[tournament]}
            initialTournamentIds={[tournament.id]}
            hideTournamentPicker
            onSubmit={handleTeamFormSubmit}
            onCancel={handleTeamFormCancel}
            isEditing={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}