/**
 * NBA-style award scoring: percentiles + Team Success Index (TSI).
 * Locked Designer formula 2026-10-12.
 */
import type { Game, GameStats, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { resolvePlayerTeamInGame } from './rosterPlayers';
import { isGameCompleted } from './scheduledGames';
import { calculateTeamStandings } from './tournamentStandings';
import type { TeamProgressionPlace } from './tournamentProgression';
import { buildClubRosterByTeam } from './tournamentRosters';

/**
 * @deprecated DV no longer includes +/− (Designer DPOY v2, 2026-11-24).
 * Kept so old imports/tests do not break.
 */
export const DPOY_PLUS_MINUS_WEIGHT = 0.07;

/** MVP: 65% OV (GmSc) + 35% TSI. */
export const MVP_TSI_WEIGHT = 0.35;
export const SIXTH_TSI_WEIGHT = 0.12;
/** DPOY blend (Designer 2026-11-24): personal DV / team prevention / TSI. */
export const DPOY_DV_WEIGHT = 0.6;
export const DPOY_TEAM_DEF_WEIGHT = 0.35;
export const DPOY_TSI_WEIGHT = 0.05;

/** All-Defensive: more personal than DPOY. */
export const ALL_DEF_DV_WEIGHT = 0.7;
export const ALL_DEF_TEAM_DEF_WEIGHT = 0.25;
export const ALL_DEF_TSI_WEIGHT = 0.05;

/** Minimal row shape for rate helpers (avoids circular imports). */
export type AwardRateRow = {
  gamesPlayed: number;
  totalStats: GameStats;
  plusMinusGames: number;
  plusMinusTotal: number;
};
/** Same blend shape as MVP (35% TSI on 1st); steps down for lower teams. */
export const ALL_TEAM_TSI_ALPHA = {
  first: 0.35,
  second: 0.2,
  third: 0.1,
  hm: 0.1,
} as const;

/** Finish ladder exponent inside TSI: linear=1, squared=2. Current: 1.5. */
export const TSI_FINISH_EXPONENT = 1.5;

/**
 * TSI when finish place is known (Designer 2026-10-29): emphasize placement
 * over win% / net so soft schedules do not erase a better tournament finish.
 */
export const TSI_FINISH_WEIGHT = 0.8;
export const TSI_WIN_PCT_WEIGHT = 0.1;
export const TSI_NET_WEIGHT = 0.1;
/** When no progression place: win% / net only. */
export const TSI_NO_PLACE_WIN_PCT_WEIGHT = 0.55;
export const TSI_NO_PLACE_NET_WEIGHT = 0.45;

/**
 * TeamDef01 (DPOY + All-Defensive). Designer v2 2026-11-24: prevention only.
 * No team stocks/DRB (those live in personal DV — avoid double-count).
 * Weights: 0.60·OppEfg + 0.40·DRtg.
 */
export const TEAM_DEF_OPP_EFG_WEIGHT = 0.6;
export const TEAM_DEF_DRTG_WEIGHT = 0.4;
/** @deprecated Removed from TeamDef blend (v2). */
export const TEAM_DEF_STOCKS_WEIGHT = 0;
/** @deprecated Removed from TeamDef blend (v2). */
export const TEAM_DEF_DRB_WEIGHT = 0;

/** Personal DV coefficients (Designer v2.1 — BLK premium, softer PF). */
export const DPOY_DV_STL_COEFF = 1.25;
export const DPOY_DV_BLK_COEFF = 2.0;
export const DPOY_DV_DRB_COEFF = 0.15;
export const DPOY_DV_PF_COEFF = 0.25;

/** Soft-prefer band on the 0–100 score scale (±2 points). */
export const FIRST_TEAM_SOFT_PREFER_EPS = 2;
export const FIRST_TEAM_SOFT_PLACE_MAX = 3;

/** Average-rank percentile ∈ [0,1]; single value → 1. */
export function percentileById(
  entries: ReadonlyArray<{ id: string; value: number }>
): Map<string, number> {
  const out = new Map<string, number>();
  const n = entries.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(entries[0].id, 1);
    return out;
  }
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1].value === sorted[i].value) j += 1;
    const avgRank = (i + j) / 2;
    const pct = avgRank / (n - 1);
    for (let k = i; k <= j; k += 1) out.set(sorted[k].id, pct);
    i = j + 1;
  }
  return out;
}

