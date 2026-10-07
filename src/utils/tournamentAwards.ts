/**
 * Admin Awards tab: top-5 contenders per stats-only award for one tournament.
 * Completed games only. Majors (MVP/DPOY/Sixth Man) ≥60% team GP;
 * other awards ≥50% (same as Home leaders).
 */
import type { Game, GameStats, Player, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { isGameCompleted } from './scheduledGames';
import { gameRecordsStat } from './statRecordingCoverage';
import {
  meetsTournamentLeaderGamesFloor,
  meetsTournamentLeaderThreeFloor,
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
  progressionPlaceMultiplier,
  recordWinMultiplier,
  type TeamProgressionPlace,
} from './tournamentProgression';
import {
  aggregateClutchStatsByPlayer,
  clutchGmscPerGame,
  tournamentHasClutchPbpCoverage,
  type ClutchPlayerAggregate,
} from './tournamentClutch';

export type TournamentAwardId =
  | 'mvp'
  | 'dpoy'
  | 'sixth_man'
  | 'clutch'
  | 'scoring'
  | 'playmaker'
  | 'rebounder'
  | 'iron_man'
  | 'plus_minus'
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

/** Non-major awards + shared pools: ≥50% team GP. */
function eligibleBase(rows: AwardPlayerAggregate[]): AwardPlayerAggregate[] {
  return rows.filter((r) =>
    meetsTournamentLeaderGamesFloor(r.gamesPlayed, r.teamGames)
  );
}

/** MVP / DPOY / Sixth Man: ≥60% team GP. */
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

/** Light +/− weight when tracked (was 0.10 — too blowout-driven). */
export const DPOY_PLUS_MINUS_WEIGHT = 0.07;

/**
 * Per-game defensive box blend before team multiplier.
 * (1.5×STL + 1.5×BLK + 0.5×DRB − 0.25×PF) / GP [+ 0.07×+/− when tracked].
 */
export function dpoyBoxPerGame(
  row: AwardPlayerAggregate,
  includePlusMinus: boolean
): number {
  const gp = row.gamesPlayed;
  if (gp <= 0) return 0;
  const s = row.totalStats;
  let raw =
    (1.5 * s.steals + 1.5 * s.blocks + 0.5 * s.drb - 0.25 * s.fouls) / gp;
  if (includePlusMinus && row.plusMinusGames > 0) {
    raw += DPOY_PLUS_MINUS_WEIGHT * (row.plusMinusTotal / row.plusMinusGames);
  }
  return raw;
}

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
 * ±15% context: progression place when known, else team win%.
 * Shared spirit with All-Teams (not imported — avoids circular deps).
 */
export function awardContextMultiplier(
  teamId: string,
  teamWinPct: number,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number
): number {
  const prog = progression.get(teamId);
  if (prog) return progressionPlaceMultiplier(prog.place, nTeams);
  return recordWinMultiplier(teamWinPct);
}

/** MVP / Sixth Man: GmSc/g × context (±15%). */
export function mvpStyleScore(
  row: AwardPlayerAggregate,
  teamWinPctByTeamId: Map<string, number>,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number
): number {
  const winPct = teamWinPctByTeamId.get(row.team.id) ?? 0.5;
  const mult = awardContextMultiplier(
    row.team.id,
    winPct,
    progression,
    nTeams
  );
  return gmscPerGame(row.totalStats, row.gamesPlayed) * mult;
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
    teamWinPctByTeamId?: Map<string, number>;
    progressionByTeamId?: Map<string, TeamProgressionPlace>;
    nTeamsForProgression?: number;
  }
): TournamentAwardSection[] {
  const base = eligibleBase(players);
  const majors = eligibleMajors(players);
  const sections: TournamentAwardSection[] = [];
  const teamDef =
    options.teamDefMultiplierByTeamId ?? new Map<string, number>();
  const winPctMap = options.teamWinPctByTeamId ?? new Map<string, number>();
  const progression = options.progressionByTeamId ?? new Map();
  const nTeams = Math.max(
    2,
    options.nTeamsForProgression ??
      new Set(base.map((r) => r.team.id)).size
  );

  const mvpScore = (r: AwardPlayerAggregate) =>
    mvpStyleScore(r, winPctMap, progression, nTeams);

  sections.push({
    id: 'mvp',
    title: 'MVP',
    tooltip:
      'GmSc per game × context (±15%: tournament progression place when known, otherwise team win%). ' +
      'Eligible: ≥60% of team games. Ties: EFF/g, then PPG.',
    contenders: topBy(majors, mvpScore, (a, b) => {
      const eff =
        MetricsCalculator.calculateEfficiency(b.totalStats) / b.gamesPlayed -
        MetricsCalculator.calculateEfficiency(a.totalStats) / a.gamesPlayed;
      if (eff !== 0) return eff;
      return b.totalStats.points / b.gamesPlayed - a.totalStats.points / a.gamesPlayed;
    }),
  });

  const dpoyPmNote = options.includePlusMinus
    ? ' When +/− is tracked, add 0.07 × +/− per game.'
    : '';
  sections.push({
    id: 'dpoy',
    title: 'Defensive Player',
    tooltip:
      `Stats-only: ((1.5×STL + 1.5×BLK + 0.5×DRB − 0.25×PF) / GP)${dpoyPmNote} ` +
      `× team defense multiplier (±15% from points allowed/g rank; best defense 1.15). ` +
      `Eligible: ≥60% of team games. Ties: more STL+BLK/g, then fewer PF/g.`,
    contenders: topBy(
      majors,
      (r) => dpoyScore(r, options.includePlusMinus, teamDef),
      (a, b) => {
        const stocks =
          (b.totalStats.steals + b.totalStats.blocks) / b.gamesPlayed -
          (a.totalStats.steals + a.totalStats.blocks) / a.gamesPlayed;
        if (stocks !== 0) return stocks;
        return (
          a.totalStats.fouls / a.gamesPlayed - b.totalStats.fouls / b.gamesPlayed
        );
      }
    ),
  });

  const sixth = majors.filter(isSixthManEligible);
  sections.push({
    id: 'sixth_man',
    title: 'Sixth Man',
    tooltip:
      'Same Score as MVP (GmSc/g × context ±15%) among players who came off the bench more than they started ' +
      '(games with empty starter lists skipped for that ratio). Eligible: ≥60% of team games.',
    contenders: topBy(sixth, mvpScore),
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

  const threePool = base.filter((r) =>
    meetsTournamentLeaderThreeFloor(r.totalStats.three_attempted, r.gamesPlayed)
  );
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
  structure?: TournamentStructure | null;
}): TournamentAwardSection[] {
  const players = aggregateTournamentAwardPlayers(input);
  const progressionByTeamId = buildTeamProgressionPlaces({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
  });
  const includeClutch = tournamentHasClutchPbpCoverage(input.games);
  return buildTournamentAwardSections(players, {
    includePlusMinus: tournamentHasPlusMinusCoverage(input.games),
    includeClutch,
    clutchByPlayerId: includeClutch
      ? aggregateClutchStatsByPlayer(input.games)
      : undefined,
    teamDefMultiplierByTeamId: buildTeamDefMultiplierMap(
      input.games,
      input.teams
    ),
    teamWinPctByTeamId: buildAwardTeamWinPctMap(input.games, input.teams),
    progressionByTeamId,
    nTeamsForProgression: countTournamentTeamsForProgression(
      input.teams,
      input.games,
      progressionByTeamId
    ),
  });
}
