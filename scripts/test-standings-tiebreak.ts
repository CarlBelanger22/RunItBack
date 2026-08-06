/**
 * LE-106 — H2H tiebreak among same W–L.
 * Run: npm run test:standings-tiebreak
 */
import type { Game, Team } from '../src/App';
import { TEAM } from './ivp-2026-schedule-data';
import {
  calculateTeamStandings,
  filterGamesForGroup,
} from '../src/utils/tournamentStandings';
import {
  buildH2hTieExplanation,
  findH2hTieBlocks,
  sortStandingRowsWithH2h,
} from '../src/utils/standingsTiebreak';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function team(id: string, abbreviation: string): Team {
  return { id, name: abbreviation, abbreviation, players: [] };
}

function game(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  home: number,
  away: number
): Game {
  return {
    id,
    homeTeamId,
    awayTeamId,
    homeTeam: team(homeTeamId, homeTeamId),
    awayTeam: team(awayTeamId, awayTeamId),
    tournamentId: 'ivp',
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { teamId: homeTeamId, total_points: home } as Game['teamStats']['home'],
      away: { teamId: awayTeamId, total_points: away } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home, away },
  };
}

function main(): void {
  // IVP Group B schedule (from LE-105 graphics)
  const nyp = TEAM.nyp;
  const nus = TEAM.nus;
  const sim = TEAM.sim;
  const rp = TEAM.rp;
  const teams = [
    team(nyp, 'NYP'),
    team(nus, 'NUS'),
    team(sim, 'SIM'),
    team(rp, 'RP'),
  ];
  const games = [
    game('g1', nyp, nus, 60, 56),
    game('g2', rp, sim, 64, 70),
    game('g3', sim, nus, 67, 82),
    game('g4', rp, nyp, 51, 106),
    game('g5', nus, rp, 77, 73),
    game('g6', nyp, sim, 49, 62),
  ];

  const withoutH2h = calculateTeamStandings(teams, games);
  assert(withoutH2h[0].team.id === nyp, 'overall DIFF puts NYP first');

  const withH2h = calculateTeamStandings(teams, games, { h2hTiebreak: true });
  assert(withH2h.map((r) => r.team.abbreviation).join(',') === 'NUS,SIM,NYP,RP',
    `expected NUS,SIM,NYP,RP got ${withH2h.map((r) => r.team.abbreviation).join(',')}`
  );
  assert(withH2h[0].wins === 2 && withH2h[0].losses === 1, 'NUS 2-1');
  assert(withH2h[3].wins === 0, 'RP last');

  const blocks = findH2hTieBlocks(withH2h);
  assert(blocks.length === 1, 'one tie block');
  assert(blocks[0].startIndex === 0, 'tie starts at rank 1');
  assert(blocks[0].teamIds.length === 3, 'three tied');

  const expl = buildH2hTieExplanation(
    blocks[0].teamIds,
    new Map(teams.map((t) => [t.id, t])),
    games
  );
  assert(expl.games.length === 3, 'three H2H games among tied');
  assert(expl.rows[0].team.id === nus, 'H2H table NUS first');
  assert(expl.rows[0].pointsDiff === 11, 'NUS H2H DIFF +11');

  // sortStandingRowsWithH2h identity on already-sorted unique W-L
  const unique = sortStandingRowsWithH2h(
    [
      { ...withH2h[0], wins: 3, losses: 0, winPercentage: 100 },
      { ...withH2h[3], wins: 0, losses: 3, winPercentage: 0 },
    ],
    games
  );
  assert(unique[0].wins === 3, 'unique records stay ordered');

  // filterGamesForGroup sanity with group stub
  const group = {
    id: 'b',
    name: 'Group B',
    teamIds: [nyp, nus, sim, rp],
  };
  assert(filterGamesForGroup(games, group).length === 6, 'all group games');

  console.log('PASS: test-standings-tiebreak');
}

main();