/**
 * Gap-preserving 0–1 scale: worst → 0, best → 1, others linear in raw value.
 * Used for All-Teams / MVP / Sixth impact and DPOY / All-Defensive DV
 * (not rank percentile). All equal (or n=1): everyone 1 when n=1, else 0.5.
 */
export function minmax01ById(
  entries: ReadonlyArray<{ id: string; value: number }>
): Map<string, number> {
  const out = new Map<string, number>();
  const n = entries.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(entries[0].id, 1);
    return out;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const e of entries) {
    if (e.value < min) min = e.value;
    if (e.value > max) max = e.value;
  }
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) {
    for (const e of entries) out.set(e.id, 0.5);
    return out;
  }
  for (const e of entries) {
    out.set(e.id, (e.value - min) / span);
  }
  return out;
}

export function gmscPerGameRaw(row: AwardRateRow): number {
  if (row.gamesPlayed <= 0) return 0;
  return MetricsCalculator.calculateGameScore(row.totalStats) / row.gamesPlayed;
}

/**
 * Personal defensive box value per game.
 * `(1.25×STL + 2.00×BLK + 0.15×DRB − 0.25×PF) / GP`.
 * `includePlusMinus` is ignored (v2 — no +/− in DV).
 */
export function defenseValueRaw(
  row: AwardRateRow,
  _includePlusMinus?: boolean
): number {
  const gp = row.gamesPlayed;
  if (gp <= 0) return 0;
  const s = row.totalStats;
  return (
    (DPOY_DV_STL_COEFF * s.steals +
      DPOY_DV_BLK_COEFF * s.blocks +
      DPOY_DV_DRB_COEFF * s.drb -
      DPOY_DV_PF_COEFF * s.fouls) /
    gp
  );
}

/**
 * All-Teams impact = GmSc/g only (same raw as MVP OV).
 * `includePlusMinus` kept for call-site compatibility; ignored.
 */
export const ALL_TEAM_GMSC_WEIGHT = 1;
/** @deprecated All-Teams no longer blends +/− into impact. */
export const ALL_TEAM_PLUS_MINUS_WEIGHT = 0;

export function allTeamImpactRaw(
  row: AwardRateRow,
  _includePlusMinus?: boolean
): number {
  return gmscPerGameRaw(row);
}

/** Finish ladder: 1st → 1, last → 0, then raised to TSI_FINISH_EXPONENT. */
function finish01(place: number, nTeams: number): number {
  const n = Math.max(2, Math.floor(nTeams));
  const p = Math.min(n, Math.max(1, Math.floor(place)));
  const linear = (n - p) / (n - 1);
  return Math.pow(linear, TSI_FINISH_EXPONENT);
}

/**
 * Build TSI ∈ [0,1] per team.
 * With progression place: 0.80 Finish^1.5 + 0.10 Win% + 0.10 Net01.
 * Else: 0.55 Win% + 0.45 Net01.
 */
