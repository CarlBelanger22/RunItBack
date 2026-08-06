/**
 * LE-106 — Head-to-head tiebreak among teams with the same W–L.
 * Order: H2H wins → H2H DIFF → H2H PF → overall DIFF → overall PF.
 */

import type { Game, Team } from '../App';
import type { StandingRow } from './tournamentStandings';

export interface H2hTeamStats {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
}

export interface H2hTieBlock {
  /** Inclusive start index in the sorted standings array */
  startIndex: number;
  teamIds: string[];
}

export interface H2hTieExplanation {
  teamIds: string[];
  rows: Array<H2hTeamStats & { team: Team; rankAmongTied: number }>;
  games: Game[];
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

export function gamesAmongTeams(games: Game[], teamIds: Set<string>): Game[] {
  return games.filter(
    (g) => teamIds.has(g.homeTeamId) && teamIds.has(g.awayTeamId)
  );
}

export function computeH2hStats(
  teamIds: string[],
  games: Game[]
): Map<string, H2hTeamStats> {
  const idSet = new Set(teamIds);
  const stats = new Map<string, H2hTeamStats>();
  for (const id of teamIds) {
    stats.set(id, {
      teamId: id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
    });
  }

  for (const game of gamesAmongTeams(games, idSet)) {
    const score = resolveFinalScore(game);
    if (!score) continue;
    const home = stats.get(game.homeTeamId);
    const away = stats.get(game.awayTeamId);
    if (!home || !away) continue;
    home.pointsFor += score.home;
    home.pointsAgainst += score.away;
    away.pointsFor += score.away;
    away.pointsAgainst += score.home;
    if (score.home > score.away) {
      home.wins += 1;
      away.losses += 1;
    } else if (score.away > score.home) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  for (const row of stats.values()) {
    row.pointsDiff = row.pointsFor - row.pointsAgainst;
  }
  return stats;
}

function compareH2hThenOverall(
  a: StandingRow,
  b: StandingRow,
  h2h: Map<string, H2hTeamStats>
): number {
  const ha = h2h.get(a.team.id)!;
  const hb = h2h.get(b.team.id)!;
  if (hb.wins !== ha.wins) return hb.wins - ha.wins;
  if (hb.pointsDiff !== ha.pointsDiff) return hb.pointsDiff - ha.pointsDiff;
  if (hb.pointsFor !== ha.pointsFor) return hb.pointsFor - ha.pointsFor;
  if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
  return b.pointsFor - a.pointsFor;
}

/**
 * Sort standings: better W–L first; within identical W–L, apply H2H among that set.
 */
export function sortStandingRowsWithH2h(
  rows: StandingRow[],
  games: Game[]
): StandingRow[] {
  const buckets = new Map<string, StandingRow[]>();
  for (const row of rows) {
    const key = `${row.wins}-${row.losses}`;
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }

  const sortedKeys = [...buckets.keys()].sort((ka, kb) => {
    const [aw, al] = ka.split('-').map(Number);
    const [bw, bl] = kb.split('-').map(Number);
    const aPlayed = aw + al;
    const bPlayed = bw + bl;
    const aPct = aPlayed > 0 ? aw / aPlayed : 0;
    const bPct = bPlayed > 0 ? bw / bPlayed : 0;
    if (bPct !== aPct) return bPct - aPct;
    if (bw !== aw) return bw - aw;
    return al - bl;
  });

  const result: StandingRow[] = [];
  for (const key of sortedKeys) {
    const group = buckets.get(key)!;
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const h2h = computeH2hStats(
      group.map((r) => r.team.id),
      games
    );
    result.push(
      ...[...group].sort((a, b) => compareH2hThenOverall(a, b, h2h))
    );
  }
  return result;
}

/** Tied blocks in an already H2H-sorted standings list (same W–L). */
export function findH2hTieBlocks(rows: StandingRow[]): H2hTieBlock[] {
  const blocks: H2hTieBlock[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (
      j < rows.length &&
      rows[j].wins === rows[i].wins &&
      rows[j].losses === rows[i].losses
    ) {
      j += 1;
    }
    if (j - i >= 2) {
      blocks.push({
        startIndex: i,
        teamIds: rows.slice(i, j).map((r) => r.team.id),
      });
    }
    i = j;
  }
  return blocks;
}

export function buildH2hTieExplanation(
  teamIds: string[],
  teamsById: Map<string, Team>,
  games: Game[]
): H2hTieExplanation {
  const h2h = computeH2hStats(teamIds, games);
  const rows = teamIds
    .map((id) => {
      const team = teamsById.get(id);
      const stats = h2h.get(id)!;
      return {
        ...stats,
        team: team ?? {
          id,
          name: id,
          abbreviation: id,
          players: [],
        },
        rankAmongTied: 0,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return b.pointsFor - a.pointsFor;
    })
    .map((row, index) => ({ ...row, rankAmongTied: index + 1 }));

  return {
    teamIds,
    rows,
    games: sortGamesByDate(
      gamesAmongTeams(games, new Set(teamIds)).filter(
        (g) => resolveFinalScore(g) != null
      )
    ),
  };
}

function sortGamesByDate(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });
}
