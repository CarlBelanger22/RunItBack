import type { Game, GameStats, Player, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { getPlayersWhoPlayed } from './gameDisplay';

export interface HeadToHeadPlayer {
  playerId: string;
  teamId: string;
  name: string;
  initials: string;
  number: number;
  gmSc: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
}

export interface HeadToHeadStatRow {
  key: string;
  label: string;
  homeDisplay: string;
  awayDisplay: string;
}

export interface GameHeadToHeadModel {
  home: HeadToHeadPlayer | null;
  away: HeadToHeadPlayer | null;
  statRows: HeadToHeadStatRow[];
  gmSc: HeadToHeadStatRow;
}

export function playerInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '—';
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

interface RankedPlayer {
  player: Player;
  teamId: string;
  stats: GameStats;
  gmSc: number;
}

function rankTeamPlayers(game: Game, team: Team): RankedPlayer | null {
  const ranked: RankedPlayer[] = [];

  for (const player of getPlayersWhoPlayed(game, team)) {
    const stats = game.gameStats.find((s) => s.playerId === player.id);
    if (!stats) continue;
    ranked.push({
      player,
      teamId: team.id,
      stats,
      gmSc: MetricsCalculator.calculateGameScore(stats),
    });
  }

  if (ranked.length === 0) return null;

  const maxGmSc = Math.max(...ranked.map((r) => r.gmSc));
  const tied = ranked.filter((r) => r.gmSc === maxGmSc);
  tied.sort((a, b) => b.stats.minutes_played - a.stats.minutes_played);

  return tied[0] ?? null;
}

function toHeadToHeadPlayer(ranked: RankedPlayer): HeadToHeadPlayer {
  const { player, teamId, stats, gmSc } = ranked;
  return {
    playerId: player.id,
    teamId,
    name: player.name,
    initials: playerInitials(player.name),
    number: player.number,
    gmSc,
    points: stats.points,
    rebounds: stats.orb + stats.drb,
    assists: stats.assists,
    steals: stats.steals,
    blocks: stats.blocks,
  };
}

function displayInt(value: number | undefined): string {
  if (value == null) return '—';
  return String(value);
}

function displayGmSc(value: number | undefined): string {
  if (value == null) return '—';
  return value.toFixed(1);
}

export function buildGameHeadToHeadModel(game: Game): GameHeadToHeadModel {
  const homeRanked = rankTeamPlayers(game, game.homeTeam);
  const awayRanked = rankTeamPlayers(game, game.awayTeam);
  const home = homeRanked ? toHeadToHeadPlayer(homeRanked) : null;
  const away = awayRanked ? toHeadToHeadPlayer(awayRanked) : null;

  const statRows: HeadToHeadStatRow[] = [
    {
      key: 'pts',
      label: 'PTS',
      homeDisplay: displayInt(home?.points),
      awayDisplay: displayInt(away?.points),
    },
    {
      key: 'reb',
      label: 'REB',
      homeDisplay: displayInt(home?.rebounds),
      awayDisplay: displayInt(away?.rebounds),
    },
    {
      key: 'ast',
      label: 'AST',
      homeDisplay: displayInt(home?.assists),
      awayDisplay: displayInt(away?.assists),
    },
    {
      key: 'stl',
      label: 'STL',
      homeDisplay: displayInt(home?.steals),
      awayDisplay: displayInt(away?.steals),
    },
    {
      key: 'blk',
      label: 'BLK',
      homeDisplay: displayInt(home?.blocks),
      awayDisplay: displayInt(away?.blocks),
    },
  ];

  return {
    home,
    away,
    statRows,
    gmSc: {
      key: 'gmsc',
      label: 'GmSc',
      homeDisplay: displayGmSc(home?.gmSc),
      awayDisplay: displayGmSc(away?.gmSc),
    },
  };
}

export interface TransposedQuarterTable {
  periodHeaders: string[];
  homeRow: { label: string; scores: string[] };
  awayRow: { label: string; scores: string[] };
}

export function transposeQuarterRows(
  rows: { label: string; home: string; away: string }[],
  homeAbbr: string,
  awayAbbr: string
): TransposedQuarterTable {
  return {
    periodHeaders: rows.map((row) => row.label),
    homeRow: {
      label: homeAbbr,
      scores: rows.map((row) => row.home),
    },
    awayRow: {
      label: awayAbbr,
      scores: rows.map((row) => row.away),
    },
  };
}