export function buildTeamSuccessIndexMap(input: {
  games: Game[];
  teams: Team[];
  progression: Map<string, TeamProgressionPlace>;
  nTeams: number;
  /** Optional override win% (tests). */
  winPctByTeamId?: Map<string, number>;
}): Map<string, number> {
  const completed = input.games.filter(isGameCompleted);
  const standings = calculateTeamStandings(input.teams, completed);
  const winPct = new Map<string, number>();
  const netRaw = new Map<string, number>();

  for (const row of standings) {
    winPct.set(
      row.team.id,
      row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0.5
    );
    netRaw.set(
      row.team.id,
      row.gamesPlayed > 0 ? row.pointsDiff / row.gamesPlayed : 0
    );
  }
  if (input.winPctByTeamId) {
    for (const [id, w] of input.winPctByTeamId) winPct.set(id, w);
  }
  for (const t of input.teams) {
    if (!winPct.has(t.id)) winPct.set(t.id, 0.5);
    if (!netRaw.has(t.id)) netRaw.set(t.id, 0);
  }

  const netEntries = [...netRaw.entries()]
    .filter(([id]) => (standings.find((s) => s.team.id === id)?.gamesPlayed ?? 0) > 0)
    .map(([id, value]) => ({ id, value }));
  const netPct =
    netEntries.length > 0
      ? percentileById(netEntries)
      : new Map<string, number>();

  const hasProg = input.progression.size > 0;
  const n = Math.max(2, Math.floor(input.nTeams));
  const out = new Map<string, number>();

  for (const t of input.teams) {
    const w = winPct.get(t.id) ?? 0.5;
    const net01 = netPct.get(t.id) ?? 0.5;
    const prog = input.progression.get(t.id);
    let tsi: number;
    if (hasProg && prog) {
      tsi =
        TSI_FINISH_WEIGHT * finish01(prog.place, n) +
        TSI_WIN_PCT_WEIGHT * w +
        TSI_NET_WEIGHT * net01;
    } else if (hasProg) {
      // Team not in progression map — W% + net only
      tsi =
        TSI_NO_PLACE_WIN_PCT_WEIGHT * w + TSI_NO_PLACE_NET_WEIGHT * net01;
    } else {
      tsi =
        TSI_NO_PLACE_WIN_PCT_WEIGHT * w + TSI_NO_PLACE_NET_WEIGHT * net01;
    }
    out.set(t.id, Math.min(1, Math.max(0, tsi)));
  }

  // Also cover ids only in win map / progression
  for (const id of new Set([
    ...winPct.keys(),
    ...input.progression.keys(),
  ])) {
    if (out.has(id)) continue;
    const w = winPct.get(id) ?? 0.5;
    const net01 = netPct.get(id) ?? 0.5;
    const prog = input.progression.get(id);
    const tsi =
      hasProg && prog
        ? TSI_FINISH_WEIGHT * finish01(prog.place, n) +
          TSI_WIN_PCT_WEIGHT * w +
          TSI_NET_WEIGHT * net01
        : TSI_NO_PLACE_WIN_PCT_WEIGHT * w + TSI_NO_PLACE_NET_WEIGHT * net01;
    out.set(id, Math.min(1, Math.max(0, tsi)));
  }

  return out;
}

/**
 * Lightweight TSI when games are unavailable (unit tests):
 * progression → Finish^1.5 blend with win%; else win% only (net=0.5).
 */
export function tsiFromWinAndProgression(input: {
  teamId: string;
  winPct: number;
  progression: Map<string, TeamProgressionPlace>;
  nTeams: number;
}): number {
  const prog = input.progression.get(input.teamId);
  const w = Math.min(1, Math.max(0, input.winPct));
  const n = Math.max(2, Math.floor(input.nTeams));
  if (input.progression.size > 0 && prog) {
    return Math.min(
      1,
      Math.max(
        0,
        TSI_FINISH_WEIGHT * finish01(prog.place, n) +
          TSI_WIN_PCT_WEIGHT * w +
          TSI_NET_WEIGHT * 0.5
      )
    );
  }
  return Math.min(
    1,
    Math.max(
      0,
      TSI_NO_PLACE_WIN_PCT_WEIGHT * w + TSI_NO_PLACE_NET_WEIGHT * 0.5
    )
  );
}

