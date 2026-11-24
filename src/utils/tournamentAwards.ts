/**
 * Admin Awards tab: top contenders per stats-only award for one tournament.
 * Scoring returns up to 10; UI defaults to showing 5 (expand to 10).
 * Completed games only. Majors (MVP/DPOY/Sixth Man) ≥55% team GP;
 * other awards ≥50% (same as Home leaders).
 */
import type { Game, GameStats, Player, Team, Tournament } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { isGameCompleted } from './scheduledGames';
import { gameRecordsStat } from './statRecordingCoverage';
import {
  meetsTournamentLeaderGamesFloor,
  meetsTournamentMajorAwardGamesFloor,
} from './tournamentLeaders';
import {
  resolvePlayerTeamFromTournamentRoster,
  type TournamentRosterEntry,
} from './tournamentRosters';
import { resolvePlayerTeamInGame } from './rosterPlayers';
import { calculateTeamStandings } from './tournamentStandings';
import type { TournamentStructure } from './tournamentStructure';
import {
  buildTeamProgressionPlaces,
  countTournamentTeamsForProgression,
  progressionPlaceBonus,
  recordWinPlaceBonus,
  type TeamProgressionPlace,
} from './tournamentProgression';
import {
  aggregateClutchStatsByPlayer,
  clutchGmscPerGame,
  tournamentHasClutchPbpCoverage,
  type ClutchPlayerAggregate,
} from './tournamentClutch';
import {
  buildTeamDef01Map,
  buildTeamSuccessIndexMap,
  defenseValueRaw,
  dpoyScoreFromParts,
  DPOY_PLUS_MINUS_WEIGHT as DPOY_PM_WEIGHT,
  applyMissPenalty,
  gmscPerGameRaw,
  minmax01ById,
  mvpScoreFromParts,
  sixthScoreFromParts,
  tsiFromWinAndProgression,
} from './tournamentAwardScoring';
import { buildFinalsMvpContenders } from './tournamentFinalsMvp';
import { filterGamesForTournament } from './tournamentEnrollment';
import {
  earlierSeriesTournaments,
  isMostImprovedEligible,
  isRookieOfYearEligible,
  meetsMipPriorGamesFloor,
  pickPriorSeasonForMip,
  playerHasPriorSeriesGames,
  scoreMipPool,
  scoreRookiePool,
  shouldShowMostImprovedAward,
  shouldShowRookieAward,
  type MipScoreRow,
  type RookieScoreRow,
} from './tournamentRookieMipAwards';

/** Re-export for callers/tests that imported from awards. */
export const DPOY_PLUS_MINUS_WEIGHT = DPOY_PM_WEIGHT;

export type TournamentAwardId =
  | 'finals_mvp'
  | 'mvp'
  | 'dpoy'
  | 'sixth_man'
  | 'rookie'
  | 'most_improved'
  | 'clutch'
  | 'scoring'
  | 'playmaker'
  | 'rebounder'
  | 'iron_man'
  | 'plus_minus';

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

/**
 * MIP compare-to season snapshot (same season Score uses).
 * Expand row renders GP→GmSc from these fields; label = tournamentName.
 */
export interface MipPriorSeasonSnapshot {
  tournamentId: string;
  tournamentName: string;
  gamesPlayed: number;
  teamGames: number;
  totalStats: GameStats;
  mpg: number | null;
  plusMinusPerGame: number | null;
  gmscPerGame: number;
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
  /** Most Improved only — prior season used for Δ / expand. */
  mipPriorSeason?: MipPriorSeasonSnapshot;
}

export interface TournamentAwardSection {
  id: TournamentAwardId;
  title: string;
  tooltip: string;
  contenders: AwardContender[];
}

/** Max contenders returned; Awards UI shows 5 collapsed / 10 expanded. */
const TOP_N = 10;

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

