import type { Game, GameStats, Player, Team, Tournament } from '../App';
import {
  getPlayersForTeamInTournament,
  resolvePlayerTeamSideInGame,
  type TournamentRosterEntry,
} from './tournamentRosters';
import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  gameHasShotChartData,
  getPlayerPaintAndFastbreakPoints,
} from './gameDisplay';
import {
  resolvePlayerTeamInGame,
  resolvePlayerTeamIdForGames,
} from './rosterPlayers';
import { getPlayerAgeAtTournamentSeason } from './playerAge';
import { getTournamentDateMs } from './tournamentSort';
import {
  perGameAverageOrNull,
  tournamentRecordsStat,
} from './statRecordingCoverage';
import {
  allTimeScopeLabel,
  DEFAULT_GAME_FORMAT_SCOPE,
  filterGamesByFormatScope,
  type GameFormatScope,
} from './gameFormat';
import {
  isAllTournamentsSelected,
  isNoTournamentsSelected,
  tournamentMatchesSelection,
  type TournamentIdSet,
} from './tournamentSelection';

export type TournamentScope = 'all' | string;

export interface PlayerSeasonRow {
  player: Player;
  team: Team;
  totalStats: GameStats;
  gamesPlayed: number;
  /** Sum of paint points from games with shot chart data. */
  paintPointsTotal: number;
  /** Sum of fastbreak points from games with shot chart data. */
  fastbreakPointsTotal: number;
  /** Games played that had shot chart tracking. */
  gamesWithShotData: number;
  /** Sum of fouls drawn from games in tournaments that recorded FDPG. */
  foulsDrawnTotal: number;
  gamesWithFoulsDrawnData: number;
  /** Sum of +/- from games in tournaments that recorded plus/minus. */
  plusMinusTotal: number;
  gamesWithPlusMinusData: number;
  /** Tournament or summary label for player-page breakdown rows. */
  scopeLabel?: string;
  /** Tournament id, `no-tournament`, or `all-time`. */
  scopeId?: string;
  /** Style as summary footer row (e.g. All Time). */
  isSummaryRow?: boolean;
  /** Age during tournament season; null for summary / unknown. */
  ageAtScope?: number | null;
  /** Tournament season start (ms) for Scope column sort; newest first when desc. */
  scopeSortDateMs?: number;
}

export interface ShotDataCoverage {
  gamesWithShotData: number;
  gamesTotal: number;
  isPartial: boolean;
}

export function getShotDataCoverage(games: Game[] | undefined): ShotDataCoverage {
  const scoped = games ?? [];
  const gamesTotal = scoped.length;
  const gamesWithShotData = scoped.filter((g) => gameHasShotChartData(g)).length;
  return {
    gamesWithShotData,
    gamesTotal,
    isPartial: gamesWithShotData > 0 && gamesWithShotData < gamesTotal,
  };
}

/** True when at least one player-game in scope has a non-zero value (stat was recorded). */
export interface FoulStatCoverage {
  blocksAgainst: boolean;
  techFouls: boolean;
  unsportsmanlikeFouls: boolean;
}

export function getFoulStatCoverage(games: Game[] | undefined): FoulStatCoverage {
  const coverage: FoulStatCoverage = {
    blocksAgainst: false,
    techFouls: false,
    unsportsmanlikeFouls: false,
  };

  for (const game of games ?? []) {
    for (const stat of game.gameStats ?? []) {
      if (stat.blocks_received > 0) coverage.blocksAgainst = true;
      if (stat.tech_fouls > 0) coverage.techFouls = true;
      if (stat.unsportsmanlike_fouls > 0) coverage.unsportsmanlikeFouls = true;
    }
  }

  return coverage;
}

export type PlayerStatsSortField =
  | 'Scope'
  | 'Player'
  | 'Team'
  | 'Age'
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
  | 'TOPG'
  | 'FPG'
  | 'ORPG'
  | 'FDPG'
  | '+/-'
  | 'GmSc'
  | 'EFF'
  | 'FG'
  | '3PT'
  | 'FT'
  | 'Paint'
  | 'FB'
  | 'BlocksAgainst'
  | 'TFPG'
  | 'UFPG';

const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

export function foulsDrawnPerGameForRow(row: PlayerSeasonRow): number | null {
  return perGameAverageOrNull(row.foulsDrawnTotal, row.gamesWithFoulsDrawnData);
}

export function plusMinusPerGameForRow(row: PlayerSeasonRow): number | null {
  return perGameAverageOrNull(row.plusMinusTotal, row.gamesWithPlusMinusData);
}

