import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Team, Game, Player, GameStats, Tournament } from '../App';
import { MetricsCalculator } from './MetricsCalculator';
import { AddPlayerDialog } from './AddPlayerDialog';
import { TeamForm, type TeamFormValues } from './forms/TeamForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ErrorBoundary } from './ErrorBoundary';
import { generateTeamAbbreviation } from '../utils/teamAbbreviation';
import {
  formatHeightForDisplay,
  formatWeightForDisplay,
} from '../lib/playerMeasurements';
import { PlayerStatsTable } from './PlayerStatsTable';
import { TeamBadge } from './TeamBadge';
import { ParticipatedTournamentBadges } from './ParticipatedTournamentBadges';
import { TournamentScopeSelect } from './TournamentScopeSelect';
import {
  aggregateTeamSeasonAverages,
  computeScopedTeamScoring,
  computeTeamSeasonDerived,
  sortGamesByDateDesc,
} from '../utils/gameDisplay';
import {
  aggregatePlayerSeasonStats,
  filterTeamScopeGames,
  getShotDataCoverage,
  getFoulStatCoverage,
  getTeamTournamentScopeOptions,
  type TournamentScope,
} from '../utils/playerSeasonStats';
import {
  getPlayersForTeamInTournament,
  getTeamRosterScopeOptions,
  type TournamentRosterEntry,
} from '../utils/tournamentRosters';
import { isPlayerOnTeam } from '../utils/rosterPlayers';
import { resolvePlayerAge } from '../utils/playerAge';
import { getParticipatedTournaments } from '../utils/teamTournaments';
import { 
  ArrowLeft,
  Users, 
  BarChart3, 
  Calendar,
  User,
  Target,
  Activity,
  TrendingUp,
  Medal,
  Crown,
  Star,
  MapPin,
  Plus,
  Edit,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

type RosterSortField =
  | 'number'
  | 'player'
  | 'primary'
  | 'secondary'
  | 'height'
  | 'weight'
  | 'age'
  | 'ppg'
  | 'rpg'
  | 'apg'
  | 'fgPct'
  | 'threePct'
  | 'ftPct';

function parseStoredCm(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStoredKg(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function shootingPctNum(made: number, attempted: number): number | null {
  if (attempted <= 0) return null;
  return (made / attempted) * 100;
}

function positionSortIndex(pos: string): number {
  const idx = POSITION_ORDER.indexOf(pos as (typeof POSITION_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

function compareNullableNumber(
  a: number | null,
  b: number | null,
  order: 'asc' | 'desc'
): number {
  const missing = order === 'asc' ? Infinity : -Infinity;
  const aVal = a ?? missing;
  const bVal = b ?? missing;
  return order === 'asc' ? aVal - bVal : bVal - aVal;
}

function formatShootingPct(made: number, attempted: number): string {
  if (attempted <= 0) return '-';
  return `${((made / attempted) * 100).toFixed(1)}%`;
}

function aggregateRosterPlayerSeasonStats(playerId: string, teamGames: Game[]) {
  const gameStatsList = teamGames.flatMap((game) =>
    (game.gameStats ?? []).filter((stat) => stat.playerId === playerId)
  );
  const gamesPlayed = gameStatsList.length;
  if (gamesPlayed === 0) {
    return {
      gamesPlayed: 0,
      ppg: 0,
      rpg: 0,
      apg: 0,
      fgPct: '-',
      threePct: '-',
      ftPct: '-',
      fgPctNum: null,
      threePctNum: null,
      ftPctNum: null,
    };
  }

  const totals = gameStatsList.reduce(
    (acc, stat) => ({
      points: acc.points + stat.points,
      rebounds: acc.rebounds + stat.orb + stat.drb,
      assists: acc.assists + stat.assists,
      fg_made: acc.fg_made + stat.fg_made,
      fg_attempted: acc.fg_attempted + stat.fg_attempted,
      three_made: acc.three_made + stat.three_made,
      three_attempted: acc.three_attempted + stat.three_attempted,
      ft_made: acc.ft_made + stat.ft_made,
      ft_attempted: acc.ft_attempted + stat.ft_attempted,
    }),
    {
      points: 0,
      rebounds: 0,
      assists: 0,
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
    }
  );

  return {
    gamesPlayed,
    ppg: totals.points / gamesPlayed,
    rpg: totals.rebounds / gamesPlayed,
    apg: totals.assists / gamesPlayed,
    fgPct: formatShootingPct(totals.fg_made, totals.fg_attempted),
    threePct: formatShootingPct(totals.three_made, totals.three_attempted),
    ftPct: formatShootingPct(totals.ft_made, totals.ft_attempted),
    fgPctNum: shootingPctNum(totals.fg_made, totals.fg_attempted),
    threePctNum: shootingPctNum(totals.three_made, totals.three_attempted),
    ftPctNum: shootingPctNum(totals.ft_made, totals.ft_attempted),
  };
}

interface RosterSortableHeadProps {
  label: string;
  field: RosterSortField;
  sortField: RosterSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: RosterSortField) => void;
  className?: string;
  center?: boolean;
}

function RosterSortableHead({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  className = '',
  center = false,
}: RosterSortableHeadProps) {
  const active = sortField === field;
  const icon = !active ? (
    <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
  ) : sortOrder === 'asc' ? (
    <ChevronUp className="w-3 h-3 shrink-0" />
  ) : (
    <ChevronDown className="w-3 h-3 shrink-0" />
  );

  return (
    <TableHead
      className={`cursor-pointer select-none ${active ? 'bg-muted/50' : ''} ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
        {label}
        {icon}
      </div>
    </TableHead>
  );
}

interface TeamPageProps {
  team: Team;
  teams: Team[];
  games: Game[];
  tournaments: Tournament[];
  orphanPlayers?: Player[];
  tournamentRosters?: TournamentRosterEntry[];
  activeTab: 'overview' | 'roster' | 'stats' | 'games';
  onTabChange: (tab: 'overview' | 'roster' | 'stats' | 'games') => void;
  onBack: () => void;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onNavigateToTournament: (tournamentId: string) => void;
  onUpdateTeam: (team: Team) => void;
}

export function TeamPage({ 
  team, 
  teams = [],
  games = [], 
  tournaments = [],
  orphanPlayers = [],
  tournamentRosters = [],
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToPlayer,
  onNavigateToGame,
  onNavigateToTournament,
  onUpdateTeam
}: TeamPageProps) {
  // Early return if team is not available
  if (!team) {
    return <div>Team not found</div>;
  }
  
  // Defensive check for required properties
  if (!team.id || !team.name || !Array.isArray(team.players)) {
    return <div>Invalid team data</div>;
  }
  
  // Player creation dialog state
  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const [isEditTeamDialogOpen, setIsEditTeamDialogOpen] = useState(false);
  const [rosterSortField, setRosterSortField] = useState<RosterSortField>('number');
  const [rosterSortOrder, setRosterSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statsTournamentScope, setStatsTournamentScope] =
    useState<TournamentScope>('all');
  const [rosterTournamentScope, setRosterTournamentScope] =
    useState<TournamentScope>('all');
  
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  const takenAbbreviations = useMemo(
    () =>
      teams
        .filter((t) => t.id !== team.id)
        .map((t) => t.abbreviation)
        .filter(Boolean),
    [teams, team.id]
  );

  const handleEditTeamSubmit = useCallback(
    ({ name, abbreviation, description, icon }: TeamFormValues) => {
      const resolvedAbbrev =
        abbreviation.trim().toUpperCase() ||
        generateTeamAbbreviation(name, takenAbbreviations);
      onUpdateTeam({
        ...team,
        name,
        abbreviation: resolvedAbbrev,
        description,
        icon,
      });
      setIsEditTeamDialogOpen(false);
    },
    [team, onUpdateTeam, takenAbbreviations]
  );
  
  const handleAddPlayerToRoster = useCallback((player: Player) => {
    if (isPlayerOnTeam(player.id, team.id, teams)) {
      return;
    }
    const updatedTeam = {
      ...team,
      players: [...(team.players || []), player],
    };
    onUpdateTeam(updatedTeam);
    setIsAddPlayerDialogOpen(false);
  }, [team, teams, onUpdateTeam]);
  
  // Get team games (newest first for display)
  const teamGames = useMemo(
    () =>
      games.filter(
        (game) => game.homeTeamId === team.id || game.awayTeamId === team.id
      ),
    [games, team.id]
  );
  const sortedTeamGames = useMemo(
    () => sortGamesByDateDesc(teamGames),
    [teamGames]
  );

  const statsTournamentOptions = useMemo(
    () => getTeamTournamentScopeOptions(team.id, teamGames, tournaments),
    [team.id, teamGames, tournaments]
  );

  const rosterScopeOptions = useMemo(
    () => getTeamRosterScopeOptions(team.id, teamGames, tournaments),
    [team.id, teamGames, tournaments]
  );

  useEffect(() => {
    setStatsTournamentScope('all');
    setRosterTournamentScope('all');
  }, [team.id]);

  const filteredStatsGames = useMemo(
    () => filterTeamScopeGames(teamGames, team.id, statsTournamentScope),
    [teamGames, team.id, statsTournamentScope]
  );

  const teamSeasonAggregate = useMemo(
    () => aggregateTeamSeasonAverages(filteredStatsGames, team),
    [filteredStatsGames, team]
  );

  const scopedTeamScoring = useMemo(
    () => computeScopedTeamScoring(filteredStatsGames, team.id),
    [filteredStatsGames, team.id]
  );

  const teamSeasonDerived = useMemo(
    () =>
      computeTeamSeasonDerived(
        teamSeasonAggregate.totals,
        teamSeasonAggregate.perGame,
        scopedTeamScoring
      ),
    [teamSeasonAggregate, scopedTeamScoring]
  );

  const playerSeasonRows = useMemo(
    () =>
      aggregatePlayerSeasonStats(filteredStatsGames, [team], {
        restrictTeamId: team.id,
      }),
    [filteredStatsGames, team]
  );

  const playerStatsShotCoverage = useMemo(
    () => getShotDataCoverage(filteredStatsGames),
    [filteredStatsGames]
  );

  const playerStatsFoulCoverage = useMemo(
    () => getFoulStatCoverage(filteredStatsGames),
    [filteredStatsGames]
  );

  const rosterStatsGames = useMemo(
    () =>
      rosterTournamentScope === 'all'
        ? teamGames
        : filterTeamScopeGames(teamGames, team.id, rosterTournamentScope),
    [teamGames, team.id, rosterTournamentScope]
  );

  const rosterPlayers = useMemo(() => {
    if (rosterTournamentScope === 'all') {
      return team.players;
    }
    return getPlayersForTeamInTournament(
      team.id,
      rosterTournamentScope,
      teams,
      tournamentRosters
    );
  }, [rosterTournamentScope, team.id, team.players, teams, tournamentRosters]);

  const selectedRosterScopeLabel = useMemo(
    () =>
      rosterScopeOptions.find((option) => option.value === rosterTournamentScope)
        ?.label ?? '',
    [rosterScopeOptions, rosterTournamentScope]
  );

  const rosterRows = useMemo(
    () =>
      rosterPlayers.map((player) => {
        const primary = player.position?.trim() || '';
        const secondary = player.secondaryPosition?.trim() || '';
        const age = resolvePlayerAge(player);
        return {
          player,
          primaryPosition: primary || '-',
          secondaryPosition:
            secondary && secondary !== primary ? secondary : '-',
          height: player.height?.trim()
            ? formatHeightForDisplay(player.height)
            : '-',
          weight: player.weight?.trim()
            ? formatWeightForDisplay(player.weight)
            : '-',
          heightCm: parseStoredCm(player.height ?? ''),
          weightKg: parseStoredKg(player.weight ?? ''),
          ageNum: age,
          ageDisplay: age !== null ? String(age) : '-',
          ...aggregateRosterPlayerSeasonStats(player.id, rosterStatsGames),
        };
      }),
    [rosterPlayers, rosterStatsGames]
  );

  const handleRosterSort = useCallback((field: RosterSortField) => {
    if (rosterSortField === field) {
      setRosterSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setRosterSortField(field);
    if (field === 'player' || field === 'primary' || field === 'secondary') {
      setRosterSortOrder('asc');
    } else if (field === 'number' || field === 'age') {
      setRosterSortOrder('asc');
    } else {
      setRosterSortOrder('desc');
    }
  }, [rosterSortField]);

  const sortedRosterRows = useMemo(() => {
    const rows = [...rosterRows];
    const order = rosterSortOrder;

    rows.sort((a, b) => {
      let cmp = 0;
      switch (rosterSortField) {
        case 'number':
          cmp = a.player.number - b.player.number;
          break;
        case 'player':
          cmp = a.player.name.localeCompare(b.player.name);
          break;
        case 'primary':
          cmp = positionSortIndex(a.primaryPosition) - positionSortIndex(b.primaryPosition);
          break;
        case 'secondary': {
          const aSec = a.secondaryPosition === '-' ? '' : a.secondaryPosition;
          const bSec = b.secondaryPosition === '-' ? '' : b.secondaryPosition;
          cmp =
            positionSortIndex(aSec || 'ZZ') - positionSortIndex(bSec || 'ZZ') ||
            aSec.localeCompare(bSec);
          break;
        }
        case 'height':
          cmp = compareNullableNumber(a.heightCm, b.heightCm, order);
          break;
        case 'weight':
          cmp = compareNullableNumber(a.weightKg, b.weightKg, order);
          break;
        case 'age':
          cmp = compareNullableNumber(a.ageNum, b.ageNum, order);
          break;
        case 'ppg':
          cmp = compareNullableNumber(
            a.gamesPlayed > 0 ? a.ppg : null,
            b.gamesPlayed > 0 ? b.ppg : null,
            order
          );
          break;
        case 'rpg':
          cmp = compareNullableNumber(
            a.gamesPlayed > 0 ? a.rpg : null,
            b.gamesPlayed > 0 ? b.rpg : null,
            order
          );
          break;
        case 'apg':
          cmp = compareNullableNumber(
            a.gamesPlayed > 0 ? a.apg : null,
            b.gamesPlayed > 0 ? b.apg : null,
            order
          );
          break;
        case 'fgPct':
          cmp = compareNullableNumber(a.fgPctNum, b.fgPctNum, order);
          break;
        case 'threePct':
          cmp = compareNullableNumber(a.threePctNum, b.threePctNum, order);
          break;
        case 'ftPct':
          cmp = compareNullableNumber(a.ftPctNum, b.ftPctNum, order);
          break;
        default:
          cmp = 0;
      }

      if (
        rosterSortField === 'height' ||
        rosterSortField === 'weight' ||
        rosterSortField === 'age' ||
        rosterSortField === 'ppg' ||
        rosterSortField === 'rpg' ||
        rosterSortField === 'apg' ||
        rosterSortField === 'fgPct' ||
        rosterSortField === 'threePct' ||
        rosterSortField === 'ftPct'
      ) {
        return cmp;
      }

      return order === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [rosterRows, rosterSortField, rosterSortOrder]);
  
  // Tournaments this team has participated in (games + roster)
  const participatedTournaments = useMemo(
    () => getParticipatedTournaments(team.id, games, tournaments),
    [team.id, games, tournaments]
  );
  
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
    const pointsDiff = pointsFor - pointsAgainst;
    
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
      (game.gameStats ?? []).forEach(stat => {
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
  
  const record = calculateRecord();
  const leaders = getTeamLeaders();
  
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Team Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <TeamBadge team={team} teamId={team.id} size="hero" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{team.name}</h2>
              {team.description && (
                <p className="text-muted-foreground mt-1">{team.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <Badge variant="outline">
                  {team.players.length} Players
                </Badge>
                <ParticipatedTournamentBadges
                  tournaments={participatedTournaments}
                  onNavigateToTournament={onNavigateToTournament}
                />
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
              {record.pointsDiff >= 0 ? '+' : ''}{record.pointsDiff}
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
          <Card key={title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => player && onNavigateToPlayer(player.player.id, team.id)}>
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
            {sortedTeamGames.slice(0, 5).map(game => {
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
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-medium">Team Roster</h3>
        <Badge variant="secondary">
          {rosterPlayers.length}{' '}
          {rosterPlayers.length === 1 ? 'Player' : 'Players'}
        </Badge>
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <TournamentScopeSelect
          options={rosterScopeOptions}
          value={rosterTournamentScope}
          onChange={setRosterTournamentScope}
          id="team-roster-tournament-scope"
        />
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => setIsAddPlayerDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Player
        </Button>
      </div>

      {rosterTournamentScope !== 'all' && (
        <p className="text-sm text-muted-foreground max-w-xl">
          Showing players who played for this team in {selectedRosterScopeLabel}.
          Club roster has {team.players.length}{' '}
          {team.players.length === 1 ? 'player' : 'players'}.
        </p>
      )}
      
      {rosterPlayers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            {rosterTournamentScope === 'all' ? (
              <>
                <h3 className="text-lg font-medium mb-2">No players yet</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Start building your roster by adding players to the team.
                </p>
                <Button onClick={() => setIsAddPlayerDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Player
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">No tournament roster yet</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  No players recorded for {selectedRosterScopeLabel}. Import a box
                  score or switch to Club roster (all) to see the full squad list.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <RosterSortableHead
                      label="#"
                      field="number"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-12"
                      center
                    />
                    <RosterSortableHead
                      label="Player"
                      field="player"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="min-w-[160px]"
                    />
                    <RosterSortableHead
                      label="Primary"
                      field="primary"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="Secondary"
                      field="secondary"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="Height"
                      field="height"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="min-w-[100px]"
                    />
                    <RosterSortableHead
                      label="Weight"
                      field="weight"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-20"
                      center
                    />
                    <RosterSortableHead
                      label="Age"
                      field="age"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="PPG"
                      field="ppg"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="RPG"
                      field="rpg"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="APG"
                      field="apg"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="FG%"
                      field="fgPct"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="3P%"
                      field="threePct"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                    <RosterSortableHead
                      label="FT%"
                      field="ftPct"
                      sortField={rosterSortField}
                      sortOrder={rosterSortOrder}
                      onSort={handleRosterSort}
                      className="w-14"
                      center
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRosterRows.map((row) => (
                    <TableRow
                      key={row.player.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onNavigateToPlayer(row.player.id, team.id)}
                    >
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {row.player.number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              {row.player.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{row.player.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {row.primaryPosition}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {row.secondaryPosition}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {row.height}
                      </TableCell>
                      <TableCell className="text-center text-sm whitespace-nowrap">
                        {row.weight}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {row.ageDisplay}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums">
                        {row.gamesPlayed > 0 ? row.ppg.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums">
                        {row.gamesPlayed > 0 ? row.rpg.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums">
                        {row.gamesPlayed > 0 ? row.apg.toFixed(1) : '-'}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums text-sm">
                        {row.fgPct}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums text-sm">
                        {row.threePct}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums text-sm">
                        {row.ftPct}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const StatsTab = () => {
    const { totals, perGame: teamStats } = teamSeasonAggregate;
    const derived = teamSeasonDerived;

    const formatPct = (value: number | null) =>
      value != null && Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';

    const formatRatio = (value: number | null) =>
      value != null && Number.isFinite(value) ? value.toFixed(1) : '—';

    const formatAdvancedPerGame = (perGameValue: number) =>
      Number.isFinite(perGameValue) ? perGameValue.toFixed(1) : '—';

    const TeamStatRow = ({
      label,
      value,
    }: {
      label: string;
      value: string;
    }) => (
      <div className="flex justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-mono tabular-nums">{value}</span>
      </div>
    );

    const StatColumn = ({
      title,
      children,
    }: {
      title: string;
      children: React.ReactNode;
    }) => (
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
        <div className="space-y-1">{children}</div>
      </div>
    );

    return (
      <div className="space-y-6">
        <TournamentScopeSelect
          options={statsTournamentOptions}
          value={statsTournamentScope}
          onChange={setStatsTournamentScope}
          id="team-stats-tournament-scope"
        />

        <Card>
          <CardHeader>
            <CardTitle>Team Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {derived.gamesWithScore > 0 ? derived.ppg.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">PPG</div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {derived.gamesWithScore > 0 ? derived.papg.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Opp PPG</div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {formatRatio(derived.astTo)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">AST/TO</div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {formatPct(derived.efgPct)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">eFG%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
              <StatColumn title="Scoring">
                <TeamStatRow
                  label="FG%"
                  value={formatPct(
                    totals.fg_attempted > 0
                      ? (totals.fg_made / totals.fg_attempted) * 100
                      : null
                  )}
                />
                <TeamStatRow label="2P%" value={formatPct(derived.twoPtPct)} />
                <TeamStatRow
                  label="3P%"
                  value={formatPct(
                    totals.three_attempted > 0
                      ? (totals.three_made / totals.three_attempted) * 100
                      : null
                  )}
                />
                <TeamStatRow
                  label="FT%"
                  value={formatPct(
                    totals.ft_attempted > 0
                      ? (totals.ft_made / totals.ft_attempted) * 100
                      : null
                  )}
                />
                <TeamStatRow label="TS%" value={formatPct(derived.tsPct)} />
              </StatColumn>

              <StatColumn title="Playmaking">
                <TeamStatRow label="APG" value={derived.apg.toFixed(1)} />
                <TeamStatRow label="TOPG" value={derived.topg.toFixed(1)} />
                <TeamStatRow label="AST/TO" value={formatRatio(derived.astTo)} />
              </StatColumn>

              <StatColumn title="Rebounding">
                <TeamStatRow label="ORB" value={teamStats.orb.toFixed(1)} />
                <TeamStatRow label="DRB" value={teamStats.drb.toFixed(1)} />
                <TeamStatRow label="RPG" value={derived.rpg.toFixed(1)} />
              </StatColumn>

              <StatColumn title="Defense">
                <TeamStatRow label="SPG" value={derived.spg.toFixed(1)} />
                <TeamStatRow label="BPG" value={derived.bpg.toFixed(1)} />
              </StatColumn>

              <StatColumn title="Discipline">
                <TeamStatRow label="FPG" value={derived.fpg.toFixed(1)} />
                <TeamStatRow label="FDPG" value={derived.fdpg.toFixed(1)} />
              </StatColumn>

              <StatColumn title="Advanced">
                <TeamStatRow
                  label="Paint Pts"
                  value={formatAdvancedPerGame(derived.paintPpg)}
                />
                <TeamStatRow
                  label="Fastbreak"
                  value={formatAdvancedPerGame(derived.fastbreakPpg)}
                />
                <TeamStatRow
                  label="2nd Chance"
                  value={formatAdvancedPerGame(derived.secondChancePpg)}
                />
                <TeamStatRow
                  label="Pts off TO"
                  value={formatAdvancedPerGame(derived.pointsOffTurnoversPpg)}
                />
              </StatColumn>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Player Stats</h3>
            <Badge variant="secondary">{playerSeasonRows.length} Players</Badge>
          </div>
          <PlayerStatsTable
            rows={playerSeasonRows}
            showTeamColumn={false}
            shotDataCoverage={playerStatsShotCoverage}
            foulStatCoverage={playerStatsFoulCoverage}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </div>
      </div>
    );
  };

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
              {sortedTeamGames.map(game => {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <TeamBadge team={team} teamId={team.id} size="hero" />
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <p className="text-sm text-muted-foreground">
                {record.wins}-{record.losses} • {team.players.length} Players
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditTeamDialogOpen(true)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Team
        </Button>
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

        <TabsContent value="roster" className="w-full">
          <RosterTab />
        </TabsContent>

        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>

        <TabsContent value="games">
          <GamesTab />
        </TabsContent>
      </Tabs>

      <AddPlayerDialog
        open={isAddPlayerDialogOpen}
        onOpenChange={setIsAddPlayerDialogOpen}
        team={team}
        teams={teams}
        tournaments={tournaments}
        orphanPlayers={orphanPlayers}
        positions={positions}
        onSubmit={handleAddPlayerToRoster}
      />

      <Dialog open={isEditTeamDialogOpen} onOpenChange={setIsEditTeamDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team Details</DialogTitle>
            <DialogDescription>
              Update team information and details.
            </DialogDescription>
          </DialogHeader>
          <ErrorBoundary>
            <TeamForm
              key={String(isEditTeamDialogOpen)}
              initialName={team.name}
              initialAbbreviation={team.abbreviation}
              initialDescription={team.description || ''}
              initialIcon={team.icon}
              teamId={team.id}
              takenAbbreviations={takenAbbreviations}
              onSubmit={handleEditTeamSubmit}
              onCancel={() => setIsEditTeamDialogOpen(false)}
              isEditing
            />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>
    </div>
  );
}