function toMipPriorSeasonSnapshot(
  priorTournament: Pick<Tournament, 'id' | 'name'>,
  priorRow: AwardPlayerAggregate
): MipPriorSeasonSnapshot {
  const gp = priorRow.gamesPlayed;
  const minutes = priorRow.totalStats.minutes_played;
  return {
    tournamentId: priorTournament.id,
    tournamentName: priorTournament.name,
    gamesPlayed: gp,
    teamGames: priorRow.teamGames,
    totalStats: priorRow.totalStats,
    mpg: minutes > 0 && gp > 0 ? minutes / gp : null,
    plusMinusPerGame:
      priorRow.plusMinusGames > 0
        ? priorRow.plusMinusTotal / priorRow.plusMinusGames
        : null,
    gmscPerGame: gmscPerGame(priorRow.totalStats, gp),
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

/** Non-major awards + shared pools: ≥50% team GP. */
function eligibleBase(rows: AwardPlayerAggregate[]): AwardPlayerAggregate[] {
  return rows.filter((r) =>
    meetsTournamentLeaderGamesFloor(r.gamesPlayed, r.teamGames)
  );
}

/** MVP / DPOY / Sixth Man: ≥55% team GP. */
function eligibleMajors(rows: AwardPlayerAggregate[]): AwardPlayerAggregate[] {
  return rows.filter((r) =>
    meetsTournamentMajorAwardGamesFloor(r.gamesPlayed, r.teamGames)
  );
}

/**
 * Team defensive context for DPOY: ±15% from points-allowed/g rank
 * (best PAPG → 1.15, worst → 0.85). Teams with no scored games → 1.0.
 */
export function buildTeamDefMultiplierMap(
  games: Game[],
  teams: Team[]
): Map<string, number> {
  const completed = games.filter(isGameCompleted);
  const standings = calculateTeamStandings(teams, completed);
  const ranked = standings
    .filter((r) => r.gamesPlayed > 0)
    .sort(
      (a, b) =>
        a.papg - b.papg || a.team.name.localeCompare(b.team.name)
    );
  const map = new Map<string, number>();
  for (const t of teams) map.set(t.id, 1);
  const n = ranked.length;
  if (n <= 1) return map;
  ranked.forEach((row, idx) => {
    map.set(row.team.id, 1.15 - (0.3 * idx) / (n - 1));
  });
  return map;
}

/**
 * Per-game defensive box blend (legacy helper / tests).
 * (1.25×STL + 2.00×BLK + 0.15×DRB − 0.25×PF) / GP. No +/− in DV (v2).
 */
export function dpoyBoxPerGame(
  row: AwardPlayerAggregate,
  includePlusMinus: boolean = false
): number {
  return defenseValueRaw(row, includePlusMinus);
}

/**
 * @deprecated Prefer NBA-style dpoyScoreFromParts with percentiles.
 * Legacy: box × PAPG multiplier map (0.85–1.15).
 */
export function dpoyScore(
  row: AwardPlayerAggregate,
  includePlusMinus: boolean,
  teamDefMultiplierByTeamId: Map<string, number>
): number {
  const mult = teamDefMultiplierByTeamId.get(row.team.id) ?? 1;
  return dpoyBoxPerGame(row, includePlusMinus) * mult;
}

/** Club win% 0–1 for award context (same idea as All-Teams record fallback). */
export function buildAwardTeamWinPctMap(
  games: Game[],
  teams: Team[]
): Map<string, number> {
  const completed = games.filter(isGameCompleted);
  const standings = calculateTeamStandings(teams, completed);
  const map = new Map<string, number>();
  for (const row of standings) {
    map.set(
      row.team.id,
      row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0.5
    );
  }
  for (const t of teams) {
    if (!map.has(t.id)) map.set(t.id, 0.5);
  }
  return map;
}

/**
 * @deprecated Flat place bonus — replaced by TSI percentiles for majors.
 * Kept for older call sites / scripts.
 */
export function awardContextBonus(
  teamId: string,
  teamWinPct: number,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number
): number {
  const prog = progression.get(teamId);
  if (prog) return progressionPlaceBonus(prog.place, nTeams);
  return recordWinPlaceBonus(teamWinPct, nTeams);
}

/** @deprecated alias of awardContextBonus */
export function awardContextMultiplier(
  teamId: string,
  teamWinPct: number,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number
): number {
  return awardContextBonus(teamId, teamWinPct, progression, nTeams);
}

/**
 * MVP-style score for a single row given a pool (for tests).
 * NBA blend: 0.65×OV01 + 0.35×TSI within the provided pool.
 */
export function mvpStyleScore(
  row: AwardPlayerAggregate,
  teamWinPctByTeamId: Map<string, number>,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number,
  pool?: AwardPlayerAggregate[]
): number {
  const rows = pool ?? [row];
  const ov01 = minmax01ById(
    rows.map((r) => ({ id: r.playerId, value: gmscPerGameRaw(r) }))
  ).get(row.playerId) ?? 0;
  const tsi = tsiFromWinAndProgression({
    teamId: row.team.id,
    winPct: teamWinPctByTeamId.get(row.team.id) ?? 0.5,
    progression,
    nTeams,
  });
  return applyMissPenalty(
    mvpScoreFromParts(ov01, tsi),
    row.gamesPlayed,
    row.teamGames
  );
}

/** Playmaker: APG × AST/(AST+TO). */
export function playmakerScore(row: AwardPlayerAggregate): number {
  const gp = row.gamesPlayed;
  if (gp <= 0) return 0;
  const ast = row.totalStats.assists;
  const tov = row.totalStats.turnovers;
  const apg = ast / gp;
  const denom = ast + tov;
  if (denom <= 0) return 0;
  return apg * (ast / denom);
}

/** Glass Cleaner: (1.0×DRB + 1.1×ORB) / GP — ORB slightly harder. */
export function rebounderScore(row: AwardPlayerAggregate): number {
  const gp = row.gamesPlayed;
  if (gp <= 0) return 0;
  return (row.totalStats.drb + 1.1 * row.totalStats.orb) / gp;
}

/** +/− sample: ≥2 tracked games and coverage in ≥50% of player's GP. */
export function meetsPlusMinusSampleFloor(row: AwardPlayerAggregate): boolean {
  return (
    row.plusMinusGames >= 2 &&
    row.plusMinusGames * 2 >= row.gamesPlayed
  );
}

/**
 * Ordered award sections for the admin Awards tab.
 * Omits Impact (+/−) when the tournament has no +/- coverage.
 * Omits Clutch Player when the tournament has no play-by-play.
 */
export function buildTournamentAwardSections(
  players: AwardPlayerAggregate[],
  options: {
    includePlusMinus: boolean;
    includeClutch?: boolean;
    clutchByPlayerId?: Map<string, ClutchPlayerAggregate>;
    teamDefMultiplierByTeamId?: Map<string, number>;
    teamDef01ByTeamId?: Map<string, number>;
    teamWinPctByTeamId?: Map<string, number>;
    tsiByTeamId?: Map<string, number>;
    progressionByTeamId?: Map<string, TeamProgressionPlace>;
    nTeamsForProgression?: number;
    finalsMvpContenders?: AwardContender[];
  }
): TournamentAwardSection[] {
  const base = eligibleBase(players);
  const majors = eligibleMajors(players);
  const sections: TournamentAwardSection[] = [];
  const winPctMap = options.teamWinPctByTeamId ?? new Map<string, number>();
  const progression = options.progressionByTeamId ?? new Map();
  const nTeams = Math.max(
    2,
    options.nTeamsForProgression ??
      new Set(base.map((r) => r.team.id)).size
  );

  if (options.finalsMvpContenders && options.finalsMvpContenders.length > 0) {
    sections.push({
      id: 'finals_mvp',
      title: 'Finals MVP',
      tooltip:
        'Championship Final only: 85% Game Score + 15% +/− in that game ' +
        '(100% GmSc when +/− is not tracked). #1 is the best player on the winning team ' +
        'unless the best loser beats them by 5+ on this score. Top 3 shown.',
      contenders: options.finalsMvpContenders.slice(0, 5),
    });
  }

  const tsiFor = (teamId: string) => {
    if (options.tsiByTeamId?.has(teamId)) {
      return options.tsiByTeamId.get(teamId)!;
    }
    return tsiFromWinAndProgression({
      teamId,
      winPct: winPctMap.get(teamId) ?? 0.5,
      progression,
      nTeams,
    });
  };

  const mvpOv01 = minmax01ById(
    majors.map((r) => ({ id: r.playerId, value: gmscPerGameRaw(r) }))
  );
  const mvpScore = (r: AwardPlayerAggregate) =>
    applyMissPenalty(
      mvpScoreFromParts(mvpOv01.get(r.playerId) ?? 0, tsiFor(r.team.id)),
      r.gamesPlayed,
      r.teamGames
    );

  sections.push({
    id: 'mvp',
    title: 'MVP',
    tooltip:
      'NBA-style: 65% Game Score/g (scaled 0–100% vs eligible min/max) + 35% team success index ' +
      '(when place known: 80% Finish^1.5 + 10% win% + 10% net; else win% / net). ' +
      'Then miss wither: −2% / −4% / −3% (recurring) of Score per team game missed (multiplicative). ' +
      'Eligible: ≥55% of team games. Ties: EFF/g, then PPG.',
    contenders: topBy(majors, mvpScore, (a, b) => {
      const eff =
        MetricsCalculator.calculateEfficiency(b.totalStats) / b.gamesPlayed -
        MetricsCalculator.calculateEfficiency(a.totalStats) / a.gamesPlayed;
      if (eff !== 0) return eff;
      return b.totalStats.points / b.gamesPlayed - a.totalStats.points / a.gamesPlayed;
    }),
  });

  const dv01 = minmax01ById(
    majors.map((r) => ({
      id: r.playerId,
      value: defenseValueRaw(r, false),
    }))
  );
  const teamDef01 = options.teamDef01ByTeamId ?? new Map<string, number>();
  // Legacy PAPG mult map → approximate TeamDef01 if new map omitted
  if (teamDef01.size === 0 && options.teamDefMultiplierByTeamId) {
    for (const [id, mult] of options.teamDefMultiplierByTeamId) {
      teamDef01.set(id, Math.min(1, Math.max(0, (mult - 0.85) / 0.3)));
    }
  }
  const dpoyScoreFn = (r: AwardPlayerAggregate) =>
    applyMissPenalty(
      dpoyScoreFromParts(
        dv01.get(r.playerId) ?? 0,
        teamDef01.get(r.team.id) ?? 0.5,
        tsiFor(r.team.id)
      ),
      r.gamesPlayed,
      r.teamGames
    );

  sections.push({
    id: 'dpoy',
    title: 'Defensive Player',
    tooltip:
      `62% defense box (scaled 0–100% vs eligible min/max; ` +
      `(1.25×STL + 2.00×BLK + 0.15×DRB − 0.25×PF) / GP) ` +
      `+ 28% team prevention (60% opponent eFG% rank + 40% DRtg rank) ` +
      `+ 10% team success index. ` +
      `Then miss wither: −2% / −4% / −3% (recurring) of Score per team game missed (multiplicative). ` +
      `Eligible: ≥55% of team games. Ties: more STL+BLK/g, then fewer PF/g.`,
    contenders: topBy(majors, dpoyScoreFn, (a, b) => {
      const stocks =
        (b.totalStats.steals + b.totalStats.blocks) / b.gamesPlayed -
        (a.totalStats.steals + a.totalStats.blocks) / a.gamesPlayed;
      if (stocks !== 0) return stocks;
      return (
        a.totalStats.fouls / a.gamesPlayed - b.totalStats.fouls / b.gamesPlayed
      );
    }),
  });

  const sixth = majors.filter(isSixthManEligible);
  const sixthOv01 = minmax01ById(
    sixth.map((r) => ({ id: r.playerId, value: gmscPerGameRaw(r) }))
  );
  const sixthScore = (r: AwardPlayerAggregate) =>
    applyMissPenalty(
      sixthScoreFromParts(sixthOv01.get(r.playerId) ?? 0, tsiFor(r.team.id)),
      r.gamesPlayed,
      r.teamGames
    );

  sections.push({
    id: 'sixth_man',
    title: 'Sixth Man',
    tooltip:
      'NBA-style: 88% Game Score/g (scaled 0–100% vs bench-eligible min/max) + 12% team success index. ' +
      'Then miss wither: −2% / −4% / −3% (recurring) of Score per team game missed (multiplicative). ' +
      'Must come off the bench more than start (games with empty starter lists skipped for that ratio). ' +
      'Eligible: ≥55% of team games.',
    contenders: topBy(sixth, sixthScore),
  });

  if (options.includeClutch) {
    const clutchMap =
      options.clutchByPlayerId ?? new Map<string, ClutchPlayerAggregate>();
    const clutchPool = players.filter((r) => {
      const c = clutchMap.get(r.playerId);
      return c != null && c.clutchGames > 0;
    });
    sections.push({
      id: 'clutch',
      title: 'Clutch Player',
      tooltip:
        'Highest Game Score per clutch game from play-by-play. Clutch = last half of Q4 action events (shots/FT/rebounds/turnovers/fouls, by count) ' +
        'plus all OT action events, each with score margin ≤5 before the play. ' +
        'Requires PBP; omitted when the tournament has none. No GP or clutch-sample floor.',
      contenders: topBy(
        clutchPool,
        (r) => clutchGmscPerGame(clutchMap.get(r.playerId)!),
        (a, b) => {
          const ca = clutchMap.get(a.playerId)!;
          const cb = clutchMap.get(b.playerId)!;
          const pts = cb.totalStats.points - ca.totalStats.points;
          if (pts !== 0) return pts;
          return cb.totalStats.fg_made - ca.totalStats.fg_made;
        }
      ),
    });
  }

  sections.push({
    id: 'scoring',
    title: 'Scoring Title',
    tooltip: 'Highest points per game. Eligible: ≥50% of team games.',
    contenders: topBy(base, (r) => r.totalStats.points / r.gamesPlayed),
  });

  sections.push({
    id: 'playmaker',
    title: 'Playmaker',
    tooltip:
      'APG × AST/(AST+TO) — rewards assist volume with turnover discipline. Eligible: ≥50% of team games. Ties: higher raw APG.',
    contenders: topBy(base, playmakerScore, (a, b) => {
      return (
        b.totalStats.assists / b.gamesPlayed -
        a.totalStats.assists / a.gamesPlayed
      );
    }),
  });

  sections.push({
    id: 'rebounder',
    title: 'Glass Cleaner',
    tooltip:
      '(1.0×DRB + 1.1×ORB) per game — offensive boards weighted slightly higher. Eligible: ≥50% of team games. Ties: higher total RPG.',
    contenders: topBy(base, rebounderScore, (a, b) => {
      const rpg =
        (b.totalStats.orb + b.totalStats.drb) / b.gamesPlayed -
        (a.totalStats.orb + a.totalStats.drb) / a.gamesPlayed;
      return rpg;
    }),
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
    const withPm = base.filter(meetsPlusMinusSampleFloor);
    sections.push({
      id: 'plus_minus',
      title: 'Impact',
      tooltip:
        'Highest average plus/minus. Eligible: ≥50% of team games, +/− in ≥2 games and in at least half of the player’s games.',
      contenders: topBy(withPm, (r) => r.plusMinusTotal / r.plusMinusGames),
    });
  }

  return sections;
}

function buildTsiMapForTournamentGames(input: {
  games: Game[];
  teams: Team[];
  structure?: TournamentStructure | null;
}): Map<string, number> {
  const progressionByTeamId = buildTeamProgressionPlaces({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
  });
  const nTeamsForProgression = countTournamentTeamsForProgression(
    input.teams,
    input.games,
    progressionByTeamId
  );
  const teamWinPctByTeamId = buildAwardTeamWinPctMap(input.games, input.teams);
  return buildTeamSuccessIndexMap({
    games: input.games,
    teams: input.teams,
    progression: progressionByTeamId,
    nTeams: nTeamsForProgression,
    winPctByTeamId: teamWinPctByTeamId,
  });
}

/**
 * ROTY + MIP sections (after Sixth Man). Empty when standalone / off / no pool.
 */
export function buildRookieAndMostImprovedSections(input: {
  current: Pick<
    Tournament,
    'id' | 'year' | 'createdAt' | 'awardSeriesId' | 'rookieMode'
  >;
  allTournaments: Tournament[];
  /** League-wide games (filtered per series tournament). */
  allGames: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  currentPlayers: AwardPlayerAggregate[];
  currentTsiByTeamId: Map<string, number>;
}): TournamentAwardSection[] {
  const sections: TournamentAwardSection[] = [];
  const earlier = earlierSeriesTournaments(
    input.current,
    input.allTournaments
  );
  const showRookie = shouldShowRookieAward({
    awardSeriesId: input.current.awardSeriesId,
    rookieMode: input.current.rookieMode,
  });
  const showMip = shouldShowMostImprovedAward({
    awardSeriesId: input.current.awardSeriesId,
    earlierSeriesTournamentCount: earlier.length,
  });
  if (!showRookie && !showMip) return sections;

  const majors = eligibleMajors(input.currentPlayers);
  const taggedRookies = new Set(
    input.tournamentRosters
      .filter(
        (r) =>
          r.tournamentId === input.current.id && r.isRookie === true
      )
      .map((r) => r.playerId)
  );

  const priorAggByTournament = new Map<string, AwardPlayerAggregate[]>();
  const priorTsiByTournament = new Map<string, Map<string, number>>();
  for (const prior of earlier) {
    const priorGames = filterGamesForTournament(prior, input.allGames);
    priorAggByTournament.set(
      prior.id,
      aggregateTournamentAwardPlayers({
        tournamentId: prior.id,
        games: priorGames,
        teams: input.teams,
        tournamentRosters: input.tournamentRosters,
      })
    );
    priorTsiByTournament.set(
      prior.id,
      buildTsiMapForTournamentGames({
        games: priorGames,
        teams: input.teams,
        structure: prior.structure,
      })
    );
  }

  const playerSeasonGpCache = new Map<
    string,
    Map<string, { gamesPlayed: number; teamGames: number }>
  >();
  const gpMapFor = (playerId: string) => {
    let map = playerSeasonGpCache.get(playerId);
    if (map) return map;
    map = new Map();
    const cur = input.currentPlayers.find((p) => p.playerId === playerId);
    if (cur) {
      map.set(input.current.id, {
        gamesPlayed: cur.gamesPlayed,
        teamGames: cur.teamGames,
      });
    }
    for (const [tid, rows] of priorAggByTournament) {
      const row = rows.find((p) => p.playerId === playerId);
      if (row) {
        map.set(tid, {
          gamesPlayed: row.gamesPlayed,
          teamGames: row.teamGames,
        });
      }
    }
    playerSeasonGpCache.set(playerId, map);
    return map;
  };

  const rookieEligibleIds = new Set<string>();
  if (showRookie) {
    const rookieRows: RookieScoreRow[] = [];
    const rookieAggs: AwardPlayerAggregate[] = [];
    for (const r of majors) {
      const gpMap = gpMapFor(r.playerId);
      const eligible = isRookieOfYearEligible({
        rookieMode: input.current.rookieMode,
        hasPriorSeriesGames: playerHasPriorSeriesGames({
          current: input.current,
          allTournaments: input.allTournaments,
          playerSeasonGp: gpMap,
        }),
        isTaggedRookie: taggedRookies.has(r.playerId),
      });
      if (!eligible) continue;
      rookieEligibleIds.add(r.playerId);
      rookieAggs.push(r);
      rookieRows.push({
        playerId: r.playerId,
        gmscPerGame: gmscPerGameRaw(r),
        tsi: input.currentTsiByTeamId.get(r.team.id) ?? 0.5,
        gamesPlayed: r.gamesPlayed,
        teamGames: r.teamGames,
      });
    }
    if (rookieAggs.length > 0) {
      const scores = scoreRookiePool(rookieRows);
      sections.push({
        id: 'rookie',
        title: 'Rookie of the Year',
        tooltip:
          '88% Game Score/g (scaled within rookies) + 12% team success index, then miss wither. ' +
          'Eligible: ≥55% team games. Manual series: tagged rookies only. ' +
          'Auto series: first appearance in this award series in RunItBack. ' +
          'Omitted when standalone or Rookie awards = Off.',
        contenders: topBy(rookieAggs, (row) => scores.get(row.playerId) ?? 0),
      });
    }
  }

  if (showMip) {
    const mipRows: MipScoreRow[] = [];
    const mipAggs: AwardPlayerAggregate[] = [];
    const mipPriorByPlayer = new Map<string, MipPriorSeasonSnapshot>();
    for (const r of majors) {
      const gpMap = gpMapFor(r.playerId);
      const isRookie = rookieEligibleIds.has(r.playerId);
      const prior = pickPriorSeasonForMip({
        current: input.current,
        allTournaments: input.allTournaments,
        playerSeasonGp: gpMap,
      });
      if (!prior) continue;
      const priorRow = priorAggByTournament
        .get(prior.id)
        ?.find((p) => p.playerId === r.playerId);
      if (!priorRow) continue;
      const priorGp = gpMap.get(prior.id);
      const eligible = isMostImprovedEligible({
        meetsCurrentGpFloor: meetsTournamentMajorAwardGamesFloor(
          r.gamesPlayed,
          r.teamGames
        ),
        meetsPriorGpFloor: !!(
          priorGp &&
          meetsMipPriorGamesFloor(priorGp.gamesPlayed, priorGp.teamGames)
        ),
        isRookieEligibleThisSeason: isRookie,
      });
      if (!eligible) continue;

      const priorTsi =
        priorTsiByTournament.get(prior.id)?.get(priorRow.team.id) ?? 0.5;
      const curTsi = input.currentTsiByTeamId.get(r.team.id) ?? 0.5;
      mipAggs.push(r);
      mipPriorByPlayer.set(
        r.playerId,
        toMipPriorSeasonSnapshot(prior, priorRow)
      );
      mipRows.push({
        playerId: r.playerId,
        deltaGmsc: gmscPerGameRaw(r) - gmscPerGameRaw(priorRow),
        deltaTsi: curTsi - priorTsi,
        gamesPlayed: r.gamesPlayed,
        teamGames: r.teamGames,
      });
    }
    if (mipAggs.length > 0) {
      const scores = scoreMipPool(mipRows);
      const contenders = topBy(
        mipAggs,
        (row) => scores.get(row.playerId) ?? 0
      ).map((c) => {
        const prior = mipPriorByPlayer.get(c.playerId);
        return prior ? { ...c, mipPriorSeason: prior } : c;
      });
      sections.push({
        id: 'most_improved',
        title: 'Most Improved',
        tooltip:
          '88% Δ Game Score/g + 12% Δ team success index (each scaled within MIP pool), ' +
          'then miss wither on this season. This season ≥55% GP; compare-to season is the ' +
          'newest earlier series season with ≥40% GP (walk back if needed). ' +
          'Excludes Rookie of the Year pool. ' +
          'Omitted when standalone or no earlier series season in the app.',
        contenders,
      });
    }
  }

  return sections;
}

function spliceAfterSixthMan(
  sections: TournamentAwardSection[],
  extra: TournamentAwardSection[]
): TournamentAwardSection[] {
  if (extra.length === 0) return sections;
  const idx = sections.findIndex((s) => s.id === 'sixth_man');
  if (idx < 0) return [...sections, ...extra];
  return [
    ...sections.slice(0, idx + 1),
    ...extra,
    ...sections.slice(idx + 1),
  ];
}

export function buildTournamentAwardsForGames(input: {
  tournamentId: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  structure?: TournamentStructure | null;
  /** Current tournament metadata for ROTY/MIP series. */
  tournament?: Pick<
    Tournament,
    'id' | 'year' | 'createdAt' | 'awardSeriesId' | 'rookieMode' | 'structure'
  >;
  /** All league tournaments (series siblings). */
  allTournaments?: Tournament[];
  /** All league games (for prior-season MIP boxes). */
  allGames?: Game[];
}): TournamentAwardSection[] {
  const players = aggregateTournamentAwardPlayers(input);
  const progressionByTeamId = buildTeamProgressionPlaces({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
  });
  const nTeamsForProgression = countTournamentTeamsForProgression(
    input.teams,
    input.games,
    progressionByTeamId
  );
  const teamWinPctByTeamId = buildAwardTeamWinPctMap(input.games, input.teams);
  const tsiByTeamId = buildTeamSuccessIndexMap({
    games: input.games,
    teams: input.teams,
    progression: progressionByTeamId,
    nTeams: nTeamsForProgression,
    winPctByTeamId: teamWinPctByTeamId,
  });
  const includeClutch = tournamentHasClutchPbpCoverage(input.games);
  const finalsMvpContenders = buildFinalsMvpContenders({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
  });
  const sections = buildTournamentAwardSections(players, {
    includePlusMinus: tournamentHasPlusMinusCoverage(input.games),
    includeClutch,
    clutchByPlayerId: includeClutch
      ? aggregateClutchStatsByPlayer(input.games)
      : undefined,
    teamDef01ByTeamId: buildTeamDef01Map(input.games, input.teams),
    teamDefMultiplierByTeamId: buildTeamDefMultiplierMap(
      input.games,
      input.teams
    ),
    teamWinPctByTeamId,
    tsiByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
    finalsMvpContenders,
  });

  const currentMeta = input.tournament ?? {
    id: input.tournamentId,
    year: 0,
    awardSeriesId: undefined,
    rookieMode: undefined,
  };
  const rookieMip = buildRookieAndMostImprovedSections({
    current: currentMeta,
    allTournaments: input.allTournaments ?? [],
    allGames: input.allGames ?? input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
    currentPlayers: players,
    currentTsiByTeamId: tsiByTeamId,
  });
  return spliceAfterSixthMan(sections, rookieMip);
}
