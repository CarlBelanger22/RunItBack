/**
 * Admin Awards tab: top-5 contenders per stats-only award for one tournament.
 * Completed games only; ≥50% of that club's tournament games for eligibility.
 */
import type { Game, GameStats, Player, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { isGameCompleted } from './scheduledGames';
import { gameRecordsStat } from './statRecordingCoverage';
import {
  meetsTournamentLeaderFgFloor,
  meetsTournamentLeaderFtFloor,
  meetsTournamentLeaderGamesFloor,
  meetsTournamentLeaderThreeFloor,
} from './tournamentLeaders';
import {
  resolvePlayerTeamFromTournamentRoster,
  type TournamentRosterEntry,
} from './tournamentRosters';
import { resolvePlayerTeamInGame } from './rosterPlayers';

export type TournamentAwardId =
  | 'mvp'
  | 'dpoy'
  | 'sixth_man'
  | 'scoring'
  | 'playmaker'
  | 'rebounder'
  | 'iron_man'
  | 'plus_minus'
  | 'fg_pct'
  | 'three_pct'
  | 'ft_pct'
  | 'three_volume';

export interface AwardPlayerAggregate {
  playerId: string;
  player: Player;
  team: Team;
  jerseyNumber: number | null;
  gamesPlayed: number;
  teamGames: number;
  totalStats: GameStats;
  /** Games where starter lists were present and player was a starter. */
  starts: number;
  /** Games where starter lists were present and player was not a starter. */
  benchGames: number;
  /** Games whose box contributes to +/- average (coverage). */
  plusMinusGames: number;
  plusMinusTotal: number;
}

export interface AwardContender {
  playerId: string;
  player: Player;
  team: Team;
  jerseyNumber: number | null;
  gamesPlayed: number;
  teamGames: number;
  totalStats: GameStats;
  /** Primary sort key shown in tooltip context (e.g. GmSc/g). */
  sortValue: number;
  mpg: number | null;
  plusMinusPerGame: number | null;
  gmscPerGame: number;
}

export interface TournamentAwardSection {
  id: TournamentAwardId;
  title: string;
  tooltip: string;
  contenders: AwardContender[];
}

const TOP_N = 5;

function emptyStats(playerId: string): GameStats {
  return MetricsCalculator.getEmptyStats(playerId);
}

function addStats(into: GameStats, row: GameStats): void {
  for (const key of Object.keys(row) as (keyof GameStats)[]) {
    if (key === 'playerId') continue;
    const v = row[key];
    if (typeof v === 'number') {
      (into as Record<string, number>)[key] = ((into[key] as number) ?? 0) + v;
    }
  }
}

function gmscPerGame(stats: GameStats, gp: number): number {
  if (gp <= 0) return 0;
  return MetricsCalculator.calculateGameScore(stats) / gp;
}

function toContender(
  row: AwardPlayerAggregate,
  sortValue: number
): AwardContender {
  const gp = row.gamesPlayed;
  const minutes = row.totalStats.minutes_played;
  return {
    playerId: row.playerId,
    player: row.player,
    team: row.team,
    jerseyNumber: row.jerseyNumber,
    gamesPlayed: gp,
    teamGames: row.teamGames,
    totalStats: row.totalStats,
    sortValue,
    mpg: minutes > 0 && gp > 0 ? minutes / gp : null,
    plusMinusPerGame:
      row.plusMinusGames > 0 ? row.plusMinusTotal / row.plusMinusGames : null,
    gmscPerGame: gmscPerGame(row.totalStats, gp),
  };
}

function topBy(
  rows: AwardPlayerAggregate[],
  score: (r: AwardPlayerAggregate) => number,
  tieBreak?: (a: AwardPlayerAggregate, b: AwardPlayerAggregate) => number
): AwardContender[] {
  const ranked = [...rows].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return tieBreak?.(a, b) ?? 0;
  });
  return ranked.slice(0, TOP_N).map((r) => toContender(r, score(r)));
}

function isSixthManEligible(row: AwardPlayerAggregate): boolean {
  return row.benchGames > row.starts;
}

function starterListsPresent(game: Game): boolean {
  const home = game.homeStarters ?? [];
  const away = game.awayStarters ?? [];
  return home.length > 0 || away.length > 0;
}

function playerStartedGame(game: Game, playerId: string): boolean {
  const home = game.homeStarters ?? [];
  const away = game.awayStarters ?? [];
  return home.includes(playerId) || away.includes(playerId);
}

/**
 * Build per-player aggregates for award ranking from completed tournament games.
 */
