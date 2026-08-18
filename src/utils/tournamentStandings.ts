/**
 * LE-95.4 — Tournament standings (overall or per group).
 */

import type { Game, Team } from '../App';
import { sumPlayerStatsForRoster } from './gameDisplay';
import { resolvePlayerTeamSideInGame } from './tournamentRosters';
import type {
  TournamentGroup,
  TournamentStage,
  TournamentStructure,
} from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';
import { findGroupStage, resolveGroupStandingsTeams, resolveGroupTeamIds } from './groupMembers';
import { sortStandingRowsWithH2h } from './standingsTiebreak';
import { matchupGamesSorted } from './matchupGamePick';

export interface StandingRow {
  team: Team;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  ppg: number;
  papg: number;
}

export interface ExtendedStandingRow extends StandingRow {
  rpg: number;
  apg: number;
  /** null when no FG attempts were tracked among non-walkover games, or partial coverage */
  fgPct: number | null;
  /** null when no 3PA tracked */
  threePct: number | null;
  /** null when no FTA tracked */
  ftPct: number | null;
}

export interface GroupStandingsTable {
  stage: TournamentStage;
  group: TournamentGroup;
  standings: ExtendedStandingRow[];
}

/** Game ids referenced by classification bracket slots. */
export function collectBracketLinkedGameIds(
  structure: TournamentStructure | undefined
): Set<string> {
  const ids = new Set<string>();
  const normalized = normalizeTournamentStructure(structure);
  if (!normalized) return ids;
  for (const stage of normalized.stages) {
    if (stage.kind !== 'classification') continue;
    for (const round of stage.bracket?.rounds ?? []) {
      for (const slot of round.slots) {
        if (slot.gameId) ids.add(slot.gameId);
      }
    }
  }
  return ids;
}

/**
 * LE-104 — Knockout / classification games must not count in group RR,
 * even when both teams are in the same group.
 */
export function isExcludedFromGroupRoundRobin(
  game: Game,
  structure: TournamentStructure | undefined,
  linkedIds?: Set<string>
): boolean {
  if (game.bracketSlotId) return true;
  const linked = linkedIds ?? collectBracketLinkedGameIds(structure);
  if (linked.has(game.id)) return true;
  if (!game.stageId) return false;
  const normalized = normalizeTournamentStructure(structure);
  if (!normalized) return false;
  const stage = normalized.stages.find((s) => s.id === game.stageId);
  return stage?.kind === 'classification';
}

function resolveFinalScore(game: Game): { home: number; away: number } | null {
  if (game.finalScore) return game.finalScore;
  const home = game.teamStats?.home?.total_points;
  const away = game.teamStats?.away?.total_points;
  if (typeof home === 'number' && typeof away === 'number') {
    return { home, away };
  }
  return null;
}

/**
 * Walkover / forfeit: counts in W–L, but does not block standings FG%/3P%/FT%.
 * Detects classic 20–0 (FIBA), explicit meta notes, or 0-point + no box score.
 */
export function isWalkoverOrForfeit(game: Game): boolean {
  const score = resolveFinalScore(game);
  if (!score) return false;

  const meta = game.teamStats as { __meta?: { note?: string } } | undefined;
  const note = String(meta?.__meta?.note ?? '').toLowerCase();
  if (
    /\bwalkover\b/.test(note) ||
    /\bforfeit\b/.test(note) ||
    /\bw\.?\s*o\.?\b/.test(note)
  ) {
    return true;
  }

  // FIBA default forfeit score
  if (
    (score.home === 20 && score.away === 0) ||
    (score.home === 0 && score.away === 20)
  ) {
    return true;
  }

  // One side scored 0 and there is no player box — treat as forfeit/walkover
  if (
    (score.home === 0 || score.away === 0) &&
    (game.gameStats ?? []).length === 0
  ) {
    return true;
  }

  return false;
}

/** Group-stage / RR games only (excludes classification + bracket-linked). */
export function filterRoundRobinGames(
  games: Game[],
  structure?: TournamentStructure
): Game[] {
  const linkedIds = collectBracketLinkedGameIds(structure);
  return games.filter(
    (game) => !isExcludedFromGroupRoundRobin(game, structure, linkedIds)
  );
}

function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return b.pointsFor - a.pointsFor;
  });
}

