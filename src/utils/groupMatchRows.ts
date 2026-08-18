/**
 * LE-147 — Group Matches list: real games + seed placeholder fixtures (A3 vs B4).
 */

import type { Game, Team } from '../App';
import { sortGamesByDateAsc } from './gameDisplay';
import { filterGamesForGroup } from './tournamentStandings';
import type { GroupSeedMatchup, TournamentGroup, TournamentStructure } from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';
import { groupSeedLabels } from './groupMembers';
import { normalizeSeedCode } from './seedCodes';
import { matchupPairKey } from './matchupGamePick';

export interface GroupMatchRow {
  key: string;
  game?: Game;
  homeLabel: string;
  awayLabel: string;
  homeTeam?: Team;
  awayTeam?: Team;
  date?: string;
  startTime?: string;
  isPlaceholder: boolean;
}

/** Seed fixture without a `Game` row yet — for tournament Games tab. */
export interface TournamentFixtureRow extends GroupMatchRow {
  stageId: string;
  groupId?: string;
  bracketSlotId?: string;
  slotLabel?: string;
  roundName?: string;
}

/** Default 3-team placing pool (Sunig-style: A3, B3, B4). */
export function defaultPlacingPoolSeedMatchups(
  seedLabels: string[]
): GroupSeedMatchup[] {
  const seeds = seedLabels
    .map((s) => normalizeSeedCode(s))
    .filter((s): s is string => s != null);
  if (seeds.join(',') === 'A3,B3,B4') {
    return [
      { homeSeed: 'A3', awaySeed: 'B4', date: '2026-09-28', startTime: '20:40' },
      { homeSeed: 'B3', awaySeed: 'A3', date: '2026-10-01', startTime: '20:00' },
      { homeSeed: 'B4', awaySeed: 'B3', date: '2026-10-05', startTime: '20:40' },
    ];
  }
  const out: GroupSeedMatchup[] = [];
  for (let i = 0; i < seeds.length; i += 1) {
    for (let j = i + 1; j < seeds.length; j += 1) {
      out.push({ homeSeed: seeds[i], awaySeed: seeds[j] });
    }
  }
  return out;
}

export function resolveGroupSeedMatchups(group: TournamentGroup): GroupSeedMatchup[] {
  if (group.seedMatchups?.length) {
    return group.seedMatchups
      .map((m) => {
        const homeSeed = normalizeSeedCode(m.homeSeed);
        const awaySeed = normalizeSeedCode(m.awaySeed);
        if (!homeSeed || !awaySeed) return null;
        return {
          ...m,
          homeSeed,
          awaySeed,
        };
      })
      .filter((m): m is GroupSeedMatchup => m != null);
  }
  const seeds = groupSeedLabels(group);
  if (seeds.length < 2) return [];
  return defaultPlacingPoolSeedMatchups(seeds);
}

function matchGameToSeedMatchup(
  game: Game,
  matchup: GroupSeedMatchup,
  snap: Record<string, string>
): boolean {
  if (matchup.gameId && game.id === matchup.gameId) return true;
  const homeId = snap[matchup.homeSeed];
  const awayId = snap[matchup.awaySeed];
  if (homeId && awayId) {
    const key = matchupPairKey(homeId, awayId);
    if (key === matchupPairKey(game.homeTeamId, game.awayTeamId)) return true;
  }
  if (matchup.date && game.date === matchup.date) {
    const meta = game.teamStats as { __meta?: { homeSeed?: string; awaySeed?: string } };
    const homeSeed = normalizeSeedCode(meta?.__meta?.homeSeed);
    const awaySeed = normalizeSeedCode(meta?.__meta?.awaySeed);
    if (
      homeSeed === matchup.homeSeed &&
      awaySeed === matchup.awaySeed
    ) {
      return true;
    }
  }
  return false;
}

function rowFromGame(
  game: Game,
  homeTeam: Team | undefined,
  awayTeam: Team | undefined,
  fallback?: GroupSeedMatchup
): GroupMatchRow {
  return {
    key: game.id,
    game,
    homeLabel: homeTeam?.abbreviation ?? homeTeam?.name ?? fallback?.homeSeed ?? '?',
    awayLabel: awayTeam?.abbreviation ?? awayTeam?.name ?? fallback?.awaySeed ?? '?',
    homeTeam,
    awayTeam,
    date: game.date,
    startTime: game.startTime ?? fallback?.startTime,
    isPlaceholder: false,
  };
}

