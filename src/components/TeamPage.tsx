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
import {
  formatHeightForDisplay,
  formatWeightForDisplay,
} from '../lib/playerMeasurements';
import { PlayerStatsTable } from './PlayerStatsTable';
import { TeamBadge } from './TeamBadge';
import { ParticipatedTournamentBadges } from './ParticipatedTournamentBadges';
import { TournamentScopeSelect } from './TournamentScopeSelect';
import {
  aggregatePlayerSeasonStats,
  filterTeamScopeGames,
  getShotDataCoverage,
  getFoulStatCoverage,
  getTeamTournamentScopeOptions,
  type TournamentScope,
} from '../utils/playerSeasonStats';
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

type TeamStatsAverages = {
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  orb: number;
  drb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  points_off_turnovers: number;
  points_in_paint: number;
  second_chance_points: number;
  fastbreak_points: number;
  bench_points: number;
};

function statNum(value: number | null | undefined): number {
  return value ?? 0;
}

function calculateTeamStatsFromGames(games: Game[] | undefined, teamId: string): TeamStatsAverages {
  const completedGames = (games ?? []).filter((g) => g.isCompleted);
  const totalStats = completedGames.reduce(
    (acc, game) => {
      const side =
        game.homeTeamId === teamId
          ? game.teamStats?.home
          : game.teamStats?.away;
      return {
        fg_made: acc.fg_made + statNum(side?.fg_made),
        fg_attempted: acc.fg_attempted + statNum(side?.fg_attempted),
        three_made: acc.three_made + statNum(side?.three_made),
        three_attempted: acc.three_attempted + statNum(side?.three_attempted),
        ft_made: acc.ft_made + statNum(side?.ft_made),
        ft_attempted: acc.ft_attempted + statNum(side?.ft_attempted),
        orb: acc.orb + statNum(side?.orb),
        drb: acc.drb + statNum(side?.drb),
        assists: acc.assists + statNum(side?.assists),
        steals: acc.steals + statNum(side?.steals),
        blocks: acc.blocks + statNum(side?.blocks),
        turnovers: acc.turnovers + statNum(side?.turnovers),
        fouls: acc.fouls + statNum(side?.fouls),
        points_off_turnovers:
          acc.points_off_turnovers + statNum(side?.points_off_turnovers),
        points_in_paint: acc.points_in_paint + statNum(side?.points_in_paint),
        second_chance_points:
          acc.second_chance_points + statNum(side?.second_chance_points),
        fastbreak_points:
          acc.fastbreak_points + statNum(side?.fastbreak_points),
        bench_points: acc.bench_points + statNum(side?.bench_points),
      };
    },
    {
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      points_off_turnovers: 0,
      points_in_paint: 0,
      second_chance_points: 0,
      fastbreak_points: 0,
      bench_points: 0,
    }
  );

  const gamesPlayed = completedGames.length;
  if (gamesPlayed === 0) return totalStats;

  return {
    fg_made: totalStats.fg_made / gamesPlayed,
    fg_attempted: totalStats.fg_attempted / gamesPlayed,
    three_made: totalStats.three_made / gamesPlayed,
    three_attempted: totalStats.three_attempted / gamesPlayed,
    ft_made: totalStats.ft_made / gamesPlayed,
    ft_attempted: totalStats.ft_attempted / gamesPlayed,
    orb: totalStats.orb / gamesPlayed,
    drb: totalStats.drb / gamesPlayed,
    assists: totalStats.assists / gamesPlayed,
    steals: totalStats.steals / gamesPlayed,
    blocks: totalStats.blocks / gamesPlayed,
    turnovers: totalStats.turnovers / gamesPlayed,
    fouls: totalStats.fouls / gamesPlayed,
    points_off_turnovers: totalStats.points_off_turnovers / gamesPlayed,
    points_in_paint: totalStats.points_in_paint / gamesPlayed,
    second_chance_points: totalStats.second_chance_points / gamesPlayed,
    fastbreak_points: totalStats.fastbreak_points / gamesPlayed,
    bench_points: totalStats.bench_points / gamesPlayed,
  };
}

