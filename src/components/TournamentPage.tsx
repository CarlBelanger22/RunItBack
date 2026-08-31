import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Tournament, Team, Game, CreateTeamOptions } from '../App';
import type { TournamentUpdate } from '../App';
import type { TournamentTab } from '../routing/tabs';
import { PlayerStatsTable } from './PlayerStatsTable';
import { TournamentStructureEditor } from './TournamentStructureEditor';
import { TournamentClassificationBracket } from './TournamentClassificationBracket';
import { ClassificationVisualEditor } from './ClassificationVisualEditor';
import { TeamBadge } from './TeamBadge';
import { TournamentBadge } from './TournamentBadge';
import { TeamForm } from './forms/TeamForm';
import { TournamentForm } from './forms/TournamentForm';
import { aggregatePlayerSeasonStats, getFoulStatCoverage, getShotDataCoverage, getPlusMinusCoverage, getFoulsDrawnCoverage } from '../utils/playerSeasonStats';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
import { resolveGameTeam } from '../utils/gameTeams';
import { sortGamesByDateAsc } from '../utils/gameDisplay';
import {
  filterGamesForTournament,
  filterTeamsForTournament,
} from '../utils/tournamentEnrollment';
import {
  describeGameStageTag,
  retagTournamentGames,
} from '../utils/retagTournamentGames';
import {
  finalizeGroupSeedings,
  unlockGroupSeedings,
} from '../utils/finalizeGroupSeedings';
import { tournamentHasStructure, normalizeTournamentStructure } from '../utils/tournamentStructure';
import {
  buildGroupStandingsTables,
  filterGamesForGroup,
  filterRoundRobinGames,
  withExtendedShootingStats,
  calculateTeamStandings,
  type ExtendedStandingRow,
} from '../utils/tournamentStandings';
import { findH2hTieBlocks } from '../utils/standingsTiebreak';
import { GroupH2hDetailsDialog } from './GroupH2hDetailsDialog';
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
  Shield,
  Edit,
  Trash2,
  Info,
} from 'lucide-react';
import { wouldTournamentEnrollmentViolateOverlap } from '../utils/rosterPlayers';
import {
  isGameCompleted,
  isGameLive,
  isScheduledTournamentGame,
} from '../utils/scheduledGames';
import type { StatsEntryPrefill } from '../routing/statsEntryPrefill';
import {
  groupSeedLabels,
  isSeedPlaceholderTeamId,
  seedPlaceholderTeam,
} from '../utils/groupMembers';
import { buildGroupMatchRows, buildSeedFixtureRows, sortGamesTabEntries } from '../utils/groupMatchRows';
import { buildBracketFixtureRows } from '../utils/bracketFixtureRows';
import { normalizeSeedCode } from '../utils/seedCodes';

interface TournamentPageProps {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
  tournamentRosters: TournamentRosterEntry[];
  activeTab: TournamentTab;
  onTabChange: (tab: TournamentTab) => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onNavigateToStatsEntry?: (prefill: import('../routing/statsEntryPrefill').StatsEntryPrefill) => void;
  onResumeLiveGame?: (gameId: string) => void;
  activeGame?: Game | null;
  onCreateTeam: (teamData: Omit<Team, 'id'>, options?: CreateTeamOptions) => Team;
  onAddTeamToTournament: (teamId: string, tournamentId: string) => void;
  onUpdateTeam: (team: Team) => void;
  onUpdateTournament: (update: TournamentUpdate) => void;
  onDeleteTournament: (tournamentId: string) => void;
  onGamesUpdate: (games: Game[]) => void;
}

