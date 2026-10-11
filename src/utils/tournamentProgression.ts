/**
 * Tournament progression places for All-Teams weighting.
 * Bracket / placing-pool → best-possible or locked finish place.
 * No signal → caller falls back to W–L.
 */
import type { Game, Team } from '../App';
import {
  inferPlacesFromLabel,
  placeForMatchSide,
  resolveSlotPlaces,
} from './bracketPlaces';
import {
  resolveBracketSideTeamId,
  winnerLoserTeamIds,
} from './resolveBracketFeeders';
import { isGameCompleted } from './scheduledGames';
import { resolveGroupTeamIds } from './groupMembers';
import {
  normalizeTournamentStructure,
  type TournamentStage,
  type TournamentStructure,
} from './tournamentStructure';
import {
  calculateTeamStandings,
  filterGamesForGroup,
} from './tournamentStandings';

export type ProgressionPlaceSource = 'bracket' | 'placing_pool';

export interface TeamProgressionPlace {
  /** Best-possible place while undecided; locked place when decided. */
  place: number;
  /** True when the place is final (game/pool decided). */
  locked: boolean;
  source: ProgressionPlaceSource;
}

/** Flat place-bonus: 1st = +5, last = 0, squared taper (front-loaded). */
export const PLACE_BONUS_FIRST = 5;
export const PLACE_BONUS_POWER = 2;

/**
 * Additive finish bonus for Awards / All-Teams.
 * `5 × ((n − place) / (n − 1))²` — larger gaps near 1st than near last.
 */
export function progressionPlaceBonus(place: number, nTeams: number): number {
  const n = Math.max(2, Math.floor(nTeams));
  const p = Math.min(n, Math.max(1, Math.floor(place)));
  const t = (n - p) / (n - 1);
  return PLACE_BONUS_FIRST * Math.pow(t, PLACE_BONUS_POWER);
}

/**
 * Map win% to a synthetic standings place on the same ladder
 * (100% → place 1, 0% → place nTeams).
 */
export function recordWinPlace(teamWinPct: number, nTeams: number): number {
  const n = Math.max(2, Math.floor(nTeams));
  const w = Math.min(1, Math.max(0, teamWinPct));
  return 1 + Math.round((1 - w) * (n - 1));
}

/** Record fallback: same front-loaded flat bonus via synthetic place. */
export function recordWinPlaceBonus(
  teamWinPct: number,
  nTeams: number
): number {
  return progressionPlaceBonus(recordWinPlace(teamWinPct, nTeams), nTeams);
}

/**
 * @deprecated Prefer progressionPlaceBonus (flat). Kept for older scripts.
 * ±15% band: place 1 → 1.15, place nTeams → 0.85.
 */
export function progressionPlaceMultiplier(
  place: number,
  nTeams: number
): number {
  const n = Math.max(2, Math.floor(nTeams));
  const p = Math.min(n, Math.max(1, Math.floor(place)));
  return 1.15 - (0.3 * (p - 1)) / (n - 1);
}

/**
 * @deprecated Prefer recordWinPlaceBonus (flat). Kept for older scripts.
 * ±15% band from win% in [0,1]: 0% → 0.85, 50% → 1.00, 100% → 1.15.
 */
export function recordWinMultiplier(teamWinPct: number): number {
  const w = Math.min(1, Math.max(0, teamWinPct));
  return 0.85 + 0.3 * w;
}

/** Parse leading place from names like "5th–7th Placing", "5-7 Place". */
export function parsePlacingPoolBasePlace(stageName: string): number | null {
  const t = stageName.toLowerCase();
  const band = t.match(
    /\b(\d+)(?:st|nd|rd|th)?\s*[-–—/]\s*(\d+)(?:st|nd|rd|th)?\b/
  );
  if (band) {
    const a = Number(band[1]);
    if (Number.isFinite(a) && a >= 1) return a;
  }
  const ordinal = t.match(/\b(\d+)(?:st|nd|rd|th)\b/);
  if (ordinal && /plac/.test(t)) {
    const a = Number(ordinal[1]);
    if (Number.isFinite(a) && a >= 1) return a;
  }
  return null;
}

/**
 * Placing-pool standings `#` / progression base.
 * Explicit stage.placingBasePlace wins; else parse stage name; else null.
 */
export function resolvePlacingBasePlace(
  stage: Pick<TournamentStage, 'name' | 'placingBasePlace'>
): number | null {
  const explicit = stage.placingBasePlace;
  if (
    typeof explicit === 'number' &&
    Number.isFinite(explicit) &&
    explicit >= 1
  ) {
    return Math.floor(explicit);
  }
  return parsePlacingPoolBasePlace(stage.name);
}

function gameByIdMap(games: Game[]): Map<string, Game> {
  return new Map(games.map((g) => [g.id, g]));
}

function isMainGroupStage(
  stage: TournamentStage,
  stages: TournamentStage[]
): boolean {
  if (stage.kind !== 'round_robin') return false;
  if (resolvePlacingBasePlace(stage) != null) return false;
  // Earliest RR by order = main group stage
  const rr = stages
    .filter((s) => s.kind === 'round_robin')
    .sort((a, b) => a.order - b.order);
  return rr[0]?.id === stage.id;
}

