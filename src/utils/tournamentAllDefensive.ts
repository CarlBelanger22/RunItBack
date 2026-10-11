/**
 * Stats-only All-Defensive 1st / 2nd Team (+ 3 HM).
 * Score: same as DPOY — 70% DV01 + 20% TeamDef01 + 10% TSI.
 * TeamDef01 = Blend P: 0.35·opp eFG + 0.25·DRtg + 0.20·stocks + 0.20·DRB.
 */
import type { Game, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  aggregateTournamentAwardPlayers,
  tournamentHasPlusMinusCoverage,
  type AwardPlayerAggregate,
} from './tournamentAwards';
import {
  allDefScoreFromParts,
  buildTeamDef01Map,
  buildTeamSuccessIndexMap,
  defenseValueRaw,
  percentileById,
  tsiFromWinAndProgression,
} from './tournamentAwardScoring';
import { meetsTournamentMajorAwardGamesFloor } from './tournamentLeaders';
import type { TournamentRosterEntry } from './tournamentRosters';
import type { TournamentStructure } from './tournamentStructure';
import {
  buildTeamProgressionPlaces,
  countTournamentTeamsForProgression,
  type TeamProgressionPlace,
} from './tournamentProgression';
import {
  allTournamentShortName,
  buildTeamWinPctMap,
  positionToAllTeamBucket,
  type AllTeamBucket,
  type AllTeamMember,
  type AllTeamMultiplierSource,
} from './tournamentAllTeams';

export type AllDefensiveTier = 'first' | 'second';

export interface AllDefensiveTeamsResult {
  shortName: string;
  first: AllTeamMember[];
  second: AllTeamMember[];
  honorableMentions: AllTeamMember[];
  tooltip: string;
}

const HONORABLE_MENTION_N = 3;
const MAX_PER_CLUB = 3;
const SEAT_PATTERN: AllTeamBucket[] = ['G', 'G', 'F', 'F', 'F'];

type ScoreMeta = {
  score: number;
  winPct: number;
  bonus: number;
  source: AllTeamMultiplierSource;
  progressionPlace: number | null;
};

function stocksPerGame(row: AwardPlayerAggregate): number {
  if (row.gamesPlayed <= 0) return 0;
  return (row.totalStats.steals + row.totalStats.blocks) / row.gamesPlayed;
}

function foulsPerGame(row: AwardPlayerAggregate): number {
  if (row.gamesPlayed <= 0) return 0;
  return row.totalStats.fouls / row.gamesPlayed;
}

function compareDefCandidates(
  a: AwardPlayerAggregate,
  b: AwardPlayerAggregate,
  scoreA: number,
  scoreB: number
): number {
  const d = scoreB - scoreA;
  if (d !== 0) return d;
  const stocks = stocksPerGame(b) - stocksPerGame(a);
  if (stocks !== 0) return stocks;
  const pf = foulsPerGame(a) - foulsPerGame(b);
  if (pf !== 0) return pf;
  return a.player.name.localeCompare(b.player.name);
}

function softFillPrefs(seat: AllTeamBucket): AllTeamBucket[] {
  if (seat === 'F') return ['F', 'G'];
  return ['G', 'F'];
}

function toMember(
  row: AwardPlayerAggregate,
  opts: { meta: ScoreMeta; seat: AllTeamBucket }
): AllTeamMember {
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
    sortValue: opts.meta.score,
    mpg: minutes > 0 && gp > 0 ? minutes / gp : null,
    plusMinusPerGame:
      row.plusMinusGames > 0 ? row.plusMinusTotal / row.plusMinusGames : null,
    gmscPerGame:
      gp > 0
        ? MetricsCalculator.calculateGameScore(row.totalStats) / gp
        : 0,
    allTeamScore: opts.meta.score,
    teamWinPct: opts.meta.winPct,
    placeBonus: opts.meta.bonus,
    winMultiplier: opts.meta.bonus,
    contextMultiplier: opts.meta.bonus,
    multiplierSource: opts.meta.source,
    progressionPlace: opts.meta.progressionPlace,
    naturalBucket: positionToAllTeamBucket(row.player.position),
    seat: opts.seat,
  };
}

