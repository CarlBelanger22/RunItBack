/**
 * Stats-only All-Defensive 1st / 2nd Team (+ 3 HM).
 * Score: same as DPOY — 50% DV01 + 40% TeamDef01 + 10% TSI.
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
  applyMissPenalty,
  buildTeamDef01Map,
  buildTeamSuccessIndexMap,
  defenseValueRaw,
  minmax01ById,
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
const SQUAD_SIZE = 5;
/** Max players from one club on a single named squad (1st/2nd). */
const MAX_PER_SQUAD = 2;
/** Max players from one club across 1st + 2nd combined. HM uncapped. */
const MAX_ACROSS_NAMED = 3;

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

function toMember(
  row: AwardPlayerAggregate,
  opts: { meta: ScoreMeta }
): AllTeamMember {
  const gp = row.gamesPlayed;
  const minutes = row.totalStats.minutes_played;
  const naturalBucket = positionToAllTeamBucket(row.player.position);
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
    naturalBucket,
    seat: naturalBucket,
  };
}

/**
 * Top N by Score with club caps (no G/F seats).
 * Rejected players stay in remaining for lower tiers / HM.
 */
function fillOneSquad(
  pool: AwardPlayerAggregate[],
  scores: Map<string, ScoreMeta>,
  clubAcrossNamed: Map<string, number>,
  maxAcrossNamed: number
): { squad: AllTeamMember[]; remaining: AwardPlayerAggregate[] } {
  const ranked = [...pool].sort((a, b) => {
    const sa = scores.get(a.playerId)!;
    const sb = scores.get(b.playerId)!;
    return compareDefCandidates(a, b, sa.score, sb.score);
  });

  const squad: AllTeamMember[] = [];
  const pickedIds = new Set<string>();
  const clubOnSquad = new Map<string, number>();

  for (const row of ranked) {
    if (squad.length >= SQUAD_SIZE) break;
    const clubId = row.team.id;
    const onSquad = clubOnSquad.get(clubId) ?? 0;
    const across = clubAcrossNamed.get(clubId) ?? 0;
    if (onSquad >= MAX_PER_SQUAD || across >= maxAcrossNamed) continue;
    squad.push(toMember(row, { meta: scores.get(row.playerId)! }));
    pickedIds.add(row.playerId);
    clubOnSquad.set(clubId, onSquad + 1);
    clubAcrossNamed.set(clubId, across + 1);
  }

  return {
    squad,
    remaining: ranked.filter((r) => !pickedIds.has(r.playerId)),
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
      score: applyMissPenalty(
        allDefScoreFromParts(
          dv01.get(row.playerId) ?? 0,
          teamDef01ByTeamId.get(row.team.id) ?? 0.5,
          tsi
        ),
        row.gamesPlayed,
        row.teamGames
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

  const dv01 = minmax01ById(
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
  const clubAcrossNamed = new Map<string, number>();
  const firstFill = fillOneSquad(
    eligible,
    scores,
    clubAcrossNamed,
    MAX_ACROSS_NAMED
  );
  const secondFill = fillOneSquad(
    firstFill.remaining,
    scores,
    clubAcrossNamed,
    MAX_ACROSS_NAMED
  );
  const honorableMentions = [...secondFill.remaining]
    .sort((a, b) => {
      const sa = scores.get(a.playerId)!;
      const sb = scores.get(b.playerId)!;
      return compareDefCandidates(a, b, sa.score, sb.score);
    })
    .slice(0, HONORABLE_MENTION_N)
    .map((row) => {
      const meta = scores.get(row.playerId)!;
      return toMember(row, { meta });
    });

  const tooltip =
    `Stats-only All-Defensive (same formula as Defensive Player): ` +
    `50% defense box (scaled 0–100% vs eligible min/max; ` +
    `(1.5×STL + 1.5×BLK + 0.5×DRB − 0.25×PF) / GP` +
    (includePm ? `; + 0.07×+/−/g when tracked` : '') +
    `) + 40% team defense (35% opponent eFG% + 25% DRtg + 20% steals+blocks/g + 20% DRB/g) ` +
    `+ 10% team success index. ` +
    `Then miss wither: −5% / −4% / −3% (recurring) of Score per team game missed (multiplicative). ` +
    `Each team is the top 5 eligible by Score (no position seats). ` +
    `Max 2 from the same club per 1st/2nd Team; max 3 across both (overflow spills to honourable mentions). ` +
    `Honourable mentions uncapped. ` +
    `Eligible: ≥60% of team games. ` +
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