export function aggregateTournamentAwardPlayers(input: {
  tournamentId: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
}): AwardPlayerAggregate[] {
  const { tournamentId, games, teams, tournamentRosters } = input;
  const completed = games.filter(isGameCompleted);

  const teamGames = new Map<string, number>();
  for (const game of completed) {
    const homeId = game.homeTeamId || game.homeTeam?.id;
    const awayId = game.awayTeamId || game.awayTeam?.id;
    if (homeId) teamGames.set(homeId, (teamGames.get(homeId) ?? 0) + 1);
    if (awayId) teamGames.set(awayId, (teamGames.get(awayId) ?? 0) + 1);
  }

  const byPlayer = new Map<string, AwardPlayerAggregate>();

  for (const game of completed) {
    const recordsPm = gameRecordsStat(game, 'plus_minus');
    const startersKnown = starterListsPresent(game);

    for (const stat of game.gameStats ?? []) {
      if (!stat?.playerId) continue;

      const fromRoster = resolvePlayerTeamFromTournamentRoster(
        stat.playerId,
        tournamentId,
        teams,
        tournamentRosters
      );
      const fromGame = fromRoster
        ? null
        : resolvePlayerTeamInGame(stat.playerId, game, teams);
      const player =
        fromRoster?.player ??
        fromGame?.players.find((p) => p.id === stat.playerId);
      const team = fromRoster?.team ?? fromGame;
      if (!player || !team) continue;

      let row = byPlayer.get(stat.playerId);
      if (!row) {
        const rosterEntry = tournamentRosters.find(
          (r) =>
            r.tournamentId === tournamentId &&
            r.playerId === stat.playerId &&
            r.teamId === team.id
        );
        const clubPlayer = team.players.find((p) => p.id === stat.playerId);
        const playerForRow: Player = {
          ...player,
          position: rosterEntry?.position || player.position,
          number:
            rosterEntry?.number ??
            (typeof clubPlayer?.number === 'number' ? clubPlayer.number : player.number),
        };
        row = {
          playerId: stat.playerId,
          player: playerForRow,
          team,
          jerseyNumber:
            rosterEntry?.number ??
            (typeof clubPlayer?.number === 'number' ? clubPlayer.number : null),
          gamesPlayed: 0,
          teamGames: teamGames.get(team.id) ?? 0,
          totalStats: emptyStats(stat.playerId),
          starts: 0,
          benchGames: 0,
          plusMinusGames: 0,
          plusMinusTotal: 0,
        };
        byPlayer.set(stat.playerId, row);
      }

      row.gamesPlayed += 1;
      addStats(row.totalStats, stat);

      if (startersKnown) {
        if (playerStartedGame(game, stat.playerId)) row.starts += 1;
        else row.benchGames += 1;
      }

      if (recordsPm) {
        row.plusMinusGames += 1;
        row.plusMinusTotal += Number(stat.plus_minus ?? 0);
      }
    }
  }

  // Refresh teamGames in case map was empty at insert time
  for (const row of byPlayer.values()) {
    row.teamGames = teamGames.get(row.team.id) ?? row.teamGames;
  }

  return [...byPlayer.values()];
}

export function tournamentHasPlusMinusCoverage(games: Game[]): boolean {
  return games.filter(isGameCompleted).some((g) => gameRecordsStat(g, 'plus_minus'));
}

function eligibleBase(rows: AwardPlayerAggregate[]): AwardPlayerAggregate[] {
  return rows.filter((r) =>
    meetsTournamentLeaderGamesFloor(r.gamesPlayed, r.teamGames)
  );
}

/**
 * Ordered award sections for the admin Awards tab.
 * Omits Plus/Minus when the tournament has no +/- coverage.
 */