function emptyPlayerSeasonRowExtras(): Pick<
  PlayerSeasonRow,
  | 'paintPointsTotal'
  | 'fastbreakPointsTotal'
  | 'gamesWithShotData'
  | 'foulsDrawnTotal'
  | 'gamesWithFoulsDrawnData'
  | 'plusMinusTotal'
  | 'gamesWithPlusMinusData'
> {
  return {
    paintPointsTotal: 0,
    fastbreakPointsTotal: 0,
    gamesWithShotData: 0,
    foulsDrawnTotal: 0,
    gamesWithFoulsDrawnData: 0,
    plusMinusTotal: 0,
    gamesWithPlusMinusData: 0,
  };
}

function accumulateRecordedFoulAndPlusMinus(
  row: PlayerSeasonRow,
  game: Game,
  stat: GameStats
): void {
  if (tournamentRecordsStat(game.tournamentId, 'fouls_drawn')) {
    row.foulsDrawnTotal += stat.fouls_drawn;
    row.gamesWithFoulsDrawnData += 1;
  }
  if (tournamentRecordsStat(game.tournamentId, 'plus_minus')) {
    row.plusMinusTotal += stat.plus_minus;
    row.gamesWithPlusMinusData += 1;
  }
}

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
  tournamentScope: TournamentScope | TournamentIdSet
): Game[] {
  return (games ?? []).filter((game) => {
    if (!game.isCompleted) return false;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) return false;
    if (tournamentScope === null) {
      // all tournaments
    } else if (tournamentScope instanceof Set) {
      if (tournamentScope.size === 0) return false;
      if (!tournamentMatchesSelection(game.tournamentId, tournamentScope)) {
        return false;
      }
    } else if (tournamentScope !== 'all' && game.tournamentId !== tournamentScope) {
      return false;
    }
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

export function aggregatePlayerSeasonStats(
  games: Game[] | undefined,
  teams: Team[] | undefined,
  options?: {
    restrictTeamId?: string;
    /** When set with tournamentRosters, list only tournament-roster players (not full club rosters). */
    tournamentId?: string;
    tournamentRosters?: TournamentRosterEntry[];
  }
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
      const rosterMatch = rosterEntries.find(
        ({ player, team }) =>
          player.id === stat.playerId &&
          resolvePlayerTeamSideInGame(player.id, game) === team.id
      );
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
        ...emptyPlayerSeasonRowExtras(),
      });
    }
  });

  (games ?? []).forEach((game) => {
    if (!game.isCompleted) return;
    (game.gameStats ?? []).forEach((stat) => {
      const row = playerTotals.get(stat.playerId);
      if (!row) return;
      accumulateRecordedFoulAndPlusMinus(row, game, stat);
    });
  });

  (games ?? []).forEach((game) => {
    if (!gameHasShotChartData(game)) return;
    (game.gameStats ?? []).forEach((stat) => {
      const row = playerTotals.get(stat.playerId);
      if (!row) return;
      const { paintPoints, fastbreakPoints } = getPlayerPaintAndFastbreakPoints(
        game,
        stat.playerId
      );
      row.paintPointsTotal += paintPoints ?? 0;
      row.fastbreakPointsTotal += fastbreakPoints ?? 0;
      row.gamesWithShotData += 1;
    });
  });

  if (options?.tournamentId && options?.tournamentRosters) {
    const rosterPlayerIds = new Set<string>();
    for (const team of scopeTeams) {
      const rosterPlayers = getPlayersForTeamInTournament(
        team.id,
        options.tournamentId,
        safeTeams,
        options.tournamentRosters
      );
      for (const player of rosterPlayers) {
        rosterPlayerIds.add(player.id);
        if (!playerTotals.has(player.id)) {
          playerTotals.set(player.id, {
            player,
            team,
            totalStats: emptyGameStats(player.id),
            gamesPlayed: 0,
            ...emptyPlayerSeasonRowExtras(),
          });
        }
      }
    }
    return Array.from(playerTotals.values()).filter((row) =>
      rosterPlayerIds.has(row.player.id)
    );
  }

  scopeTeams.forEach((team) => {
    team.players.forEach((player) => {
      if (!playerTotals.has(player.id)) {
        playerTotals.set(player.id, {
          player,
          team,
          totalStats: emptyGameStats(player.id),
          gamesPlayed: 0,
          ...emptyPlayerSeasonRowExtras(),
        });
      }
    });
  });

  return Array.from(playerTotals.values());
}