interface TeamPageProps {
  team: Team;
  teams: Team[];
  games: Game[];
  tournaments: Tournament[];
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
  const [rosterSortField, setRosterSortField] = useState<RosterSortField>('number');
  const [rosterSortOrder, setRosterSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statsTournamentScope, setStatsTournamentScope] =
    useState<TournamentScope>('all');
  
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  
  const handleAddPlayerToRoster = useCallback((player: Player) => {
    const updatedTeam = {
      ...team,
      players: [...(team.players || []), player],
    };
    onUpdateTeam(updatedTeam);
    setIsAddPlayerDialogOpen(false);
  }, [team, onUpdateTeam]);
  
  // Get team games
  const teamGames = games.filter(game => 
    game.homeTeamId === team.id || game.awayTeamId === team.id
  );

  const statsTournamentOptions = useMemo(
    () => getTeamTournamentScopeOptions(team.id, teamGames, tournaments),
    [team.id, teamGames, tournaments]
  );

  useEffect(() => {
    setStatsTournamentScope('all');
  }, [team.id]);

  const filteredStatsGames = useMemo(
    () => filterTeamScopeGames(teamGames, team.id, statsTournamentScope),
    [teamGames, team.id, statsTournamentScope]
  );

  const scopedTeamStats = useMemo(
    () => calculateTeamStatsFromGames(filteredStatsGames, team.id),
    [filteredStatsGames, team.id]
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

  const rosterRows = useMemo(
    () =>
      team.players.map((player) => {
        const primary = player.position?.trim() || '';
        const secondary = player.secondaryPosition?.trim() || '';
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
          ageNum:
            Number.isFinite(Number(player.age)) && Number(player.age) > 0
              ? Number(player.age)
              : null,
          ageDisplay:
            Number.isFinite(Number(player.age)) && Number(player.age) > 0
              ? String(player.age)
              : '-',
          ...aggregateRosterPlayerSeasonStats(player.id, teamGames),
        };
      }),
    [team.players, teamGames]
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
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{team.players.length} Players</Badge>
          <Button 
            size="sm"
            onClick={() => setIsAddPlayerDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </Button>
        </div>
      </div>
      
      {team.players.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No players yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Start building your roster by adding players to the team.
            </p>
            <Button onClick={() => setIsAddPlayerDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Player
            </Button>
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
    const teamStats = scopedTeamStats;

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
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Shooting</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm">FG%</span>
                    <span className="text-sm font-mono">
                      {teamStats.fg_attempted > 0
                        ? ((teamStats.fg_made / teamStats.fg_attempted) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">3P%</span>
                    <span className="text-sm font-mono">
                      {teamStats.three_attempted > 0
                        ? (
                            (teamStats.three_made / teamStats.three_attempted) *
                            100
                          ).toFixed(1)
                        : '0.0'}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">FT%</span>
                    <span className="text-sm font-mono">
                      {teamStats.ft_attempted > 0
                        ? ((teamStats.ft_made / teamStats.ft_attempted) * 100).toFixed(1)
                        : '0.0'}
                      %
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
                    <span className="text-sm font-mono">
                      {(teamStats.orb + teamStats.drb).toFixed(1)}
                    </span>
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
                    <span className="text-sm font-mono">
                      {teamStats.points_in_paint.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Fastbreak</span>
                    <span className="text-sm font-mono">
                      {teamStats.fastbreak_points.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">2nd Chance</span>
                    <span className="text-sm font-mono">
                      {teamStats.second_chance_points.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
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
          <TeamBadge team={team} teamId={team.id} size="hero" />
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

      <AddPlayerDialog
        open={isAddPlayerDialogOpen}
        onOpenChange={setIsAddPlayerDialogOpen}
        team={team}
        teams={teams}
        tournaments={tournaments}
        positions={positions}
        onSubmit={handleAddPlayerToRoster}
      />
    </div>
  );
}