export function TournamentPage({ 
  tournament, 
  teams, 
  games,
  tournamentRosters,
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToTeam,
  onNavigateToPlayer,
  onNavigateToGame,
  onNavigateToStatsEntry,
  onResumeLiveGame,
  activeGame,
  onCreateTeam,
  onAddTeamToTournament,
  onUpdateTeam,
  onUpdateTournament,
  onDeleteTournament,
  onGamesUpdate,
}: TournamentPageProps) {
  
  // Teams/games derived from games table (tournamentId) with enrollment fallback
  const tournamentTeams = filterTeamsForTournament(tournament, games, teams);
  const tournamentGames = filterGamesForTournament(tournament, games);
  
  // Home + unstructured Standings: RR/group games only when structure exists
  // (exclude KO so Home matches Group standings — LE-131).
  const calculateStandings = () =>
    calculateTeamStandings(
      tournamentTeams,
      filterRoundRobinGames(tournamentGames, tournament.structure)
    );
  
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
      threes: playersArray.sort((a, b) => b.totalStats.three_made - a.totalStats.three_made).slice(0, 5),
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
  const calculateStandingsWithExtendedStats = () =>
    withExtendedShootingStats(
      standings,
      filterRoundRobinGames(tournamentGames, tournament.structure)
    );
  
  const standings = calculateStandings();
  const leaders = getTournamentLeaders();
  const extendedStandings = calculateStandingsWithExtendedStats();
  const groupStandingsTables = buildGroupStandingsTables(
    tournament.structure,
    tournamentTeams,
    tournamentGames
  );
  
  // Team dialogs (hoisted outside tab components to avoid remount on keystroke)
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);
  const [addTeamQuery, setAddTeamQuery] = useState('');
  const [isEditTournamentDialogOpen, setIsEditTournamentDialogOpen] = useState(false);
  const [editTournamentPane, setEditTournamentPane] = useState<'details' | 'structure'>(
    'details'
  );
  const [isDeleteTournamentDialogOpen, setIsDeleteTournamentDialogOpen] = useState(false);
  const [editTournamentError, setEditTournamentError] = useState<string | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);
  // LE-124 — hoist Games filters so `{GamesTab()}` is safe (no hooks inside tab fn)
  const [gamesFilterStatus, setGamesFilterStatus] = useState<
    'all' | 'completed' | 'live' | 'upcoming'
  >('all');
  const [gamesFilterStageId, setGamesFilterStageId] = useState<string>('all');

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

  const handleTournamentFormSubmit = useCallback(
    (data: {
      name: string;
      description: string;
      year: number;
      month: string;
      teams: string[];
      icon?: string;
    }) => {
      const newlyAdded = data.teams.filter((id) => !tournament.teams.includes(id));

      for (const teamId of newlyAdded) {
        const violation = wouldTournamentEnrollmentViolateOverlap(
          teamId,
          tournament.id,
          teams,
          [{ ...tournament, teams: data.teams }]
        );
        if (violation.violates) {
          setEditTournamentError(
            violation.message ?? 'Cannot add team to tournament.'
          );
          return;
        }
      }

      setEditTournamentError(null);
      onUpdateTournament({
        ...tournament,
        name: data.name,
        description: data.description,
        year: data.year,
        month: data.month,
        teams: data.teams,
        icon: data.icon,
      });
      setIsEditTournamentDialogOpen(false);
    },
    [tournament, teams, onUpdateTournament]
  );

  const handleTournamentFormCancel = useCallback(() => {
    setEditTournamentError(null);
    setIsEditTournamentDialogOpen(false);
  }, []);

  // Get teams not in tournament
  const availableTeams = teams.filter(
    (team) => !tournament.teams.includes(team.id)
  );
  const addTeamQueryNormalized = addTeamQuery.trim().toLowerCase();
  const filteredAvailableTeams = addTeamQueryNormalized
    ? availableTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(addTeamQueryNormalized) ||
          team.abbreviation.toLowerCase().includes(addTeamQueryNormalized)
      )
    : availableTeams;
  
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
        <CardContent className="space-y-4">
          {tournament.description?.trim() ? (
            <p className="text-sm text-muted-foreground">
              {tournament.description.trim().replace(/\s+/g, ' ')}
            </p>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{tournamentTeams.length}</div>
              <div className="text-sm text-muted-foreground">Teams</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tournamentGames.filter(isGameCompleted).length}
              </div>
              <div className="text-sm text-muted-foreground">Games</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{tournament.year}</div>
              <div className="text-sm text-muted-foreground">{tournament.month}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tournamentGames.filter(isScheduledTournamentGame).length}
              </div>
              <div className="text-sm text-muted-foreground">Scheduled</div>
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
                      {key === 'threes'
                        ? player.totalStats.three_made
                        : (key === 'steals' ? player.totalStats.steals / player.gamesPlayed :
                           key === 'blocks' ? player.totalStats.blocks / player.gamesPlayed :
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

  const [h2hDialog, setH2hDialog] = useState<{
    teamIds: string[];
    games: Game[];
  } | null>(null);

  const renderStandingsTable = (
    rows: ExtendedStandingRow[],
    opts?: { groupGames?: Game[]; showH2h?: boolean }
  ) => {
    const tieBlocks = opts?.showH2h ? findH2hTieBlocks(rows) : [];
    const tieStartIndexes = new Set(tieBlocks.map((b) => b.startIndex));
    const blockByStart = new Map(tieBlocks.map((b) => [b.startIndex, b]));

    return (
    <Table className="tournament-standings-table">
      <colgroup>
        <col className="tournament-standings-col-rank" />
        <col className="tournament-standings-col-team" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
        <col className="tournament-standings-col-stat" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
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
        {rows.map((standing, index) => {
          const seedPlaceholder = isSeedPlaceholderTeamId(standing.team.id);
          return (
          <TableRow
            key={standing.team.id}
            className={
              seedPlaceholder ? undefined : 'cursor-pointer hover:bg-muted/50'
            }
            onClick={() => {
              if (!seedPlaceholder) onNavigateToTeam(standing.team.id);
            }}
          >
            <TableCell>
              <Badge
                variant={index === 0 ? 'default' : 'secondary'}
                className="w-6 h-6 p-0 flex items-center justify-center text-xs"
              >
                {index + 1}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-2">
                {seedPlaceholder ? (
                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                    {standing.team.abbreviation}
                  </Badge>
                ) : (
                  <TeamBadge team={standing.team} teamId={standing.team.id} size="xs" />
                )}
                <span
                  className={
                    seedPlaceholder
                      ? 'truncate font-medium font-mono text-muted-foreground'
                      : 'truncate font-medium'
                  }
                >
                  {standing.team.name}
                </span>
                {tieStartIndexes.has(index) && opts?.groupGames && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h2h-explain-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const block = blockByStart.get(index);
                      if (!block) return;
                      setH2hDialog({
                        teamIds: block.teamIds,
                        games: opts.groupGames!,
                      });
                    }}
                  >
                    <Info className="h-3.5 w-3.5" />
                    Head to head
                  </Button>
                )}
              </div>
            </TableCell>
            <TableCell className="text-center">{standing.wins}</TableCell>
            <TableCell className="text-center">{standing.losses}</TableCell>
            <TableCell className="text-center">{standing.ppg.toFixed(1)}</TableCell>
            <TableCell className="text-center">{standing.papg.toFixed(1)}</TableCell>
            <TableCell className="text-center">
              <span
                className={
                  standing.pointsDiff >= 0 ? 'text-green-400' : 'text-red-400'
                }
              >
                {standing.pointsDiff >= 0 ? '+' : ''}
                {standing.pointsDiff}
              </span>
            </TableCell>
            <TableCell className="text-center">{standing.pointsFor}</TableCell>
            <TableCell className="text-center">{standing.pointsAgainst}</TableCell>
            <TableCell className="text-center">
              {standing.fgPct == null ? '—' : `${standing.fgPct.toFixed(1)}%`}
            </TableCell>
            <TableCell className="text-center">
              {standing.threePct == null
                ? '—'
                : `${standing.threePct.toFixed(1)}%`}
            </TableCell>
            <TableCell className="text-center">
              {standing.ftPct == null ? '—' : `${standing.ftPct.toFixed(1)}%`}
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
    );
  };

  const StandingsTab = () => {
    const teamById = new Map(tournamentTeams.map((t) => [t.id, t]));
    const stageSections: { stageId: string; stageName: string; tables: typeof groupStandingsTables }[] = [];
    for (const row of groupStandingsTables) {
      const hit = stageSections.find((s) => s.stageId === row.stage.id);
      if (hit) hit.tables.push(row);
      else stageSections.push({ stageId: row.stage.id, stageName: row.stage.name, tables: [row] });
    }

    // Seed-based RR stages (e.g. 5th–7th placing pool) render after the knockout bracket.
    const isSeedBasedStageSection = (section: (typeof stageSections)[number]) =>
      section.tables.some(({ group }) => groupSeedLabels(group).length > 0);
    const preBracketSections = stageSections.filter((s) => !isSeedBasedStageSection(s));
    const postBracketSections = stageSections.filter(isSeedBasedStageSection);

    const renderStageSections = (
      sections: typeof stageSections,
      showStageName: boolean
    ) =>
      sections.map(({ stageId, stageName, tables }) => (
            <div key={stageId} className="space-y-4">
              {showStageName ? (
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {stageName}
                </h3>
              ) : null}
              {tables.map(({ group, standings: groupRows, stage }) => {
            const groupGames = sortGamesByDateAsc(
              filterGamesForGroup(tournamentGames, group, tournament.structure, stage.id)
            );
            const matchRows = buildGroupMatchRows(
              group,
              tournament.structure,
              tournamentGames,
              teamById,
              stage.id
            );
            const memberCount = Math.max(
              groupRows.length,
              group.teamIds.length,
              groupSeedLabels(group).length
            );
            return (
              <Card key={group.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {group.name}
                    <Badge variant="secondary">{memberCount} teams</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="standings" className="group-standings-tabs">
                    <TabsList className="group-standings-tabs-list">
                      <TabsTrigger value="standings">Standings</TabsTrigger>
                      <TabsTrigger value="matches">Matches</TabsTrigger>
                    </TabsList>
                    <TabsContent value="standings" className="mt-4">
                      {renderStandingsTable(groupRows, {
                        groupGames,
                        showH2h: true,
                      })}
                    </TabsContent>
                    <TabsContent value="matches" className="mt-4">
                      {matchRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No matches yet
                        </p>
                      ) : (
                        <ul className="group-matches-list">
                          {matchRows.map((row) => {
                            const game = row.game;
                            const homeTeam = game
                              ? resolveGameTeam(teams, game, 'home')
                              : row.homeTeam ?? seedPlaceholderTeam(row.homeLabel);
                            const awayTeam = game
                              ? resolveGameTeam(teams, game, 'away')
                              : row.awayTeam ?? seedPlaceholderTeam(row.awayLabel);
                            const rowDate = row.date ?? game?.date;
                            const dateLabel = rowDate
                              ? new Date(rowDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '';
                            const timeSuffix = row.startTime ?? game?.startTime;
                            const hasScore =
                              game &&
                              (Boolean(game.finalScore) ||
                                (typeof game.teamStats?.home?.total_points ===
                                  'number' &&
                                  typeof game.teamStats?.away?.total_points ===
                                    'number' &&
                                  (game.isCompleted || game.isActive)));
                            const homeScore = game?.finalScore
                              ? game.finalScore.home
                              : game?.teamStats?.home?.total_points;
                            const awayScore = game?.finalScore
                              ? game.finalScore.away
                              : game?.teamStats?.away?.total_points;
                            const homeWins =
                              hasScore &&
                              typeof homeScore === 'number' &&
                              typeof awayScore === 'number' &&
                              homeScore > awayScore;
                            const awayWins =
                              hasScore &&
                              typeof homeScore === 'number' &&
                              typeof awayScore === 'number' &&
                              awayScore > homeScore;
                            const metaLabel =
                              game?.isActive && !hasScore
                                ? `Live · ${dateLabel}`
                                : timeSuffix
                                  ? `${dateLabel} · ${timeSuffix}`
                                  : dateLabel;
                            const openSummary =
                              game &&
                              (hasScore || game.isCompleted || game.isActive);
                            const homeSeed = isSeedPlaceholderTeamId(homeTeam.id);
                            const awaySeed = isSeedPlaceholderTeamId(awayTeam.id);

                            const renderSide = (
                              team: Team,
                              score: string | number | undefined,
                              muted: boolean,
                              seedStyle: boolean
                            ) => (
                              <div
                                className={
                                  muted
                                    ? 'group-match-side group-match-side--muted'
                                    : 'group-match-side'
                                }
                              >
                                {seedStyle ? (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-xs shrink-0"
                                  >
                                    {team.abbreviation}
                                  </Badge>
                                ) : (
                                  <TeamBadge team={team} teamId={team.id} size="sm" />
                                )}
                                <span
                                  className={
                                    seedStyle
                                      ? 'group-match-name font-mono text-muted-foreground'
                                      : 'group-match-name'
                                  }
                                  title={team.name}
                                >
                                  {team.name}
                                </span>
                                <span className="group-match-score">
                                  {score ?? '—'}
                                </span>
                              </div>
                            );

                            return (
                              <li key={row.key}>
                                {openSummary ? (
                                <button
                                  type="button"
                                  className="group-match-row"
                                  onClick={() => onNavigateToGame(game!.id)}
                                >
                                  <div className="group-match-row-teams">
                                    {renderSide(
                                      homeTeam,
                                      hasScore ? homeScore : undefined,
                                      awayWins,
                                      homeSeed
                                    )}
                                    {renderSide(
                                      awayTeam,
                                      hasScore ? awayScore : undefined,
                                      homeWins,
                                      awaySeed
                                    )}
                                  </div>
                                  <span className="group-match-row-date">
                                    {metaLabel}
                                  </span>
                                </button>
                                ) : (
                                  <div className="group-match-row group-match-row--static">
                                    <div className="group-match-row-teams">
                                      {renderSide(homeTeam, undefined, false, homeSeed)}
                                      {renderSide(awayTeam, undefined, false, awaySeed)}
                                    </div>
                                    <span className="group-match-row-date">
                                      {metaLabel}
                                    </span>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
            </div>
          ));

    return (
    <div className="space-y-6">
      {groupStandingsTables.length > 0 ? (
        <>
          {renderStageSections(preBracketSections, preBracketSections.length > 1)}
          <TournamentClassificationBracket
            tournament={tournament}
            games={tournamentGames}
            teams={tournamentTeams}
            mode="view"
            onUpdateTournament={onUpdateTournament}
            onGamesUpdate={onGamesUpdate}
            onNavigateToGame={onNavigateToGame}
          />
          {renderStageSections(postBracketSections, postBracketSections.length > 0)}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tournament Standings</CardTitle>
          </CardHeader>
          <CardContent>{renderStandingsTable(extendedStandings)}</CardContent>
        </Card>
      )}
    </div>
    );
  };

  const PlayersTab = () => {
    const playersData = aggregatePlayerSeasonStats(tournamentGames, tournamentTeams, {
      tournamentId: tournament.id,
      tournamentRosters,
    });
    const shotDataCoverage = getShotDataCoverage(tournamentGames);
    const foulStatCoverage = getFoulStatCoverage(tournamentGames);
    const plusMinusCoverage = getPlusMinusCoverage(tournamentGames);
    const foulsDrawnCoverage = getFoulsDrawnCoverage(tournamentGames);

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
          plusMinusCoverage={plusMinusCoverage}
          foulsDrawnCoverage={foulsDrawnCoverage}
          onNavigateToPlayer={onNavigateToPlayer}
          onNavigateToTeam={onNavigateToTeam}
        />
      </div>
    );
  };

  // Games Tab - Shows all tournament games with filtering
  const GamesTab = () => {
    const structure = normalizeTournamentStructure(tournament.structure);
    const hasStructure = tournamentHasStructure(structure);
    const teamById = new Map(tournamentTeams.map((t) => [t.id, t]));
    const seedFixtures = buildSeedFixtureRows(
      tournament.structure,
      tournamentGames,
      teamById
    );
    const bracketFixtures = buildBracketFixtureRows(
      tournament.structure,
      tournamentGames,
      teamById
    );
    const allFixtures = [...seedFixtures, ...bracketFixtures];

    // Filter games based on status
    const filteredGames = tournamentGames.filter((game) => {
      if (gamesFilterStatus === 'completed' && !isGameCompleted(game)) return false;
      if (gamesFilterStatus === 'live' && !isGameLive(game)) return false;
      if (gamesFilterStatus === 'upcoming' && !isScheduledTournamentGame(game)) {
        return false;
      }
      if (gamesFilterStageId !== 'all') {
        if (gamesFilterStageId === 'untagged') return !game.stageId;
        if (game.stageId !== gamesFilterStageId) return false;
      }
      return true;
    });

    const filteredFixtures = allFixtures.filter((fixture) => {
      if (gamesFilterStatus === 'completed' || gamesFilterStatus === 'live') {
        return false;
      }
      if (gamesFilterStatus === 'upcoming' || gamesFilterStatus === 'all') {
        if (gamesFilterStageId === 'all') return true;
        if (gamesFilterStageId === 'untagged') return false;
        return fixture.stageId === gamesFilterStageId;
      }
      return false;
    });

    type GamesTabEntry =
      | { kind: 'game'; game: Game; date?: string; startTime?: string }
      | {
          kind: 'fixture';
          fixture: (typeof allFixtures)[number];
          date?: string;
          startTime?: string;
        };

    const tabEntries: GamesTabEntry[] = [
      ...filteredGames.map((game) => ({
        kind: 'game' as const,
        game,
        date: game.date,
        startTime: game.startTime,
      })),
      ...filteredFixtures.map((fixture) => ({
        kind: 'fixture' as const,
        fixture,
        date: fixture.date,
        startTime: fixture.startTime,
      })),
    ];
    const sortedEntries = sortGamesTabEntries(tabEntries);

    const upcomingCount =
      tournamentGames.filter(isScheduledTournamentGame).length + allFixtures.length;
    const allTabCount = tournamentGames.length + allFixtures.length;

    const fixtureStageTag = (fixture: (typeof allFixtures)[number]) => {
      const stage = structure?.stages.find((s) => s.id === fixture.stageId);
      if (!stage) return null;
      if (fixture.bracketSlotId) {
        return fixture.slotLabel
          ? `${stage.name} · ${fixture.slotLabel}`
          : stage.name;
      }
      if (fixture.groupId) {
        const group = stage.groups?.find((g) => g.id === fixture.groupId);
        return group ? `${stage.name} · ${group.name}` : stage.name;
      }
      return stage.name;
    };

    const isFixtureSidePlaceholder = (team: Team, label: string) =>
      isSeedPlaceholderTeamId(team.id) ||
      Boolean(normalizeSeedCode(label)) ||
      /^(Winner|Loser)\s·/.test(label) ||
      label === 'TBD';

    return (
      <div className="space-y-6">
        {/* Filter Buttons */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={gamesFilterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGamesFilterStatus('all')}
                >
                  All Games ({allTabCount})
                </Button>
                <Button
                  variant={
                    gamesFilterStatus === 'completed' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setGamesFilterStatus('completed')}
                >
                  Completed ({tournamentGames.filter((g) => g.isCompleted).length})
                </Button>
                <Button
                  variant={
                    gamesFilterStatus === 'live' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setGamesFilterStatus('live')}
                >
                  Live ({tournamentGames.filter(isGameLive).length})
                </Button>
                <Button
                  variant={
                    gamesFilterStatus === 'upcoming' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setGamesFilterStatus('upcoming')}
                >
                  Upcoming ({upcomingCount})
                </Button>
              </div>
            </div>
            {hasStructure && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Stage:</span>
                <Button
                  variant={gamesFilterStageId === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGamesFilterStageId('all')}
                >
                  All stages
                </Button>
                {(structure?.stages ?? []).map((stage) => (
                  <Button
                    key={stage.id}
                    variant={
                      gamesFilterStageId === stage.id ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setGamesFilterStageId(stage.id)}
                  >
                    {stage.name}
                  </Button>
                ))}
                <Button
                  variant={
                    gamesFilterStageId === 'untagged' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setGamesFilterStageId('untagged')}
                >
                  Untagged
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Games List */}
        <div className="space-y-4">
          {sortedEntries.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No {gamesFilterStatus !== 'all' && gamesFilterStatus} games found
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedEntries.map((entry) => {
              if (entry.kind === 'fixture') {
                const { fixture } = entry;
                const homeTeam =
                  fixture.homeTeam ?? seedPlaceholderTeam(fixture.homeLabel);
                const awayTeam =
                  fixture.awayTeam ?? seedPlaceholderTeam(fixture.awayLabel);
                const homeSeed = isFixtureSidePlaceholder(homeTeam, fixture.homeLabel);
                const awaySeed = isFixtureSidePlaceholder(awayTeam, fixture.awayLabel);
                const stageTag = fixtureStageTag(fixture);

                return (
                  <Card key={fixture.key} className="transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4">
                            <div className="flex-1 flex items-center justify-end gap-2">
                              {homeSeed ? (
                                <>
                                  <div className="text-right">
                                    <div className="font-medium font-mono text-muted-foreground">
                                      {homeTeam.name}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="font-mono text-sm shrink-0">
                                    {homeTeam.abbreviation}
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <div className="text-right">
                                    <div className="font-medium">{homeTeam.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {homeTeam.abbreviation}
                                    </div>
                                  </div>
                                  <TeamBadge team={homeTeam} teamId={homeTeam.id} size="lg" />
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-3 px-6 shrink-0">
                              <span className="text-sm font-medium text-muted-foreground">
                                vs
                              </span>
                            </div>

                            <div className="flex-1 flex items-center gap-2">
                              {awaySeed ? (
                                <>
                                  <Badge variant="outline" className="font-mono text-sm shrink-0">
                                    {awayTeam.abbreviation}
                                  </Badge>
                                  <div className="text-left">
                                    <div className="font-medium font-mono text-muted-foreground">
                                      {awayTeam.name}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <TeamBadge team={awayTeam} teamId={awayTeam.id} size="lg" />
                                  <div className="text-left">
                                    <div className="font-medium">{awayTeam.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {awayTeam.abbreviation}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                            {fixture.date ? (
                              <span>
                                {new Date(fixture.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            ) : null}
                            {fixture.startTime ? (
                              <>
                                <span>•</span>
                                <span>{fixture.startTime}</span>
                              </>
                            ) : null}
                            <span>•</span>
                            <Badge variant="secondary" className="text-xs">
                              Upcoming
                            </Badge>
                            {stageTag ? (
                              <>
                                <span>•</span>
                                <Badge variant="secondary" className="text-xs">
                                  {stageTag}
                                </Badge>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              const { game } = entry;
              const homeTeam = resolveGameTeam(teams, game, 'home');
              const awayTeam = resolveGameTeam(teams, game, 'away');
              const stageTag = hasStructure
                ? describeGameStageTag(game, structure)
                : null;
              const scheduled = isScheduledTournamentGame(game);
              const live = isGameLive(game);
              const completed = isGameCompleted(game);
              const canTrackStats =
                scheduled && onNavigateToStatsEntry != null;
              const canOpenSummary = completed || live;
              const handleCardClick = () => {
                if (live && onResumeLiveGame) {
                  onResumeLiveGame(game.id);
                  return;
                }
                if (canOpenSummary) onNavigateToGame(game.id);
              };
              const prefill: StatsEntryPrefill = {
                gameId: game.id,
                tournamentId: tournament.id,
                homeTeamId: game.homeTeamId,
                awayTeamId: game.awayTeamId,
                date: game.date,
                startTime: game.startTime,
                stageId: game.stageId,
                groupId: game.groupId,
              };
              return (
                <Card
                  key={game.id}
                  className={
                    canOpenSummary || live
                      ? 'cursor-pointer hover:shadow-lg transition-shadow'
                      : 'transition-shadow'
                  }
                  onClick={handleCardClick}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex items-center justify-end gap-2">
                            <div className="text-right">
                              <div className="font-medium">{homeTeam.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {homeTeam.abbreviation}
                              </div>
                            </div>
                            <TeamBadge team={homeTeam} teamId={homeTeam.id} size="lg" />
                          </div>

                          <div className="flex items-center gap-3 px-6 shrink-0">
                            {completed && game.finalScore ? (
                              <>
                                <div className="text-2xl font-bold">
                                  {game.finalScore.home}
                                </div>
                                <div className="text-muted-foreground">-</div>
                                <div className="text-2xl font-bold">
                                  {game.finalScore.away}
                                </div>
                              </>
                            ) : live ? (
                              <Badge variant="default">Live</Badge>
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">
                                vs
                              </span>
                            )}
                          </div>

                          <div className="flex-1 flex items-center gap-2">
                            <TeamBadge team={awayTeam} teamId={awayTeam.id} size="lg" />
                            <div className="text-left">
                              <div className="font-medium">{awayTeam.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {awayTeam.abbreviation}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                          <span>
                            {new Date(game.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          {game.startTime ? (
                            <>
                              <span>•</span>
                              <span>{game.startTime}</span>
                            </>
                          ) : null}
                          {completed && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs">
                                Final
                              </Badge>
                            </>
                          )}
                          {scheduled && (
                            <>
                              <span>•</span>
                              <Badge variant="secondary" className="text-xs">
                                Scheduled
                              </Badge>
                            </>
                          )}
                          {stageTag && (
                            <>
                              <span>•</span>
                              <Badge variant="secondary" className="text-xs">
                                {stageTag}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      {canTrackStats && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            Boolean(activeGame) && activeGame?.id !== game.id
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToStatsEntry?.(prefill);
                          }}
                        >
                          Track stats
                        </Button>
                      )}
                      {live && onResumeLiveGame && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResumeLiveGame(game.id);
                          }}
                        >
                          Resume
                        </Button>
                      )}
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2 shrink-0 mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <TournamentBadge
              tournament={tournament}
              tournamentId={tournament.id}
              size="hero"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              {tournament.description?.trim() ? (
                <p className="text-muted-foreground mt-0.5">
                  {tournament.description.trim().replace(/\s+/g, ' ')}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {tournament.month} {tournament.year}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setEditTournamentError(null);
            setEditTournamentPane('details');
            setIsEditTournamentDialogOpen(true);
          }}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Tournament
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TournamentTab)}>
        <TabsList className="flex w-full flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="players">Player Stats</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="space-y-6">
          {HomeTab()}
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          {TeamsTab()}
        </TabsContent>

        <TabsContent value="standings" className="space-y-6">
          {StandingsTab()}
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          {PlayersTab()}
        </TabsContent>

        <TabsContent value="games" className="space-y-6">
          {GamesTab()}
        </TabsContent>
      </Tabs>

      <GroupH2hDetailsDialog
        open={h2hDialog != null}
        onOpenChange={(open) => {
          if (!open) setH2hDialog(null);
        }}
        teamIds={h2hDialog?.teamIds ?? []}
        teams={teams}
        games={h2hDialog?.games ?? []}
        onNavigateToGame={(gameId) => {
          setH2hDialog(null);
          onNavigateToGame(gameId);
        }}
      />

      <Dialog
        open={isAddTeamDialogOpen}
        onOpenChange={(open) => {
          setIsAddTeamDialogOpen(open);
          if (!open) setAddTeamQuery('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team to Tournament</DialogTitle>
            <DialogDescription>
              Select an existing team to add to this tournament.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={addTeamQuery}
            onChange={(e) => setAddTeamQuery(e.target.value)}
            placeholder="Search by name or abbreviation…"
            autoComplete="off"
            autoFocus
          />
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {filteredAvailableTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">
                {addTeamQueryNormalized
                  ? 'No matching teams left to add.'
                  : 'All teams are enrolled.'}
              </p>
            ) : (
              filteredAvailableTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    onAddTeamToTournament(team.id, tournament.id);
                    setIsAddTeamDialogOpen(false);
                    setAddTeamQuery('');
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
              ))
            )}
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

      <Dialog
        open={isEditTournamentDialogOpen}
        onOpenChange={(open) => {
          setIsEditTournamentDialogOpen(open);
          if (!open) setEditTournamentPane('details');
        }}
      >
        <DialogContent className="tournament-edit-dialog">
          <DialogHeader>
            <DialogTitle>Edit Tournament</DialogTitle>
            <DialogDescription>
              Update details, teams, or the tournament structure (stages, groups,
              classification).
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={editTournamentPane}
            onValueChange={(v) =>
              setEditTournamentPane(v as 'details' | 'structure')
            }
          >
            <TabsList className="flex w-full flex-wrap h-auto gap-1 justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 mt-4">
              {editTournamentError && (
                <p className="text-sm text-destructive">{editTournamentError}</p>
              )}
              <TournamentForm
                key={tournament.id}
                initialData={{
                  name: tournament.name,
                  description: tournament.description || '',
                  year: tournament.year,
                  month: tournament.month,
                  selectedTeams: tournament.teams,
                  icon: tournament.icon,
                }}
                tournamentId={tournament.id}
                teams={teams}
                onSubmit={handleTournamentFormSubmit}
                onCancel={handleTournamentFormCancel}
                isEditing
              />
              <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-destructive">Danger zone</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permanently delete this tournament from your league.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/30"
                  onClick={() => setIsDeleteTournamentDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete tournament
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="structure" className="mt-4">
              <TournamentStructureEditor
                tournament={tournament}
                teams={tournamentTeams}
                onSaveStructure={(structureOrUpdater) => {
                  if (typeof structureOrUpdater === 'function') {
                    onUpdateTournament({
                      id: tournament.id,
                      patch: (prev) => ({
                        ...prev,
                        structure: structureOrUpdater(prev.structure),
                      }),
                    });
                    return;
                  }
                  onUpdateTournament({
                    id: tournament.id,
                    patch: (prev) => ({
                      ...prev,
                      structure: structureOrUpdater,
                    }),
                  });
                }}
                onRetagGames={() => {
                  const { games: nextGames, report } = retagTournamentGames(
                    games,
                    tournament.id,
                    tournament.structure
                  );
                  onGamesUpdate(nextGames);
                  return report;
                }}
                onFinalizeSeedings={() => {
                  const { structure: nextStructure, games: nextGames, report } =
                    finalizeGroupSeedings(
                      tournament.structure,
                      games,
                      tournament.id,
                      tournamentTeams
                    );
                  onUpdateTournament({
                    id: tournament.id,
                    patch: (prev) => ({ ...prev, structure: nextStructure }),
                  });
                  onGamesUpdate(nextGames);
                  return report;
                }}
                onUnlockSeedings={() => {
                  const next = unlockGroupSeedings(tournament.structure, {
                    clearSnapshot: true,
                    clearSeedTeamIds: true,
                  });
                  onUpdateTournament({
                    id: tournament.id,
                    patch: (prev) => ({ ...prev, structure: next }),
                  });
                }}
                classificationEditor={
                  <ClassificationVisualEditor
                    tournament={tournament}
                    games={tournamentGames}
                    teams={tournamentTeams}
                    onUpdateTournament={onUpdateTournament}
                    onGamesUpdate={onGamesUpdate}
                    onNavigateToGame={onNavigateToGame}
                  />
                }
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteTournamentDialogOpen}
        onOpenChange={setIsDeleteTournamentDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tournament.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tournament from your league.
              {tournamentGames.length > 0 ? (
                <>
                  {' '}
                  {tournamentGames.length}{' '}
                  {tournamentGames.length === 1 ? 'game' : 'games'} will be kept
                  but unlinked from this tournament.
                </>
              ) : (
                <> Teams enrolled in this tournament are not deleted.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDeleteTournament(tournament.id);
                setIsDeleteTournamentDialogOpen(false);
                setIsEditTournamentDialogOpen(false);
                onBack();
              }}
            >
              Delete tournament
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}