type TeamDefBoxAgg = {
  boxGames: number;
  /** Own FGA/ORB/TO/FTA for possession estimate. */
  fga: number;
  orb: number;
  tov: number;
  fta: number;
  pointsAgainst: number;
  oppFgm: number;
  oppFga: number;
  oppTpm: number;
  oppTpa: number;
  /** 0.5 × (own poss + opp poss) summed across games. */
  possEst: number;
};

function possessionEstimate(input: {
  fga: number;
  orb: number;
  tov: number;
  fta: number;
}): number {
  return input.fga - input.orb + input.tov + 0.4 * input.fta;
}

/** Raw per-team prevention metrics (shared by TeamDef01 + Team Stats Defensive view). */
export type TeamDefenseBoxMetrics = {
  boxGames: number;
  pointsAgainst: number;
  /** Points against / boxGames; null if no box games. */
  papg: number | null;
  oppFgm: number;
  oppFga: number;
  oppTpm: number;
  oppTpa: number;
  /** Opp FGM / FGA; null if no FGA. */
  oppFgPct: number | null;
  /** Opp (FGM + 0.5·3PM) / FGA; null if no FGA. */
  oppEfg: number | null;
  /** Opp 3PM / 3PA; null if no 3PA sample. */
  oppTpp: number | null;
  possEst: number;
  /** 100 × pointsAgainst / possessions; null if no box games. */
  drtg: number | null;
};

function emptyTeamDefBoxAgg(): TeamDefBoxAgg {
  return {
    boxGames: 0,
    fga: 0,
    orb: 0,
    tov: 0,
    fta: 0,
    pointsAgainst: 0,
    oppFgm: 0,
    oppFga: 0,
    oppTpm: 0,
    oppTpa: 0,
    possEst: 0,
  };
}

function metricsFromAgg(a: TeamDefBoxAgg): TeamDefenseBoxMetrics {
  const oppFgPct = a.oppFga > 0 ? a.oppFgm / a.oppFga : null;
  const oppEfg =
    a.oppFga > 0 ? (a.oppFgm + 0.5 * a.oppTpm) / a.oppFga : null;
  const oppTpp = a.oppTpa > 0 ? a.oppTpm / a.oppTpa : null;
  const papg = a.boxGames > 0 ? a.pointsAgainst / a.boxGames : null;
  const poss = a.possEst > 0 ? a.possEst : a.boxGames;
  const drtg = a.boxGames > 0 && poss > 0 ? (a.pointsAgainst / poss) * 100 : null;
  return {
    boxGames: a.boxGames,
    pointsAgainst: a.pointsAgainst,
    papg,
    oppFgm: a.oppFgm,
    oppFga: a.oppFga,
    oppTpm: a.oppTpm,
    oppTpa: a.oppTpa,
    oppFgPct,
    oppEfg,
    oppTpp,
    possEst: a.possEst,
    drtg,
  };
}

/**
 * Aggregate opponent shooting + DRtg inputs from completed games with box scores.
 * Teams with no box sample are omitted from the map.
 */