export function buildTournamentAwardSections(
  players: AwardPlayerAggregate[],
  options: { includePlusMinus: boolean }
): TournamentAwardSection[] {
  const base = eligibleBase(players);
  const sections: TournamentAwardSection[] = [];

  sections.push({
    id: 'mvp',
    title: 'MVP',
    tooltip:
      'Highest average Game Score (GmSc) among players in at least half of their team’s completed tournament games.',
    contenders: topBy(base, (r) => gmscPerGame(r.totalStats, r.gamesPlayed), (a, b) => {
      const eff =
        MetricsCalculator.calculateEfficiency(b.totalStats) / b.gamesPlayed -
        MetricsCalculator.calculateEfficiency(a.totalStats) / a.gamesPlayed;
      if (eff !== 0) return eff;
      return b.totalStats.points / b.gamesPlayed - a.totalStats.points / a.gamesPlayed;
    }),
  });

  sections.push({
    id: 'dpoy',
    title: 'Defensive Player (DPOY)',
    tooltip:
      'Highest steals + blocks per game (box-score defense only). Eligible: ≥50% of team games. Ties: better +/− per game when tracked, otherwise fewer personal fouls per game.',
    contenders: topBy(
      base,
      (r) => (r.totalStats.steals + r.totalStats.blocks) / r.gamesPlayed,
      (a, b) => {
        if (a.plusMinusGames > 0 && b.plusMinusGames > 0) {
          const pm =
            b.plusMinusTotal / b.plusMinusGames - a.plusMinusTotal / a.plusMinusGames;
          if (pm !== 0) return pm;
        }
        return (
          a.totalStats.fouls / a.gamesPlayed - b.totalStats.fouls / b.gamesPlayed
        );
      }
    ),
  });

  const sixth = base.filter(isSixthManEligible);
  sections.push({
    id: 'sixth_man',
    title: 'Sixth Man',
    tooltip:
      'Highest GmSc per game among players who came off the bench in more games than they started (games with empty starter lists are skipped for that ratio). Also need ≥50% of team games.',
    contenders: topBy(sixth, (r) => gmscPerGame(r.totalStats, r.gamesPlayed)),
  });

  sections.push({
    id: 'scoring',
    title: 'Scoring',
    tooltip: 'Highest points per game. Eligible: ≥50% of team games.',
    contenders: topBy(base, (r) => r.totalStats.points / r.gamesPlayed),
  });

  sections.push({
    id: 'playmaker',
    title: 'Playmaker',
    tooltip:
      'Highest assists per game. Eligible: ≥50% of team games. Ties: higher assist-to-turnover ratio.',
    contenders: topBy(
      base,
      (r) => r.totalStats.assists / r.gamesPlayed,
      (a, b) => {
        const ratio = (r: AwardPlayerAggregate) =>
          r.totalStats.turnovers > 0
            ? r.totalStats.assists / r.totalStats.turnovers
            : r.totalStats.assists > 0
              ? Number.POSITIVE_INFINITY
              : 0;
        return ratio(b) - ratio(a);
      }
    ),
  });

  sections.push({
    id: 'rebounder',
    title: 'Rebounder',
    tooltip:
      'Highest rebounds per game (ORB+DRB). Eligible: ≥50% of team games. Ties: higher offensive rebounds per game.',
    contenders: topBy(
      base,
      (r) => (r.totalStats.orb + r.totalStats.drb) / r.gamesPlayed,
      (a, b) => b.totalStats.orb / b.gamesPlayed - a.totalStats.orb / a.gamesPlayed
    ),
  });

  const withMinutes = base.filter((r) => r.totalStats.minutes_played > 0);
  sections.push({
    id: 'iron_man',
    title: 'Iron Man',
    tooltip:
      'Highest minutes per game among players with recorded minutes. Eligible: ≥50% of team games.',
    contenders: topBy(withMinutes, (r) => r.totalStats.minutes_played / r.gamesPlayed),
  });

  if (options.includePlusMinus) {
    const withPm = base.filter((r) => r.plusMinusGames > 0);
    sections.push({
      id: 'plus_minus',
      title: 'Plus/Minus',
      tooltip:
        'Highest average plus/minus in games that record +/−. Eligible: ≥50% of team games.',
      contenders: topBy(withPm, (r) => r.plusMinusTotal / r.plusMinusGames),
    });
  }

  const fgPool = base.filter((r) =>
    meetsTournamentLeaderFgFloor(r.totalStats.fg_attempted, r.gamesPlayed)
  );
  sections.push({
    id: 'fg_pct',
    title: 'Field Goal %',
    tooltip:
      'Highest FG% with ≥4 field-goal attempts per game and ≥50% of team games.',
    contenders: topBy(fgPool, (r) =>
      r.totalStats.fg_attempted > 0
        ? r.totalStats.fg_made / r.totalStats.fg_attempted
        : 0
    ),
  });

  const threePool = base.filter((r) =>
    meetsTournamentLeaderThreeFloor(r.totalStats.three_attempted, r.gamesPlayed)
  );
  sections.push({
    id: 'three_pct',
    title: 'Three-Point %',
    tooltip:
      'Highest 3P% with ≥1.5 three-point attempts per game and ≥50% of team games.',
    contenders: topBy(threePool, (r) =>
      r.totalStats.three_attempted > 0
        ? r.totalStats.three_made / r.totalStats.three_attempted
        : 0
    ),
  });

  const ftPool = base.filter((r) =>
    meetsTournamentLeaderFtFloor(r.totalStats.ft_attempted, r.gamesPlayed)
  );
  sections.push({
    id: 'ft_pct',
    title: 'Free Throw %',
    tooltip:
      'Highest FT% with ≥2 free-throw attempts per game and ≥50% of team games.',
    contenders: topBy(ftPool, (r) =>
      r.totalStats.ft_attempted > 0
        ? r.totalStats.ft_made / r.totalStats.ft_attempted
        : 0
    ),
  });

  sections.push({
    id: 'three_volume',
    title: 'Three-Point Volume',
    tooltip:
      'Most threes made per game among players with ≥1.5 3PA per game and ≥50% of team games.',
    contenders: topBy(threePool, (r) => r.totalStats.three_made / r.gamesPlayed),
  });

  return sections;
}

export function buildTournamentAwardsForGames(input: {
  tournamentId: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
}): TournamentAwardSection[] {
  const players = aggregateTournamentAwardPlayers(input);
  return buildTournamentAwardSections(players, {
    includePlusMinus: tournamentHasPlusMinusCoverage(input.games),
  });
}