function sortMatchRows(rows: GroupMatchRow[]): GroupMatchRow[] {
  return [...rows].sort((a, b) => {
    const dateA = a.date ?? a.game?.date ?? '';
    const dateB = b.date ?? b.game?.date ?? '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.startTime ?? a.game?.startTime ?? '';
    const timeB = b.startTime ?? b.game?.startTime ?? '';
    return timeA.localeCompare(timeB);
  });
}

export function buildGroupMatchRows(
  group: TournamentGroup,
  structure: TournamentStructure | undefined,
  allGames: Game[],
  teamById: Map<string, Team>,
  stageId: string
): GroupMatchRow[] {
  const normalized = normalizeTournamentStructure(structure);
  const groupGames = sortGamesByDateAsc(
    filterGamesForGroup(allGames, group, normalized, stageId)
  );
  const seeds = groupSeedLabels(group);
  if (seeds.length === 0) {
    return groupGames.map((game) =>
      rowFromGame(
        game,
        teamById.get(game.homeTeamId),
        teamById.get(game.awayTeamId)
      )
    );
  }

  const snap = normalized?.seedSnapshot ?? {};
  const scheduled = resolveGroupSeedMatchups(group);
  const usedGameIds = new Set<string>();
  const rows: GroupMatchRow[] = [];

  for (const matchup of scheduled) {
    const game = groupGames.find(
      (g) => !usedGameIds.has(g.id) && matchGameToSeedMatchup(g, matchup, snap)
    );
    if (game) {
      usedGameIds.add(game.id);
      rows.push(
        rowFromGame(
          game,
          teamById.get(game.homeTeamId),
          teamById.get(game.awayTeamId),
          matchup
        )
      );
    } else {
      const homeId = snap[matchup.homeSeed];
      const awayId = snap[matchup.awaySeed];
      rows.push({
        key: `seed-${matchup.homeSeed}-${matchup.awaySeed}`,
        homeLabel: matchup.homeSeed,
        awayLabel: matchup.awaySeed,
        homeTeam: homeId ? teamById.get(homeId) : undefined,
        awayTeam: awayId ? teamById.get(awayId) : undefined,
        date: matchup.date,
        startTime: matchup.startTime,
        isPlaceholder: !homeId || !awayId,
      });
    }
  }

  for (const game of groupGames) {
    if (usedGameIds.has(game.id)) continue;
    rows.push(
      rowFromGame(
        game,
        teamById.get(game.homeTeamId),
        teamById.get(game.awayTeamId)
      )
    );
  }

  return sortMatchRows(rows);
}

/** Unplayed seed-based fixtures (no `Game` row) across all RR seed groups. */
export function buildSeedFixtureRows(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  teamById: Map<string, Team>
): TournamentFixtureRow[] {
  const structure = normalizeTournamentStructure(structureInput);
  if (!structure) return [];

  const fixtures: TournamentFixtureRow[] = [];
  for (const stage of structure.stages) {
    if (stage.kind !== 'round_robin') continue;
    for (const group of stage.groups ?? []) {
      if (groupSeedLabels(group).length === 0) continue;
      const matchRows = buildGroupMatchRows(
        group,
        structure,
        allGames,
        teamById,
        stage.id
      );
      for (const row of matchRows) {
        if (row.game) continue;
        fixtures.push({
          ...row,
          stageId: stage.id,
          groupId: group.id,
        });
      }
    }
  }
  return fixtures;
}

export function sortGamesTabEntries<
  T extends { date?: string; startTime?: string; game?: Game },
>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const dateA = a.date ?? a.game?.date ?? '';
    const dateB = b.date ?? b.game?.date ?? '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.startTime ?? a.game?.startTime ?? '';
    const timeB = b.startTime ?? b.game?.startTime ?? '';
    return timeA.localeCompare(timeB);
  });
}