export function buildTeamDefenseBoxMetrics(
  games: Game[],
  teams: Team[]
): Map<string, TeamDefenseBoxMetrics> {
  const completed = games.filter(isGameCompleted);
  const aggs = new Map<string, TeamDefBoxAgg>();
  const ensure = (teamId: string): TeamDefBoxAgg => {
    let a = aggs.get(teamId);
    if (!a) {
      a = emptyTeamDefBoxAgg();
      aggs.set(teamId, a);
    }
    return a;
  };

  const clubRosterByTeam = buildClubRosterByTeam(teams);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const resolveOpts = { clubRosterByTeam, teamById };

  for (const game of completed) {
    const stats = game.gameStats || [];
    if (stats.length === 0) continue;

    const homeId = game.homeTeamId;
    const awayId = game.awayTeamId;
    if (!homeId || !awayId) continue;

    const homeAgg = ensure(homeId);
    const awayAgg = ensure(awayId);
    let homePlayed = false;
    let awayPlayed = false;

    const homeBox = { fga: 0, orb: 0, tov: 0, fta: 0 };
    const awayBox = { fga: 0, orb: 0, tov: 0, fta: 0 };

    for (const s of stats) {
      if (!s?.playerId) continue;
      const team = resolvePlayerTeamInGame(
        s.playerId,
        game,
        teams,
        undefined,
        resolveOpts
      );
      if (!team) continue;
      if (team.id === homeId) {
        homeBox.fga += s.fg_attempted || 0;
        homeBox.orb += s.orb || 0;
        homeBox.tov += s.turnovers || 0;
        homeBox.fta += s.ft_attempted || 0;
        awayAgg.oppFgm += s.fg_made || 0;
        awayAgg.oppFga += s.fg_attempted || 0;
        awayAgg.oppTpm += s.three_made || 0;
        awayAgg.oppTpa += s.three_attempted || 0;
        homePlayed = true;
      } else if (team.id === awayId) {
        awayBox.fga += s.fg_attempted || 0;
        awayBox.orb += s.orb || 0;
        awayBox.tov += s.turnovers || 0;
        awayBox.fta += s.ft_attempted || 0;
        homeAgg.oppFgm += s.fg_made || 0;
        homeAgg.oppFga += s.fg_attempted || 0;
        homeAgg.oppTpm += s.three_made || 0;
        homeAgg.oppTpa += s.three_attempted || 0;
        awayPlayed = true;
      }
    }

    const homePoss = possessionEstimate(homeBox);
    const awayPoss = possessionEstimate(awayBox);
    const gamePoss = 0.5 * (homePoss + awayPoss);
    const score = game.finalScore;

    if (homePlayed) {
      homeAgg.boxGames += 1;
      homeAgg.fga += homeBox.fga;
      homeAgg.orb += homeBox.orb;
      homeAgg.tov += homeBox.tov;
      homeAgg.fta += homeBox.fta;
      homeAgg.possEst += gamePoss;
      if (score) homeAgg.pointsAgainst += score.away;
    }
    if (awayPlayed) {
      awayAgg.boxGames += 1;
      awayAgg.fga += awayBox.fga;
      awayAgg.orb += awayBox.orb;
      awayAgg.tov += awayBox.tov;
      awayAgg.fta += awayBox.fta;
      awayAgg.possEst += gamePoss;
      if (score) awayAgg.pointsAgainst += score.home;
    }
  }

  const out = new Map<string, TeamDefenseBoxMetrics>();
  for (const [id, a] of aggs) {
    if (a.boxGames <= 0) continue;
    out.set(id, metricsFromAgg(a));
  }
  return out;
}

/**
 * TeamDef01 ∈ [0,1] among teams with box data:
 * 0.60·OppEfg01 + 0.40·DRtg01 (prevention only).
 * Lower opp eFG / DRtg better. No box → 0.5.
 */
export function buildTeamDef01Map(
  games: Game[],
  teams: Team[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of teams) map.set(t.id, 0.5);

  const metrics = buildTeamDefenseBoxMetrics(games, teams);
  const withBox = [...metrics.entries()];
  if (withBox.length === 0) return map;
  if (withBox.length === 1) {
    map.set(withBox[0][0], 1);
    return map;
  }

  const oppEfg01 = percentileById(
    withBox.map(([id, m]) => ({
      id,
      value: -(m.oppEfg ?? 0.5),
    }))
  );
  const drtg01 = percentileById(
    withBox.map(([id, m]) => ({
      id,
      value: -(m.drtg ?? 0),
    }))
  );

  for (const [id] of withBox) {
    const blended =
      TEAM_DEF_OPP_EFG_WEIGHT * (oppEfg01.get(id) ?? 0.5) +
      TEAM_DEF_DRTG_WEIGHT * (drtg01.get(id) ?? 0.5);
    map.set(id, Math.min(1, Math.max(0, blended)));
  }
  return map;
}