export function aggregateSinglePlayerSeasonStats(
  player: Player,
  team: Team,
  games: Game[]
): PlayerSeasonRow {
  const totalStats = emptyGameStats(player.id);
  let gamesPlayed = 0;
  let paintPointsTotal = 0;
  let fastbreakPointsTotal = 0;
  let gamesWithShotData = 0;
  let foulsDrawnTotal = 0;
  let gamesWithFoulsDrawnData = 0;
  let plusMinusTotal = 0;
  let gamesWithPlusMinusData = 0;

  for (const game of games ?? []) {
    if (!game.isCompleted) continue;
    const stat = (game.gameStats ?? []).find((s) => s.playerId === player.id);
    if (!stat) continue;

    gamesPlayed++;
    (Object.keys(stat) as (keyof GameStats)[]).forEach((key) => {
      if (key !== 'playerId' && typeof stat[key] === 'number') {
        (totalStats as Record<string, number>)[key] += stat[key] as number;
      }
    });

    if (gameHasShotChartData(game)) {
      const { paintPoints, fastbreakPoints } = getPlayerPaintAndFastbreakPoints(
        game,
        player.id
      );
      paintPointsTotal += paintPoints ?? 0;
      fastbreakPointsTotal += fastbreakPoints ?? 0;
      gamesWithShotData++;
    }

    if (tournamentRecordsStat(game.tournamentId, 'fouls_drawn')) {
      foulsDrawnTotal += stat.fouls_drawn;
      gamesWithFoulsDrawnData += 1;
    }
    if (tournamentRecordsStat(game.tournamentId, 'plus_minus')) {
      plusMinusTotal += stat.plus_minus;
      gamesWithPlusMinusData += 1;
    }
  }

  return {
    player,
    team,
    totalStats,
    gamesPlayed,
    paintPointsTotal,
    fastbreakPointsTotal,
    gamesWithShotData,
    foulsDrawnTotal,
    gamesWithFoulsDrawnData,
    plusMinusTotal,
    gamesWithPlusMinusData,
  };
}

export function buildPlayerTournamentSeasonRows(
  player: Player,
  teams: Team[],
  games: Game[],
  tournaments: Tournament[],
  options?: { includeAllTime?: boolean; gameFormatScope?: GameFormatScope }
): PlayerSeasonRow[] {
  const gameFormatScope = options?.gameFormatScope ?? DEFAULT_GAME_FORMAT_SCOPE;

  const leagueTeams = teams.filter((t) =>
    (t.players ?? []).some((p) => p.id === player.id)
  );

  const playerGames = filterGamesByFormatScope(
    (games ?? []).filter(
      (game) =>
        game.isCompleted &&
        (game.gameStats ?? []).some((stat) => stat.playerId === player.id)
    ),
    gameFormatScope,
    tournaments
  );

  const byTournament = new Map<string, Game[]>();
  for (const game of playerGames) {
    const tournamentId = game.tournamentId ?? 'no-tournament';
    const bucket = byTournament.get(tournamentId);
    if (bucket) {
      bucket.push(game);
    } else {
      byTournament.set(tournamentId, [game]);
    }
  }

  const tournamentLabel = (tournamentId: string): string => {
    if (tournamentId === 'no-tournament') return 'No Tournament';
    return tournaments.find((t) => t.id === tournamentId)?.name ?? tournamentId;
  };

  const tournamentSortDateMs = (tournamentId: string): number => {
    if (tournamentId === 'no-tournament') return 0;
    const tournament = tournaments.find((t) => t.id === tournamentId);
    return tournament ? getTournamentDateMs(tournament) : 0;
  };

  const ageAtTournament = (tournamentId: string): number | null => {
    if (tournamentId === 'no-tournament' || tournamentId === 'all-time') {
      return null;
    }
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) return null;
    return getPlayerAgeAtTournamentSeason(
      player.dateOfBirth,
      tournament.month,
      tournament.year
    );
  };

  const rosterPlayerForTeam = (teamId: string | null): Player => {
    if (!teamId) return player;
    const team = leagueTeams.find((t) => t.id === teamId);
    return team?.players.find((p) => p.id === player.id) ?? player;
  };

  const teamForScope = (scopedGames: Game[]): Team => {
    const teamId = resolvePlayerTeamIdForGames(player.id, scopedGames, teams);
    const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
    return team ?? leagueTeams[0] ?? ({ id: '', name: '', abbreviation: '-', players: [] } as Team);
  };

  const allTimeTeam = (): Team => {
    const playedIds = new Set<string>();
    for (const game of playerGames) {
      const t = resolvePlayerTeamInGame(player.id, game, teams);
      if (t) playedIds.add(t.id);
    }
    if (playedIds.size <= 1) {
      const id = [...playedIds][0];
      return leagueTeams.find((t) => t.id === id) ?? leagueTeams[0];
    }
    const fallback = leagueTeams[0];
    return { ...fallback, abbreviation: 'Multi', name: 'Multiple teams' };
  };

  const rows: PlayerSeasonRow[] = [...byTournament.entries()]
    .sort(
      ([aId], [bId]) => tournamentSortDateMs(bId) - tournamentSortDateMs(aId)
    )
    .map(([tournamentId, scopedGames]) => {
      const team = teamForScope(scopedGames);
      const rosterPlayer = rosterPlayerForTeam(team.id);
      return {
        ...aggregateSinglePlayerSeasonStats(rosterPlayer, team, scopedGames),
        scopeLabel: tournamentLabel(tournamentId),
        scopeId: tournamentId,
        ageAtScope: ageAtTournament(tournamentId),
        scopeSortDateMs: tournamentSortDateMs(tournamentId),
      };
    });

  if (options?.includeAllTime !== false && playerGames.length > 0) {
    const team = allTimeTeam();
    const rosterPlayer = rosterPlayerForTeam(
      team.abbreviation === 'Multi' ? null : team.id
    );
    rows.push({
      ...aggregateSinglePlayerSeasonStats(rosterPlayer, team, playerGames),
      scopeLabel: allTimeScopeLabel(gameFormatScope),
      scopeId: 'all-time',
      isSummaryRow: true,
      ageAtScope: null,
    });
  }

  return rows;
}