function pctOrNull(made: number, attempted: number): number | null {
  if (attempted <= 0) return null;
  return (made / attempted) * 100;
}

/**
 * Prefer player box lines (live/import); fall back to teamStats when those
 * have attempts. Score-only games contribute nothing to shooting aggregates.
 */
function shootingTotalsForTeamGame(
  game: Game,
  team: Team
): {
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  orb: number;
  drb: number;
  assists: number;
} | null {
  if (game.homeTeamId !== team.id && game.awayTeamId !== team.id) {
    return null;
  }

  const rosterIds = new Set(team.players.map((p) => p.id));
  const sideRosterIds = new Set(
    [...rosterIds].filter(
      (id) => resolvePlayerTeamSideInGame(id, game) === team.id
    )
  );

  const hasPlayerBox = game.gameStats.some(
    (s) =>
      sideRosterIds.has(s.playerId) &&
      ((s.minutes_played ?? 0) > 0 ||
        (s.fg_attempted ?? 0) > 0 ||
        (s.points ?? 0) > 0)
  );

  if (hasPlayerBox) {
    const fromPlayers = sumPlayerStatsForRoster(game, sideRosterIds);
    return {
      fg_made: fromPlayers.fg_made,
      fg_attempted: fromPlayers.fg_attempted,
      three_made: fromPlayers.three_made,
      three_attempted: fromPlayers.three_attempted,
      ft_made: fromPlayers.ft_made,
      ft_attempted: fromPlayers.ft_attempted,
      orb: fromPlayers.orb,
      drb: fromPlayers.drb,
      assists: fromPlayers.assists,
    };
  }

  const teamStats =
    game.homeTeamId === team.id
      ? game.teamStats?.home
      : game.teamStats?.away;
  if (!teamStats) return null;

  const fgA = teamStats.fg_attempted ?? 0;
  const threeA = teamStats.three_attempted ?? 0;
  const ftA = teamStats.ft_attempted ?? 0;
  if (fgA <= 0 && threeA <= 0 && ftA <= 0) {
    return null;
  }

  return {
    fg_made: teamStats.fg_made ?? 0,
    fg_attempted: fgA,
    three_made: teamStats.three_made ?? 0,
    three_attempted: threeA,
    ft_made: teamStats.ft_made ?? 0,
    ft_attempted: ftA,
    orb: teamStats.orb ?? 0,
    drb: teamStats.drb ?? 0,
    assists: teamStats.assists ?? 0,
  };
}

/** W–L standings for the given teams using only the provided games. */
export function calculateTeamStandings(
  teams: Team[],
  games: Game[],
  options?: { h2hTiebreak?: boolean }
): StandingRow[] {
  const rows = teams.map((team) => {
    const teamGames = games.filter(
      (game) => game.homeTeamId === team.id || game.awayTeamId === team.id
    );

    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    for (const game of teamGames) {
      const score = resolveFinalScore(game);
      if (!score) continue;
      const isHome = game.homeTeamId === team.id;
      const teamScore = isHome ? score.home : score.away;
      const opponentScore = isHome ? score.away : score.home;
      pointsFor += teamScore;
      pointsAgainst += opponentScore;
      if (teamScore > opponentScore) wins += 1;
      else if (teamScore < opponentScore) losses += 1;
    }

    const gamesPlayed = wins + losses;
    return {
      team,
      wins,
      losses,
      gamesPlayed,
      winPercentage: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
      pointsFor,
      pointsAgainst,
      pointsDiff: pointsFor - pointsAgainst,
      ppg: gamesPlayed > 0 ? pointsFor / gamesPlayed : 0,
      papg: gamesPlayed > 0 ? pointsAgainst / gamesPlayed : 0,
    };
  });

  if (options?.h2hTiebreak) {
    return sortStandingRowsWithH2h(rows, games);
  }
  return sortStandings(rows);
}