function sortSquadDisplay(members: AllTeamMember[]): AllTeamMember[] {
  const bySeat: Record<AllTeamBucket, AllTeamMember[]> = { G: [], F: [] };
  for (const m of members) bySeat[m.seat].push(m);
  const out: AllTeamMember[] = [];
  for (const seat of SEAT_PATTERN) {
    const next = bySeat[seat].shift();
    if (next) out.push(next);
  }
  for (const seat of ['G', 'F'] as AllTeamBucket[]) {
    out.push(...bySeat[seat]);
  }
  return out;
}

function fillOneSquad(
  pool: AwardPlayerAggregate[],
  scores: Map<string, ScoreMeta>
): { squad: AllTeamMember[]; remaining: AwardPlayerAggregate[] } {
  const remaining = [...pool].sort((a, b) => {
    const sa = scores.get(a.playerId)!;
    const sb = scores.get(b.playerId)!;
    return compareDefCandidates(a, b, sa.score, sb.score);
  });

  const need: Record<AllTeamBucket, number> = { G: 2, F: 3 };
  const clubCount = new Map<string, number>();
  const picked: AllTeamMember[] = [];
  const pickedIds = new Set<string>();

  const canTake = (row: AwardPlayerAggregate) =>
    (clubCount.get(row.team.id) ?? 0) < MAX_PER_CLUB;

  const take = (row: AwardPlayerAggregate, seat: AllTeamBucket) => {
    const meta = scores.get(row.playerId)!;
    picked.push(toMember(row, { meta, seat }));
    pickedIds.add(row.playerId);
    clubCount.set(row.team.id, (clubCount.get(row.team.id) ?? 0) + 1);
    need[seat] -= 1;
  };

  for (const row of remaining) {
    if (picked.length >= 5) break;
    if (!canTake(row)) continue;
    const bucket = positionToAllTeamBucket(row.player.position);
    if (need[bucket] <= 0) continue;
    take(row, bucket);
  }

  for (const seat of SEAT_PATTERN) {
    if (need[seat] <= 0) continue;
    const candidates = remaining.filter(
      (r) => !pickedIds.has(r.playerId) && canTake(r)
    );
    let chosen: AwardPlayerAggregate | null = null;
    for (const pref of softFillPrefs(seat)) {
      chosen =
        candidates.find(
          (r) => positionToAllTeamBucket(r.player.position) === pref
        ) ?? null;
      if (chosen) break;
    }
    if (chosen) take(chosen, seat);
  }

  return {
    squad: sortSquadDisplay(picked),
    remaining: remaining.filter((r) => !pickedIds.has(r.playerId)),
  };
}

function buildAllDefScoreMap(
  eligible: AwardPlayerAggregate[],
  dv01: Map<string, number>,
  teamDef01ByTeamId: Map<string, number>,
  tsiByTeamId: Map<string, number>,
  winPctByTeamId: Map<string, number>,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number
): Map<string, ScoreMeta> {
  const scores = new Map<string, ScoreMeta>();
  for (const row of eligible) {
    const winPct = winPctByTeamId.get(row.team.id) ?? 0.5;
    const prog = progression.get(row.team.id);
    const tsi =
      tsiByTeamId.get(row.team.id) ??
      tsiFromWinAndProgression({
        teamId: row.team.id,
        winPct,
        progression,
        nTeams,
      });
    scores.set(row.playerId, {
      score: allDefScoreFromParts(
        dv01.get(row.playerId) ?? 0,
        teamDef01ByTeamId.get(row.team.id) ?? 0.5,
        tsi
      ),
      winPct,
      bonus: tsi,
      source: prog ? 'progression' : 'record',
      progressionPlace: prog?.place ?? null,
    });
  }
  return scores;
}