export function buildSelectedTournamentsSummaryRow(
  player: Player,
  teams: Team[],
  games: Game[],
  tournaments: Tournament[],
  selectedIds: TournamentIdSet,
  gameFormatScope: GameFormatScope = DEFAULT_GAME_FORMAT_SCOPE
): PlayerSeasonRow | null {
  if (!selectedIds || selectedIds.size < 2) return null;

  const leagueTeams = teams.filter((t) =>
    (t.players ?? []).some((p) => p.id === player.id)
  );

  const playerGames = filterGamesByFormatScope(
    (games ?? []).filter(
      (game) =>
        game.isCompleted &&
        tournamentMatchesSelection(game.tournamentId, selectedIds) &&
        (game.gameStats ?? []).some((stat) => stat.playerId === player.id)
    ),
    gameFormatScope,
    tournaments
  );

  if (playerGames.length === 0) return null;

  const teamId = resolvePlayerTeamIdForGames(player.id, playerGames, teams);
  const team =
    (teamId ? teams.find((t) => t.id === teamId) : undefined) ??
    leagueTeams[0] ??
    ({ id: '', name: '', abbreviation: '-', players: [] } as Team);
  const rosterPlayer =
    team.players.find((p) => p.id === player.id) ?? player;

  return {
    ...aggregateSinglePlayerSeasonStats(rosterPlayer, team, playerGames),
    scopeLabel: `Selected (${selectedIds.size} tournaments)`,
    scopeId: 'selected-tournaments',
    isSummaryRow: true,
    ageAtScope: null,
  };
}

export function filterPlayerSeasonRowsForTournamentSelection(
  rows: PlayerSeasonRow[],
  selection: TournamentIdSet,
  availableIds: readonly string[],
  summaryRow: PlayerSeasonRow | null
): PlayerSeasonRow[] {
  const dataRows = rows.filter((row) => !row.isSummaryRow);

  if (isNoTournamentsSelected(selection)) {
    return [];
  }

  if (isAllTournamentsSelected(selection, availableIds)) {
    return rows;
  }

  if (selection.size === 1) {
    const id = [...selection][0];
    return dataRows.filter((row) => row.scopeId === id);
  }

  const selectedData = dataRows.filter(
    (row) => row.scopeId && selection.has(row.scopeId)
  );
  return summaryRow ? [...selectedData, summaryRow] : selectedData;
}