/**
 * Build teamId → progression place when structure encodes finishes.
 * Empty map when nothing useful (caller uses W–L fallback).
 */
export function buildTeamProgressionPlaces(input: {
  structure: TournamentStructure | null | undefined;
  games: Game[];
  teams: Team[];
}): Map<string, TeamProgressionPlace> {
  const structure = normalizeTournamentStructure(input.structure);
  const out = new Map<string, TeamProgressionPlace>();
  if (!structure) return out;

  const gameById = gameByIdMap(input.games);
  const stages = [...structure.stages].sort((a, b) => a.order - b.order);

  const setPlace = (
    teamId: string | null | undefined,
    place: number,
    locked: boolean,
    source: ProgressionPlaceSource
  ) => {
    if (!teamId || !Number.isFinite(place) || place < 1) return;
    const prev = out.get(teamId);
    // Prefer locked over pending; among same lock state prefer better (lower) place
    if (prev) {
      if (prev.locked && !locked) return;
      if (prev.locked === locked && prev.place <= place) return;
    }
    out.set(teamId, { place, locked, source });
  };

  // --- Classification brackets ---
  for (const stage of stages) {
    if (stage.kind !== 'classification' || !stage.bracket?.rounds?.length) {
      continue;
    }
    const rounds = stage.bracket.rounds;
    for (const round of rounds) {
      for (const slot of round.slots) {
        if (slot.inactive) continue;
        const homeId = resolveBracketSideTeamId(slot, 'home', rounds, gameById);
        const awayId = resolveBracketSideTeamId(slot, 'away', rounds, gameById);
        const places = resolveSlotPlaces(slot, [slot.label, round.name]);
        if (places.winner == null && places.loser == null) {
          // Try label inference only
          const inferred = inferPlacesFromLabel(slot.label ?? round.name);
          if (!inferred) continue;
        }
        const resolved = resolveSlotPlaces(slot, [slot.label, round.name]);
        if (resolved.winner == null || resolved.loser == null) continue;

        const game = slot.gameId ? gameById.get(slot.gameId) : undefined;
        const wl = game ? winnerLoserTeamIds(game) : null;

        if (wl) {
          const homePlace = placeForMatchSide(
            slot,
            homeId === wl.winnerId,
            homeId === wl.loserId,
            [slot.label, round.name],
            rounds
          );
          const awayPlace = placeForMatchSide(
            slot,
            awayId === wl.winnerId,
            awayId === wl.loserId,
            [slot.label, round.name],
            rounds
          );
          // null when this outcome still feeds another match (e.g. SF → Final)
          if (homePlace != null) setPlace(homeId, homePlace, true, 'bracket');
          if (awayPlace != null) setPlace(awayId, awayPlace, true, 'bracket');
        } else if (homeId || awayId) {
          // Undecided: both get best possible (winner place)
          const best = Math.min(resolved.winner, resolved.loser);
          setPlace(homeId, best, false, 'bracket');
          setPlace(awayId, best, false, 'bracket');
        }
      }
    }
  }

  // --- Placing RR pools (not main group stage) ---
  for (const stage of stages) {
    if (stage.kind !== 'round_robin') continue;
    if (isMainGroupStage(stage, stages)) continue;
    const base = resolvePlacingBasePlace(stage);
    if (base == null) continue;

    for (const group of stage.groups ?? []) {
      const memberIds = resolveGroupTeamIds(group, structure).filter(Boolean);
      if (memberIds.length === 0) continue;

      const memberTeams = input.teams.filter((t) => memberIds.includes(t.id));
      // Same eligibility as Standings tab (stage/group tags + seed members).
      const groupGames = filterGamesForGroup(
        input.games,
        group,
        structure,
        stage.id
      );
      const completedGroupGames = groupGames.filter(isGameCompleted);

      const expectedGames = (memberIds.length * (memberIds.length - 1)) / 2;
      const completedCount = completedGroupGames.length;
      const poolComplete =
        expectedGames > 0 && completedCount >= expectedGames;

      if (poolComplete) {
        const standings = calculateTeamStandings(
          memberTeams,
          completedGroupGames
        );
        standings.forEach((row, idx) => {
          setPlace(row.team.id, base + idx, true, 'placing_pool');
        });
      } else {
        // Still alive in pool → best possible = base (e.g. 5th)
        for (const id of memberIds) {
          setPlace(id, base, false, 'placing_pool');
        }
      }
    }
  }

  return out;
}

export function countTournamentTeamsForProgression(
  teams: Team[],
  games: Game[],
  progression: Map<string, TeamProgressionPlace>
): number {
  const ids = new Set<string>();
  for (const g of games) {
    const home = g.homeTeamId || g.homeTeam?.id;
    const away = g.awayTeamId || g.awayTeam?.id;
    if (home) ids.add(home);
    if (away) ids.add(away);
  }
  for (const id of progression.keys()) ids.add(id);
  if (ids.size >= 2) return ids.size;
  return Math.max(2, teams.length);
}