export function buildAllDefensiveTeams(input: {
  tournamentName: string;
  players: AwardPlayerAggregate[];
  teamWinPctByTeamId: Map<string, number>;
  teamDef01ByTeamId: Map<string, number>;
  progressionByTeamId?: Map<string, TeamProgressionPlace>;
  nTeamsForProgression?: number;
  tsiByTeamId?: Map<string, number>;
  includePlusMinus?: boolean;
}): AllDefensiveTeamsResult {
  const shortName = allTournamentShortName(input.tournamentName);
  const eligible = input.players.filter((r) =>
    meetsTournamentMajorAwardGamesFloor(r.gamesPlayed, r.teamGames)
  );
  const progression = input.progressionByTeamId ?? new Map();
  const nTeams = Math.max(
    2,
    input.nTeamsForProgression ??
      new Set(eligible.map((r) => r.team.id)).size
  );
  const includePm = input.includePlusMinus ?? false;

  const dv01 = percentileById(
    eligible.map((r) => ({
      id: r.playerId,
      value: defenseValueRaw(r, includePm),
    }))
  );

  const tsiByTeamId = input.tsiByTeamId ?? new Map<string, number>();
  if (tsiByTeamId.size === 0) {
    for (const row of eligible) {
      if (tsiByTeamId.has(row.team.id)) continue;
      tsiByTeamId.set(
        row.team.id,
        tsiFromWinAndProgression({
          teamId: row.team.id,
          winPct: input.teamWinPctByTeamId.get(row.team.id) ?? 0.5,
          progression,
          nTeams,
        })
      );
    }
  }

  // Same score for 1st / 2nd / HM (All-Def 70/20/10) so table scores are comparable.
  const scores = buildAllDefScoreMap(
    eligible,
    dv01,
    input.teamDef01ByTeamId,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams
  );
  const firstFill = fillOneSquad(eligible, scores);
  const secondFill = fillOneSquad(firstFill.remaining, scores);
  const honorableMentions = [...secondFill.remaining]
    .sort((a, b) => {
      const sa = scores.get(a.playerId)!;
      const sb = scores.get(b.playerId)!;
      return compareDefCandidates(a, b, sa.score, sb.score);
    })
    .slice(0, HONORABLE_MENTION_N)
    .map((row) => {
      const meta = scores.get(row.playerId)!;
      return toMember(row, {
        meta,
        seat: positionToAllTeamBucket(row.player.position),
      });
    });

  const tooltip =
    `Stats-only All-Defensive (same formula as Defensive Player): ` +
    `70% defense-box percentile ((1.5×STL + 1.5×BLK + 0.5×DRB − 0.25×PF) / GP` +
    (includePm ? `; + 0.07×+/−/g when tracked` : '') +
    `) + 20% team defense (35% opponent eFG% + 25% DRtg + 20% steals+blocks/g + 20% DRB/g) ` +
    `+ 10% team success index. ` +
    `Each team is 2G / 3F; max 3 from the same club. Eligible: ≥60% of team games. ` +
    `No finish-place soft-prefer (pure score). ` +
    `Honourable mentions = next 3 by Score who missed 1st/2nd. ` +
    `Independent of All-${shortName} (players may appear on both).`;

  return {
    shortName,
    first: firstFill.squad,
    second: secondFill.squad,
    honorableMentions,
    tooltip,
  };
}

export function buildAllDefensiveTeamsForGames(input: {
  tournamentId: string;
  tournamentName: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  structure?: TournamentStructure | null;
}): AllDefensiveTeamsResult {
  const players = aggregateTournamentAwardPlayers({
    tournamentId: input.tournamentId,
    games: input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
  });
  const teamWinPctByTeamId = buildTeamWinPctMap(input.games, input.teams);
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
  const tsiByTeamId = buildTeamSuccessIndexMap({
    games: input.games,
    teams: input.teams,
    progression: progressionByTeamId,
    nTeams: nTeamsForProgression,
    winPctByTeamId: teamWinPctByTeamId,
  });
  const teamDef01ByTeamId = buildTeamDef01Map(input.games, input.teams);
  return buildAllDefensiveTeams({
    tournamentName: input.tournamentName,
    players,
    teamWinPctByTeamId,
    teamDef01ByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
    tsiByTeamId,
    includePlusMinus: tournamentHasPlusMinusCoverage(input.games),
  });
}

export function allDefensiveTierTitle(tier: AllDefensiveTier): string {
  return tier === 'first' ? 'All-Defensive 1st Team' : 'All-Defensive 2nd Team';
}