/** Unit blend ∈ [0, 1]. */
export function blendScore(impact01: number, tsi: number, tsiWeight: number): number {
  const w = Math.min(1, Math.max(0, tsiWeight));
  return (1 - w) * impact01 + w * tsi;
}

/** Display / sort scale: 0–100. */
export function toAwardPoints(unitScore: number): number {
  return unitScore * 100;
}

/**
 * Per team-game missed: multiplicative wither schedule.
 * 1st miss −2% (symbolic), 2nd −4% (real cut), 3rd and later −3% each.
 * e.g. 2 misses → ×0.98 × 0.96 ≈ 0.9408; 3 → ×0.97 ≈ 0.9126.
 */
export const AWARD_MISS_PENALTY_SCHEDULE = [0.02, 0.04, 0.03] as const;

/** @deprecated First-miss rate only; use AWARD_MISS_PENALTY_SCHEDULE. */
export const AWARD_MISS_PENALTY = AWARD_MISS_PENALTY_SCHEDULE[0];

export function teamGamesMissed(
  gamesPlayed: number,
  teamGames: number
): number {
  return Math.max(0, Math.floor(teamGames) - Math.floor(gamesPlayed));
}

/** Product of (1 − p_i) for each miss using AWARD_MISS_PENALTY_SCHEDULE. */
export function missPenaltyFactor(misses: number): number {
  const m = Math.max(0, Math.floor(misses));
  if (m <= 0) return 1;
  const schedule = AWARD_MISS_PENALTY_SCHEDULE;
  const last = schedule[schedule.length - 1];
  let factor = 1;
  for (let i = 0; i < m; i += 1) {
    const p = i < schedule.length ? schedule[i] : last;
    factor *= 1 - p;
  }
  return factor;
}

/** Score × missPenaltyFactor(teamGames − gamesPlayed). */
export function applyMissPenalty(
  score: number,
  gamesPlayed: number,
  teamGames: number
): number {
  const misses = teamGamesMissed(gamesPlayed, teamGames);
  if (misses <= 0 || !(score > 0)) return score;
  return score * missPenaltyFactor(misses);
}

export function mvpScoreFromParts(ov01: number, tsi: number): number {
  return toAwardPoints(blendScore(ov01, tsi, MVP_TSI_WEIGHT));
}

export function sixthScoreFromParts(ov01: number, tsi: number): number {
  return toAwardPoints(blendScore(ov01, tsi, SIXTH_TSI_WEIGHT));
}

export function dpoyScoreFromParts(
  dv01: number,
  teamDef01: number,
  tsi: number
): number {
  return toAwardPoints(
    DPOY_DV_WEIGHT * dv01 +
      DPOY_TEAM_DEF_WEIGHT * teamDef01 +
      DPOY_TSI_WEIGHT * tsi
  );
}

/** All-Defensive: 70% DV + 25% TeamDef + 5% TSI (more personal than DPOY). */
export function allDefScoreFromParts(
  dv01: number,
  teamDef01: number,
  tsi: number
): number {
  return toAwardPoints(
    ALL_DEF_DV_WEIGHT * dv01 +
      ALL_DEF_TEAM_DEF_WEIGHT * teamDef01 +
      ALL_DEF_TSI_WEIGHT * tsi
  );
}

export function allTeamTierScore(
  ati01: number,
  tsi: number,
  tier: keyof typeof ALL_TEAM_TSI_ALPHA
): number {
  return toAwardPoints(blendScore(ati01, tsi, ALL_TEAM_TSI_ALPHA[tier]));
}

export function isTopThreeFinishPlace(place: number | null | undefined): boolean {
  return place != null && place >= 1 && place <= FIRST_TEAM_SOFT_PLACE_MAX;
}
