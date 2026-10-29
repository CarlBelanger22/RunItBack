/**
 * Finals MVP: championship Final game only.
 * Score = 85% GmSc + 15% +/− (100% GmSc when +/− not tracked).
 * #1 defaults to best winner unless best loser clears +MARGIN.
 */
import type { Game, GameStats, Player, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { resolveSlotPlaces } from './bracketPlaces';
import { winnerLoserTeamIds } from './resolveBracketFeeders';
import { isGameCompleted } from './scheduledGames';
import { gameRecordsStat } from './statRecordingCoverage';
import {
  resolvePlayerTeamFromTournamentRoster,
  type TournamentRosterEntry,
} from './tournamentRosters';
import { resolvePlayerTeamInGame } from './rosterPlayers';
import {
  normalizeTournamentStructure,
  type TournamentStructure,
} from './tournamentStructure';

/** Same shape as AwardContender — kept local to avoid circular imports. */
export interface FinalsMvpContender {
  playerId: string;
  player: Player;
  team: Team;
  jerseyNumber: number | null;
  gamesPlayed: number;
  teamGames: number;
  totalStats: GameStats;
  sortValue: number;
  mpg: number | null;
  plusMinusPerGame: number | null;
  gmscPerGame: number;
}

export const FMVP_GMSC_WEIGHT = 0.85;
export const FMVP_PLUS_MINUS_WEIGHT = 0.15;
export const FMVP_LOSER_MARGIN = 5;
/** Max FMVP contenders returned; Awards UI shows 3 collapsed / 5 expanded. */
export const FMVP_TOP_N = 5;

export function finalsMvpScore(
  stats: GameStats,
  includePlusMinus: boolean
): number {
  const gmsc = MetricsCalculator.calculateGameScore(stats);
  if (!includePlusMinus) return gmsc;
  return (
    FMVP_GMSC_WEIGHT * gmsc + FMVP_PLUS_MINUS_WEIGHT * (stats.plus_minus ?? 0)
  );
}

/** Find completed championship Final (winner place 1 / loser place 2). */
export function findChampionshipFinalGame(
  structure: TournamentStructure | null | undefined,
  games: Game[]
): Game | null {
  const normalized = normalizeTournamentStructure(structure);
  const gameById = new Map(games.map((g) => [g.id, g]));

  if (normalized) {
    const stages = [...normalized.stages].sort((a, b) => a.order - b.order);
    for (const stage of stages) {
      if (stage.kind !== 'classification' || !stage.bracket?.rounds?.length) {
        continue;
      }
      const rounds = stage.bracket.rounds;
      for (const round of rounds) {
        for (const slot of round.slots) {
          if (slot.inactive) continue;
          const places = resolveSlotPlaces(slot, [slot.label, round.name]);
          if (places.winner !== 1 || places.loser !== 2) continue;
          const game = slot.gameId ? gameById.get(slot.gameId) : undefined;
          if (game && isGameCompleted(game)) return game;
        }
      }
    }
  }

  // Fallback: completed game whose id or bracketSlotId looks like the Final
  const tagged = games.filter(
    (g) =>
      isGameCompleted(g) &&
      (/final/i.test(g.id) || /final/i.test(String(g.bracketSlotId || ''))) &&
      !/3rd|third|semi|sf/i.test(g.id)
  );
  if (tagged.length === 1) return tagged[0];
  return null;
}

type FinalRow = {
  playerId: string;
  player: Player;
  team: Team;
  jerseyNumber: number | null;
  stats: GameStats;
  score: number;
  onWinner: boolean;
};

function resolvePlayerMeta(
  playerId: string,
  game: Game,
  teams: Team[],
  tournamentRosters: TournamentRosterEntry[]
): { player: Player; team: Team; jerseyNumber: number | null } | null {
  const tournamentId = game.tournamentId || '';
  const rosterHit = tournamentId
    ? resolvePlayerTeamFromTournamentRoster(
        playerId,
        tournamentId,
        teams,
        tournamentRosters
      )
    : null;
  if (rosterHit) {
    const entry = tournamentRosters.find(
      (r) => r.tournamentId === tournamentId && r.playerId === playerId
    );
    return {
      player: rosterHit.player,
      team: rosterHit.team,
      jerseyNumber: entry?.number ?? rosterHit.player.number ?? null,
    };
  }
  const team = resolvePlayerTeamInGame(playerId, game, teams);
  if (!team) return null;
  const player =
    team.players.find((p) => p.id === playerId) ||
    [...(game.homeTeam?.players || []), ...(game.awayTeam?.players || [])].find(
      (p) => p.id === playerId
    );
  if (!player) return null;
  return {
    player,
    team,
    jerseyNumber: player.number ?? null,
  };
}

function toContender(row: FinalRow): FinalsMvpContender {
  const minutes = row.stats.minutes_played;
  const gmsc = MetricsCalculator.calculateGameScore(row.stats);
  return {
    playerId: row.playerId,
    player: row.player,
    team: row.team,
    jerseyNumber: row.jerseyNumber,
    gamesPlayed: 1,
    teamGames: 1,
    totalStats: row.stats,
    sortValue: row.score,
    mpg: minutes > 0 ? minutes : null,
    plusMinusPerGame: Number.isFinite(row.stats.plus_minus)
      ? row.stats.plus_minus
      : null,
    gmscPerGame: gmsc,
  };
}

/**
 * Rank Finals MVP contenders (top 3). Empty if no completed Final / no box.
 */
export function buildFinalsMvpContenders(input: {
  structure: TournamentStructure | null | undefined;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
}): FinalsMvpContender[] {
  const game = findChampionshipFinalGame(input.structure, input.games);
  if (!game) return [];

  const wl = winnerLoserTeamIds(game);
  if (!wl) return [];

  const includePm = gameRecordsStat(game, 'plus_minus');
  const rows: FinalRow[] = [];

  for (const stat of game.gameStats || []) {
    if (!stat?.playerId) continue;
    const meta = resolvePlayerMeta(
      stat.playerId,
      game,
      input.teams,
      input.tournamentRosters
    );
    if (!meta) continue;
    const score = finalsMvpScore(stat, includePm);
    rows.push({
      playerId: stat.playerId,
      player: meta.player,
      team: meta.team,
      jerseyNumber: meta.jerseyNumber,
      stats: stat,
      score,
      onWinner: meta.team.id === wl.winnerId,
    });
  }

  if (rows.length === 0) return [];

  const byScore = (a: FinalRow, b: FinalRow) => {
    const d = b.score - a.score;
    if (d !== 0) return d;
    const pts = b.stats.points - a.stats.points;
    if (pts !== 0) return pts;
    const pm = (b.stats.plus_minus ?? 0) - (a.stats.plus_minus ?? 0);
    if (pm !== 0) return pm;
    return a.player.name.localeCompare(b.player.name);
  };

  const winners = rows.filter((r) => r.onWinner).sort(byScore);
  const losers = rows.filter((r) => !r.onWinner).sort(byScore);
  const bestWinner = winners[0] ?? null;
  const bestLoser = losers[0] ?? null;

  let titleHolder: FinalRow;
  if (
    bestLoser &&
    bestWinner &&
    bestLoser.score >= bestWinner.score + FMVP_LOSER_MARGIN
  ) {
    titleHolder = bestLoser;
  } else if (bestWinner) {
    titleHolder = bestWinner;
  } else {
    titleHolder = [...rows].sort(byScore)[0];
  }

  const rest = rows
    .filter((r) => r.playerId !== titleHolder.playerId)
    .sort(byScore);
  return [titleHolder, ...rest].slice(0, FMVP_TOP_N).map(toContender);
}
