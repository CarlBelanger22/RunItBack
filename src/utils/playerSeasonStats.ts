import type { Game, GameStats, Player, Team, Tournament } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';

export type TournamentScope = 'all' | string;

export interface PlayerSeasonRow {
  player: Player;
  team: Team;
  totalStats: GameStats;
  gamesPlayed: number;
}

export type PlayerStatsSortField =
  | 'Player'
  | 'Team'
  | 'Position'
  | 'GP'
  | 'MPG'
  | 'PPG'
  | 'RPG'
  | 'APG'
  | 'SPG'
  | 'BPG'
  | 'FG%'
  | 'FGM'
  | 'FGA'
  | '3P%'
  | '3PM'
  | '3PA'
  | 'FT%'
  | 'FTM'
  | 'FTA'
  | 'ORPG'
  | 'TOPG'
  | 'FPG'
  | 'FDPG'
  | '+/-'
  | 'GmSc'
  | 'EFF';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

function emptyGameStats(playerId: string): GameStats {
  return {
    playerId,
    points: 0,
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
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: 0,
  };
}

export function filterTeamScopeGames(
  games: Game[] | undefined,
  teamId: string,
  tournamentScope: TournamentScope
): Game[] {
  return (games ?? []).filter((game) => {
    if (!game.isCompleted) return false;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) return false;
    if (tournamentScope !== 'all' && game.tournamentId !== tournamentScope) return false;
    return true;
  });
}

export interface TournamentScopeOption {
  value: TournamentScope;
  label: string;
}

export function getTeamTournamentScopeOptions(
  teamId: string,
  teamGames: Game[] | undefined,
  tournaments: Tournament[] | undefined
): TournamentScopeOption[] {
  const ids = new Set<string>();
  for (const game of teamGames ?? []) {
    if (game.tournamentId) ids.add(game.tournamentId);
  }
  for (const tournament of tournaments ?? []) {
    if ((tournament.teams ?? []).includes(teamId)) ids.add(tournament.id);
  }

  const options: TournamentScopeOption[] = [{ value: 'all', label: 'All tournaments' }];
  for (const id of [...ids].sort()) {
    const tournament = (tournaments ?? []).find((t) => t.id === id);
    options.push({ value: id, label: tournament?.name ?? id });
  }
  return options;
}

export function resolveInitialTournamentScope(
  currentTournamentId: string | undefined,
  options: TournamentScopeOption[]
): TournamentScope {
  if (
    currentTournamentId &&
    options.some((o) => o.value === currentTournamentId)
  ) {
    return currentTournamentId;
  }
  return 'all';
}

export function aggregatePlayerSeasonStats(
  games: Game[] | undefined,
  teams: Team[] | undefined,
  options?: { restrictTeamId?: string }
): PlayerSeasonRow[] {
  const safeTeams = teams ?? [];
  const scopeTeams = options?.restrictTeamId
    ? safeTeams.filter((t) => t.id === options.restrictTeamId)
    : safeTeams;

  const rosterEntries = scopeTeams.flatMap((team) =>
    team.players.map((player) => ({ player, team }))
  );

  const allPlayerStats: Array<{ player: Player; team: Team; stats: GameStats }> = [];

  (games ?? []).forEach((game) => {
    (game.gameStats ?? []).forEach((stat) => {
      const rosterMatch = rosterEntries.find(({ player }) => player.id === stat.playerId);
      if (rosterMatch) {
        allPlayerStats.push({
          player: rosterMatch.player,
          team: rosterMatch.team,
          stats: stat,
        });
        return;
      }

      if (!options?.restrictTeamId) {
        const playerTeam = safeTeams.find((team) =>
          team.players.some((p) => p.id === stat.playerId)
        );
        const player = playerTeam?.players.find((p) => p.id === stat.playerId);
        if (player && playerTeam) {
          allPlayerStats.push({ player, team: playerTeam, stats: stat });
        }
      }
    });
  });

  const playerTotals = new Map<string, PlayerSeasonRow>();

  allPlayerStats.forEach(({ player, team, stats }) => {
    const existing = playerTotals.get(player.id);
    if (existing) {
      (Object.keys(stats) as (keyof GameStats)[]).forEach((key) => {
        if (key !== 'playerId' && typeof stats[key] === 'number') {
          (existing.totalStats as Record<string, number>)[key] +=
            stats[key] as number;
        }
      });
      existing.gamesPlayed++;
    } else {
      playerTotals.set(player.id, {
        player,
        team,
        totalStats: { ...stats },
        gamesPlayed: 1,
      });
    }
  });

  scopeTeams.forEach((team) => {
    team.players.forEach((player) => {
      if (!playerTotals.has(player.id)) {
        playerTotals.set(player.id, {
          player,
          team,
          totalStats: emptyGameStats(player.id),
          gamesPlayed: 0,
        });
      }
    });
  });

  return Array.from(playerTotals.values());
}