export function withExtendedShootingStats(
  standings: StandingRow[],
  games: Game[]
): ExtendedStandingRow[] {
  return standings.map((standing) => {
    const scoredGames = games.filter((game) => {
      if (
        game.homeTeamId !== standing.team.id &&
        game.awayTeamId !== standing.team.id
      ) {
        return false;
      }
      return resolveFinalScore(game) != null;
    });

    const teamTotalStats = {
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      assists: 0,
    };

    // Only publish shooting % when every non-walkover scored game has tracked
    // shooting — partial coverage would understate/overstate FG% vs true season.
    // Walkovers/forfeits count in W–L but are exempt from this gate (LE-131).
    const shootingSample = scoredGames.filter((g) => !isWalkoverOrForfeit(g));
    let allGamesTracked = shootingSample.length > 0;
    for (const game of shootingSample) {
      const chunk = shootingTotalsForTeamGame(game, standing.team);
      if (!chunk) {
        allGamesTracked = false;
        break;
      }
      teamTotalStats.fg_made += chunk.fg_made;
      teamTotalStats.fg_attempted += chunk.fg_attempted;
      teamTotalStats.three_made += chunk.three_made;
      teamTotalStats.three_attempted += chunk.three_attempted;
      teamTotalStats.ft_made += chunk.ft_made;
      teamTotalStats.ft_attempted += chunk.ft_attempted;
      teamTotalStats.orb += chunk.orb;
      teamTotalStats.drb += chunk.drb;
      teamTotalStats.assists += chunk.assists;
    }

    return {
      ...standing,
      rpg:
        allGamesTracked && standing.gamesPlayed > 0
          ? (teamTotalStats.orb + teamTotalStats.drb) / standing.gamesPlayed
          : 0,
      apg:
        allGamesTracked && standing.gamesPlayed > 0
          ? teamTotalStats.assists / standing.gamesPlayed
          : 0,
      fgPct: allGamesTracked
        ? pctOrNull(teamTotalStats.fg_made, teamTotalStats.fg_attempted)
        : null,
      threePct: allGamesTracked
        ? pctOrNull(teamTotalStats.three_made, teamTotalStats.three_attempted)
        : null,
      ftPct: allGamesTracked
        ? pctOrNull(teamTotalStats.ft_made, teamTotalStats.ft_attempted)
        : null,
    };
  });
}

/** Games that count for a group's standings (tagged groupId, else both teams in group). */
export function filterGamesForGroup(
  games: Game[],
  group: TournamentGroup,
  structure?: TournamentStructure,
  stageId?: string
): Game[] {
  const members = new Set(resolveGroupTeamIds(group, structure));
  const linkedIds = collectBracketLinkedGameIds(structure);
  const groupStageId = stageId ?? findGroupStage(structure, group.id)?.id;
  const eligible = games.filter((game) => {
    if (isExcludedFromGroupRoundRobin(game, structure, linkedIds)) return false;
    if (game.groupId === group.id) return true;
    if (game.groupId) return false;
    if (groupStageId && game.stageId && game.stageId !== groupStageId) {
      return false;
    }
    return members.has(game.homeTeamId) && members.has(game.awayTeamId);
  });

  // LE-116: same pair met twice → only the earliest counts as RR
  return eligible.filter((game) => {
    const siblings = eligible.filter(
      (g) =>
        (g.homeTeamId === game.homeTeamId && g.awayTeamId === game.awayTeamId) ||
        (g.homeTeamId === game.awayTeamId && g.awayTeamId === game.homeTeamId)
    );
    if (siblings.length <= 1) return true;
    const earliest = matchupGamesSorted(
      siblings,
      game.homeTeamId,
      game.awayTeamId
    )[0];
    return earliest?.id === game.id;
  });
}

export function buildGroupStandingsTables(
  structureInput: TournamentStructure | undefined,
  allTeams: Team[],
  tournamentGames: Game[]
): GroupStandingsTable[] {
  const structure = normalizeTournamentStructure(structureInput);
  if (!structure) return [];

  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const tables: GroupStandingsTable[] = [];

  for (const stage of structure.stages) {
    if (stage.kind !== 'round_robin') continue;
    for (const group of stage.groups ?? []) {
      const teams = resolveGroupStandingsTeams(group, structure, teamById);
      const groupGames = filterGamesForGroup(
        tournamentGames,
        group,
        structure,
        stage.id
      );
      const standings = withExtendedShootingStats(
        calculateTeamStandings(teams, groupGames, { h2hTiebreak: true }),
        groupGames
      );
      tables.push({ stage, group, standings });
    }
  }

  return tables;
}