export function sortPlayerSeasonRows(
  rows: PlayerSeasonRow[],
  sortField: PlayerStatsSortField,
  sortOrder: 'asc' | 'desc'
): PlayerSeasonRow[] {
  const summaryRows = rows.filter((row) => row.isSummaryRow);
  const dataRows = rows.filter((row) => !row.isSummaryRow);

  const sorted = [...dataRows].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'Scope':
        if (
          a.scopeSortDateMs !== undefined ||
          b.scopeSortDateMs !== undefined
        ) {
          aValue = a.scopeSortDateMs ?? 0;
          bValue = b.scopeSortDateMs ?? 0;
        } else {
          aValue = (a.scopeLabel ?? a.player.name).toLowerCase();
          bValue = (b.scopeLabel ?? b.player.name).toLowerCase();
        }
        break;
      case 'Player':
        aValue = a.player.name.toLowerCase();
        bValue = b.player.name.toLowerCase();
        break;
      case 'Team':
        aValue = a.team.abbreviation;
        bValue = b.team.abbreviation;
        break;
      case 'Age':
        aValue = a.ageAtScope ?? -1;
        bValue = b.ageAtScope ?? -1;
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
        aValue = foulsDrawnPerGameForRow(a) ?? Number.NEGATIVE_INFINITY;
        bValue = foulsDrawnPerGameForRow(b) ?? Number.NEGATIVE_INFINITY;
        break;
      case '+/-':
        aValue = plusMinusPerGameForRow(a) ?? Number.NEGATIVE_INFINITY;
        bValue = plusMinusPerGameForRow(b) ?? Number.NEGATIVE_INFINITY;
        break;
      case 'EFF': {
        const aEff = MetricsCalculator.calculateEfficiency(a.totalStats);
        const bEff = MetricsCalculator.calculateEfficiency(b.totalStats);
        aValue = a.gamesPlayed > 0 ? aEff / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? bEff / b.gamesPlayed : 0;
        break;
      }
      case 'FG':
        aValue = a.totalStats.fg_attempted;
        bValue = b.totalStats.fg_attempted;
        if (aValue === bValue) {
          aValue = a.totalStats.fg_made;
          bValue = b.totalStats.fg_made;
        }
        break;
      case '3PT':
        aValue = a.totalStats.three_attempted;
        bValue = b.totalStats.three_attempted;
        if (aValue === bValue) {
          aValue = a.totalStats.three_made;
          bValue = b.totalStats.three_made;
        }
        break;
      case 'FT':
        aValue = a.totalStats.ft_attempted;
        bValue = b.totalStats.ft_attempted;
        if (aValue === bValue) {
          aValue = a.totalStats.ft_made;
          bValue = b.totalStats.ft_made;
        }
        break;
      case 'Paint':
        aValue =
          a.gamesWithShotData > 0
            ? a.paintPointsTotal / a.gamesWithShotData
            : Number.NEGATIVE_INFINITY;
        bValue =
          b.gamesWithShotData > 0
            ? b.paintPointsTotal / b.gamesWithShotData
            : Number.NEGATIVE_INFINITY;
        break;
      case 'FB':
        aValue =
          a.gamesWithShotData > 0
            ? a.fastbreakPointsTotal / a.gamesWithShotData
            : Number.NEGATIVE_INFINITY;
        bValue =
          b.gamesWithShotData > 0
            ? b.fastbreakPointsTotal / b.gamesWithShotData
            : Number.NEGATIVE_INFINITY;
        break;
      case 'BlocksAgainst':
        aValue =
          a.gamesPlayed > 0 ? a.totalStats.blocks_received / a.gamesPlayed : 0;
        bValue =
          b.gamesPlayed > 0 ? b.totalStats.blocks_received / b.gamesPlayed : 0;
        break;
      case 'TFPG':
        aValue = a.gamesPlayed > 0 ? a.totalStats.tech_fouls / a.gamesPlayed : 0;
        bValue = b.gamesPlayed > 0 ? b.totalStats.tech_fouls / b.gamesPlayed : 0;
        break;
      case 'UFPG':
        aValue =
          a.gamesPlayed > 0
            ? a.totalStats.unsportsmanlike_fouls / a.gamesPlayed
            : 0;
        bValue =
          b.gamesPlayed > 0
            ? b.totalStats.unsportsmanlike_fouls / b.gamesPlayed
            : 0;
        break;
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

  return [...sorted, ...summaryRows];
}

export function defaultSortOrderForField(
  field: PlayerStatsSortField
): 'asc' | 'desc' {
  if (field === 'Scope') {
    return 'desc';
  }
  if (
    field === 'Player' ||
    field === 'Team' ||
    field === 'Age' ||
    field === 'Position'
  ) {
    return 'asc';
  }
  return 'desc';
}