export function sortPlayerSeasonRows(
  rows: PlayerSeasonRow[],
  sortField: PlayerStatsSortField,
  sortOrder: 'asc' | 'desc'
): PlayerSeasonRow[] {
  const sorted = [...rows].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'Player':
        aValue = a.player.name.toLowerCase();
        bValue = b.player.name.toLowerCase();
        break;
      case 'Team':
        aValue = a.team.abbreviation;
        bValue = b.team.abbreviation;
        break;
      case 'Position': {
        const aPos = POSITION_ORDER.indexOf(
          a.player.position as (typeof POSITION_ORDER)[number]
        );
        const bPos = POSITION_ORDER.indexOf(
          b.player.position as (typeof POSITION_ORDER)[number]
        );
        const aIdx = aPos === -1 ? 999 : aPos;
        const bIdx = bPos === -1 ? 999 : bPos;
        if (sortOrder === 'asc') {
          aValue = aIdx;
          bValue = bIdx;
        } else {
          aValue = bIdx;
          bValue = aIdx;
        }
        break;
      }
      case 'GP':
        aValue = a.gamesPlayed;
        bValue = b.gamesPlayed;
        break;
      case 'MPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.minutes_played / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.minutes_played / b.gamesPlayed : 0;
        break;
      case 'PPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.points / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.points / b.gamesPlayed : 0;
        break;
      case 'RPG':
        aValue =
          a.gamesPlayed > 0
            ? (a.totalStats.orb + a.totalStats.drb) / a.gamesPlayed
            : 0;
        bValue =
          b.gamesPlayed > 0
            ? (b.totalStats.orb + b.totalStats.drb) / b.gamesPlayed
            : 0;
        break;
      case 'APG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.assists / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.assists / b.gamesPlayed : 0;
        break;
      case 'SPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.steals / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.steals / b.gamesPlayed : 0;
        break;
      case 'BPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.blocks / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.blocks / b.gamesPlayed : 0;
        break;
      case 'FG%':
        aValue =
          a.totalStats.fg_attempted > 0
            ? (a.totalStats.fg_made / a.totalStats.fg_attempted) * 100
            : 0;
        bValue =
          b.totalStats.fg_attempted > 0
            ? (b.totalStats.fg_made / b.totalStats.fg_attempted) * 100
            : 0;
        break;
      case 'FGM':
        aValue = a.gamesPlayed > 0 ? a.totalStats.fg_made / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.fg_made / b.gamesPlayed : 0;
        break;
      case 'FGA':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.fg_attempted / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.fg_attempted / b.gamesPlayed : 0;
        break;
      case '3P%':
        aValue =
          a.totalStats.three_attempted > 0
            ? (a.totalStats.three_made / a.totalStats.three_attempted) * 100
            : 0;
        bValue =
          b.totalStats.three_attempted > 0
            ? (b.totalStats.three_made / b.totalStats.three_attempted) * 100
            : 0;
        break;
      case '3PM':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.three_made / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.three_made / b.gamesPlayed : 0;
        break;
      case '3PA':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.three_attempted / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.three_attempted / b.gamesPlayed : 0;
        break;
      case 'FT%':
        aValue =
          a.totalStats.ft_attempted > 0
            ? (a.totalStats.ft_made / a.totalStats.ft_attempted) * 100
            : 0;
        bValue =
          b.totalStats.ft_attempted > 0
            ? (b.totalStats.ft_made / b.totalStats.ft_attempted) * 100
            : 0;
        break;
      case 'FTM':
        aValue = a.gamesPlayed > 0 ? a.totalStats.ft_made / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.ft_made / b.gamesPlayed : 0;
        break;
      case 'FTA':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.ft_attempted / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.ft_attempted / b.gamesPlayed : 0;
        break;
      case 'ORPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.orb / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.orb / b.gamesPlayed : 0;
        break;
      case 'TOPG':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.turnovers / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.turnovers / b.gamesPlayed : 0;
        break;
      case 'FPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.fouls / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.fouls / b.gamesPlayed : 0;
        break;
      case 'FDPG':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.fouls_drawn / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.fouls_drawn / b.gamesPlayed : 0;
        break;
      case '+/-':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.plus_minus / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.plus_minus / b.gamesPlayed : 0;
        break;
      case 'EFF': {
        const aEff = MetricsCalculator.calculateEfficiency(a.totalStats);
        const bEff = MetricsCalculator.calculateEfficiency(b.totalStats);
        aValue = a.gamesPlayed > 0 ? aEff / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? bEff / b.gamesPlayed : 0;
        break;
      }
      case 'GmSc': {
        const aGmSc = MetricsCalculator.calculateGameScore(a.totalStats);
        const bGmSc = MetricsCalculator.calculateGameScore(b.totalStats);
        aValue = a.gamesPlayed > 0 ? aGmSc / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? bGmSc / b.gamesPlayed : 0;
        break;
      }
      default:
        aValue = 0;
        bValue = 0;
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue as string)
        : (bValue as string).localeCompare(aValue);
    }

    return sortOrder === 'asc'
      ? aValue - (bValue as number)
      : (bValue as number) - aValue;
  });

  return sorted;
}

export function defaultSortOrderForField(
  field: PlayerStatsSortField
): 'asc' | 'desc' {
  if (field === 'Player' || field === 'Team' || field === 'Position') {
    return 'asc';
  }
  return 'desc';
}
